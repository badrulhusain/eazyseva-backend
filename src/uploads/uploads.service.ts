import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Readable } from 'stream';
import { v2 as cloudinaryV2 } from 'cloudinary';
import type { UploadApiOptions, UploadApiResponse } from 'cloudinary';
import { CLOUDINARY } from './cloudinary.provider';
import { ALLOWED_MIME_TYPES, resolveResourceType } from './constants/allowed-file-types';
import type { UploadResponseDto } from './dto/upload-response.dto';

const RETRY_DELAYS_MS = [2_000, 5_000, 10_000];

// Timeout tunable via CLOUDINARY_TIMEOUT_MS env var; default 120 s.
// Lower this in production if you want faster fail-fast behaviour.
function getCloudinaryTimeout(config: ConfigService): number {
  return config.get<number>('CLOUDINARY_TIMEOUT_MS') ?? 120_000;
}

function isRetryable(err: unknown): boolean {
  const code = (err as any)?.error?.http_code ?? (err as any)?.http_code;
  const errCode = (err as any)?.code ?? (err as any)?.error?.code;
  // 499 = SDK timeout/abort; transient network errors
  return code === 499 || ['EAI_AGAIN', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND'].includes(errCode);
}

function sleep(ms: number) {
  return new Promise<void>((res) => setTimeout(res, ms));
}

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);

  constructor(
    @Inject(CLOUDINARY) private readonly cloudinary: typeof cloudinaryV2,
    private readonly config: ConfigService,
  ) {}

  // ── Public API ─────────────────────────────────────────────────────────────

  async uploadDocument(
    file: Express.Multer.File,
    userId: string,
    requestId?: string,
  ): Promise<UploadResponseDto> {
    this.validateFile(file);

    const rid = requestId ?? '-';
    const resourceType = resolveResourceType(file.mimetype);
    const folder = `ezyseva/documents/${userId}`;
    const start = Date.now();

    this.logger.log(
      `Upload start: uid=${userId} size=${file.size}b mime=${file.mimetype} rid=${rid}`,
    );

    let result: UploadApiResponse;
    try {
      result = await this.uploadWithRetry(file.buffer, {
        folder,
        resource_type: resourceType,
        unique_filename: true,
        overwrite: false,
        use_filename: false,
      }, rid);
    } catch (err) {
      const ms = Date.now() - start;
      this.logger.error(
        `Upload failed: uid=${userId} size=${file.size}b mime=${file.mimetype} +${ms}ms rid=${rid}`,
      );
      throw err;
    }

    const ms = Date.now() - start;
    this.logger.log(
      `Upload success: uid=${userId} publicId=${result.public_id} size=${result.bytes}b +${ms}ms rid=${rid}`,
    );

    return {
      secureUrl: result.secure_url,
      publicId: result.public_id,
      originalName: file.originalname,
      format: result.format ?? file.mimetype.split('/')[1],
      bytes: result.bytes,
      resourceType: result.resource_type,
    };
  }

  async deleteDocument(
    publicId: string,
    resourceType: 'image' | 'raw' = 'image',
  ): Promise<void> {
    await this.deleteWithRetry(publicId, resourceType);
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private validateFile(file: Express.Multer.File): void {
    const allowed = ALLOWED_MIME_TYPES as readonly string[];
    if (!allowed.includes(file.mimetype)) {
      throw new BadRequestException({
        code: 'UNSUPPORTED_FILE_TYPE',
        message: `File type "${file.mimetype}" is not supported. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`,
      });
    }

    const maxMb = this.config.get<number>('MAX_FILE_SIZE_MB') ?? 5;
    const maxBytes = maxMb * 1024 * 1024;
    if (file.size > maxBytes) {
      throw new BadRequestException({
        code: 'FILE_TOO_LARGE',
        message: `File size ${(file.size / 1024 / 1024).toFixed(1)} MB exceeds the ${maxMb} MB limit`,
      });
    }
  }

  private async uploadWithRetry(
    buffer: Buffer,
    options: UploadApiOptions,
    rid: string,
  ): Promise<UploadApiResponse> {
    const timeoutMs = getCloudinaryTimeout(this.config);
    let lastError: unknown;

    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      try {
        return await this.streamUpload(buffer, { ...options, timeout: timeoutMs });
      } catch (err) {
        lastError = err;
        if (!isRetryable(err) || attempt === RETRY_DELAYS_MS.length) break;
        const delay = RETRY_DELAYS_MS[attempt];
        this.logger.warn(
          `Cloudinary upload attempt ${attempt + 1} failed, retrying in ${delay}ms rid=${rid}`,
        );
        await sleep(delay);
      }
    }

    const isTimeout = isRetryable(lastError);
    this.logger.error(`Cloudinary upload failed after all retries rid=${rid}`, lastError);

    throw new InternalServerErrorException({
      code: 'CLOUDINARY_UPLOAD_FAILED',
      message: isTimeout
        ? 'File upload timed out. Please try again with a smaller file or retry later.'
        : 'File upload to storage failed. Please try again.',
    });
  }

  // Streams the buffer directly to Cloudinary — no base64 encoding overhead.
  private streamUpload(buffer: Buffer, options: UploadApiOptions): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
      const uploadStream = this.cloudinary.uploader.upload_stream(
        options,
        (error, result) => {
          if (error) return reject(error);
          resolve(result!);
        },
      );
      Readable.from(buffer).pipe(uploadStream);
    });
  }

  private async deleteWithRetry(
    publicId: string,
    resourceType: 'image' | 'raw',
  ): Promise<void> {
    const timeoutMs = getCloudinaryTimeout(this.config);
    let lastError: unknown;

    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      try {
        const result = await (this.cloudinary.uploader.destroy as Function)(publicId, {
          resource_type: resourceType,
          timeout: timeoutMs,
        });

        if (result.result !== 'ok' && result.result !== 'not found') {
          throw new InternalServerErrorException({
            code: 'DELETE_FAILED',
            message: 'Failed to delete file from storage',
          });
        }
        return;
      } catch (err) {
        if (err instanceof InternalServerErrorException) throw err;
        lastError = err;
        if (!isRetryable(err) || attempt === RETRY_DELAYS_MS.length) break;
        const delay = RETRY_DELAYS_MS[attempt];
        this.logger.warn(`Cloudinary delete attempt ${attempt + 1} failed, retrying in ${delay}ms`);
        await sleep(delay);
      }
    }

    this.logger.error('Cloudinary delete error', lastError);
    throw new InternalServerErrorException({
      code: 'DELETE_FAILED',
      message: 'Failed to delete file from storage',
    });
  }
}

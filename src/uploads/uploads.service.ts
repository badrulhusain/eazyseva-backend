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
const CLOUDINARY_TIMEOUT_MS = 120_000;

function isRetryable(err: unknown): boolean {
  const code = (err as any)?.error?.http_code ?? (err as any)?.http_code;
  const errCode = (err as any)?.code ?? (err as any)?.error?.code;
  // 499 = SDK timeout/abort, EAI_AGAIN / ECONNRESET / ETIMEDOUT = transient network
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

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  async uploadDocument(
    file: Express.Multer.File,
    userId: string,
  ): Promise<UploadResponseDto> {
    this.validateFile(file);

    const resourceType = resolveResourceType(file.mimetype);
    const folder = `ezyseva/documents/${userId}`;

    const result = await this.uploadWithRetry(file.buffer, {
      folder,
      resource_type: resourceType,
      unique_filename: true,
      overwrite: false,
      use_filename: false,
    });

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

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private validateFile(file: Express.Multer.File): void {
    const allowed = ALLOWED_MIME_TYPES as readonly string[];
    if (!allowed.includes(file.mimetype)) {
      throw new BadRequestException({
        code: 'UNSUPPORTED_FILE_TYPE',
        message: `File type "${file.mimetype}" is not supported. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`,
      });
    }

    const maxMb = this.config.get<number>('MAX_FILE_SIZE_MB') ?? 5;
    const maxBytes = maxMb * 1024 * 1024;
    if (file.size > maxBytes) {
      throw new BadRequestException({
        code: 'FILE_TOO_LARGE',
        message: `File exceeds the ${maxMb} MB limit`,
      });
    }
  }

  private async uploadWithRetry(
    buffer: Buffer,
    options: UploadApiOptions,
  ): Promise<UploadApiResponse> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      try {
        return await this.streamUpload(buffer, options);
      } catch (err) {
        lastError = err;
        if (!isRetryable(err) || attempt === RETRY_DELAYS_MS.length) break;
        const delay = RETRY_DELAYS_MS[attempt];
        this.logger.warn(`Cloudinary upload attempt ${attempt + 1} failed, retrying in ${delay}ms`, err);
        await sleep(delay);
      }
    }

    this.logger.error('Cloudinary upload failed after all retries', lastError);
    throw new InternalServerErrorException({
      code: 'CLOUDINARY_UPLOAD_FAILED',
      message: 'File upload to storage failed. Please try again.',
    });
  }

  // Streams the buffer directly to Cloudinary — no base64 encoding overhead.
  private streamUpload(buffer: Buffer, options: UploadApiOptions): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
      const uploadStream = this.cloudinary.uploader.upload_stream(
        { ...options, timeout: CLOUDINARY_TIMEOUT_MS },
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
    let lastError: unknown;

    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      try {
        const result = await (this.cloudinary.uploader.destroy as Function)(publicId, {
          resource_type: resourceType,
          timeout: CLOUDINARY_TIMEOUT_MS,
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
        this.logger.warn(`Cloudinary delete attempt ${attempt + 1} failed, retrying in ${delay}ms`, err);
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

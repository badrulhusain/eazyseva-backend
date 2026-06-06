import {
  BadRequestException,
  Controller,
  Delete,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  UploadedFile,
  UseFilters,
  UseInterceptors,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Request } from 'express';
import { UploadsService } from './uploads.service';
import { MulterExceptionFilter } from './filters/multer-exception.filter';
import { DeleteDocumentDto } from './dto/delete-document.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUser as CurrentUserType } from '../common/types/current-user.type';

// File size ceiling read from env so it can be tuned without a code deploy.
// The same value is re-validated inside UploadsService before touching Cloudinary.
const MAX_FILE_SIZE_BYTES = parseInt(process.env.MAX_FILE_SIZE_MB ?? '5', 10) * 1024 * 1024;

// Cloudinary public IDs for this app always follow: ezyseva/documents/{userId}/...
const DOCUMENT_FOLDER = 'ezyseva/documents';

@Controller('uploads')
@UseFilters(MulterExceptionFilter)
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  /**
   * POST /api/v1/uploads/document
   *
   * Accepts a single file (field name "file") as multipart/form-data,
   * uploads it to Cloudinary, and returns the metadata the frontend stores
   * temporarily until the user submits the order form.
   *
   * Design note (future): consider switching to direct signed Cloudinary
   * uploads — frontend calls POST /uploads/sign to get a short-lived signed
   * upload URL, then POSTs the file directly to Cloudinary. The backend
   * then only stores the returned metadata (public_id, secure_url, etc.)
   * without ever holding the file bytes in RAM. This would eliminate:
   *   - memoryStorage RAM pressure on this server
   *   - The Cloudinary RTT from this server
   *   - Upload timeout risk (large file + slow CDN)
   */
  @Post('document')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: MAX_FILE_SIZE_BYTES,
        files: 1,
      },
    }),
  )
  async uploadDocument(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: CurrentUserType,
    @Req() req: Request,
  ) {
    if (!file) {
      throw new BadRequestException({
        code: 'NO_FILE',
        message: 'No file was uploaded. Attach the file using field name "file"',
      });
    }

    const data = await this.uploadsService.uploadDocument(file, user.id, req.requestId);
    return { success: true, data };
  }

  /**
   * DELETE /api/v1/uploads/document?publicId=...&resourceType=image|raw
   *
   * Cleans up a previously uploaded file from Cloudinary.
   *
   * Ownership is enforced: the publicId must start with
   * "ezyseva/documents/{current-user-id}/" so users cannot delete each
   * other's files.
   */
  @Delete('document')
  @HttpCode(HttpStatus.OK)
  async deleteDocument(
    @Query() query: DeleteDocumentDto,
    @CurrentUser() user: CurrentUserType,
  ) {
    const expectedPrefix = `${DOCUMENT_FOLDER}/${user.id}/`;
    if (!query.publicId.startsWith(expectedPrefix)) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'You do not have permission to delete this file',
      });
    }

    await this.uploadsService.deleteDocument(query.publicId, query.resourceType);
    return { success: true, message: 'File deleted successfully' };
  }
}

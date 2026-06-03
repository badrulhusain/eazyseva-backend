import {
  BadRequestException,
  Controller,
  Delete,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UploadedFile,
  UseFilters,
  UseInterceptors,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { UploadsService } from './uploads.service';
import { MulterExceptionFilter } from './filters/multer-exception.filter';
import { DeleteDocumentDto } from './dto/delete-document.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUser as CurrentUserType } from '../common/types/current-user.type';

// 5 MB hard ceiling enforced by Multer before the buffer reaches service.
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

// Cloudinary public IDs for this app always follow: ezyseva/documents/{userId}/...
// This prefix is checked on DELETE to prevent a user from deleting another user's file.
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
   * Why separate from POST /orders:
   *   - Uploads can fail independently from order creation.
   *   - File is validated and stored before the user finishes the form —
   *     faster feedback on bad file types / oversized files.
   *   - Order creation stays simple: it only receives URLs, not file bytes.
   *   - Re-uploads are possible without re-submitting the whole order.
   */
  @Post('document')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @UseInterceptors(
    FileInterceptor('file', {
      // memoryStorage keeps the file in RAM — no local disk I/O.
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
  ) {
    if (!file) {
      throw new BadRequestException({
        code: 'NO_FILE',
        message: 'No file was uploaded. Attach the file using field name "file"',
      });
    }

    const data = await this.uploadsService.uploadDocument(file, user.id);
    return { success: true, data };
  }

  /**
   * DELETE /api/v1/uploads/document?publicId=...&resourceType=image|raw
   *
   * Cleans up a previously uploaded file from Cloudinary.
   *
   * publicId is passed as a query parameter (not path segment) because
   * Cloudinary public IDs can contain forward slashes (e.g.
   * "ezyseva/documents/abc123/xyz"), which would break URL routing if placed
   * in a path parameter.
   *
   * Ownership is enforced: the publicId must start with
   * "ezyseva/documents/{current-user-id}/" so users cannot delete each
   * other's files.
   *
   * Call this when:
   *   - The user leaves the form without submitting.
   *   - The order creation API returns an error after file upload.
   */
  @Delete('document')
  @HttpCode(HttpStatus.OK)
  async deleteDocument(
    @Query() query: DeleteDocumentDto,
    @CurrentUser() user: CurrentUserType,
  ) {
    // Ownership check: publicId must belong to the requesting user's folder.
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

import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import { MulterError } from 'multer';
import type { Request, Response } from 'express';

// Catches Multer-specific errors (file size, unexpected field, etc.) before
// they reach the global AllExceptionsFilter, so responses stay consistent.
@Catch(MulterError)
export class MulterExceptionFilter implements ExceptionFilter {
  catch(exception: MulterError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.BAD_REQUEST;
    let code = 'UPLOAD_ERROR';
    let message = 'File upload error';

    switch (exception.code) {
      case 'LIMIT_FILE_SIZE':
        code = 'FILE_TOO_LARGE';
        message = 'File size exceeds the 5 MB limit';
        break;
      case 'LIMIT_UNEXPECTED_FILE':
        code = 'UNEXPECTED_FIELD';
        message =
          'Unexpected file field. Use field name "file" or "files" depending on the endpoint.';
        break;
      case 'LIMIT_FILE_COUNT':
        code = 'TOO_MANY_FILES';
        message = 'Too many files uploaded. Check the endpoint limit.';
        break;
      default:
        status = HttpStatus.INTERNAL_SERVER_ERROR;
        code = 'UPLOAD_ERROR';
        message = exception.message;
    }

    response.status(status).json({
      success: false,
      code,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}

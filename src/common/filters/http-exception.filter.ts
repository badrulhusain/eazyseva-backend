import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'An unexpected error occurred';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();

      if (typeof body === 'object' && body !== null) {
        const b = body as Record<string, unknown>;
        code = (b.code as string) ?? this.statusToCode(status);
        message = (b.message as string) ?? exception.message;
      } else {
        code = this.statusToCode(status);
        message = exception.message;
      }

      // Log all 5xx HttpExceptions — these are server bugs, not client errors
      if (status >= 500) {
        this.logger.error(
          `[${status}] ${code}: ${message} — ${request.method} ${request.url}`,
          exception.stack,
        );
      }
    } else if (exception instanceof Error) {
      this.logger.error(
        `Unhandled error: ${exception.message} — ${request.method} ${request.url}`,
        exception.stack,
      );
    } else {
      this.logger.error(
        `Unknown exception — ${request.method} ${request.url}`,
        String(exception),
      );
    }

    response.status(status).json({
      success: false,
      code,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }

  private statusToCode(status: number): string {
    const map: Record<number, string> = {
      400: 'VALIDATION_ERROR',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'UNPROCESSABLE_ENTITY',
      429: 'TOO_MANY_REQUESTS',
      500: 'INTERNAL_ERROR',
    };
    return map[status] ?? 'ERROR';
  }
}

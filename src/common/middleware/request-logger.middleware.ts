import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';

/** Requests that take longer than this threshold are logged as warnings. */
const SLOW_REQUEST_THRESHOLD_MS = 1_000;

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction): void {
    const { method, originalUrl } = req;
    const rid = req.requestId ?? '-';
    const start = Date.now();

    res.on('finish', () => {
      const ms = Date.now() - start;
      const { statusCode } = res;
      // Include userId when available (set by JwtAuthGuard after this middleware fires)
      const uid = (req.user as { id?: string } | undefined)?.id ?? '-';
      const logLine = `${method} ${originalUrl} ${statusCode} +${ms}ms rid=${rid} uid=${uid}`;

      if (ms >= SLOW_REQUEST_THRESHOLD_MS && statusCode < 500) {
        // Slow but not an error — warn so it shows up without triggering error alerts
        this.logger.warn(`[SLOW] ${logLine}`);
      } else if (statusCode >= 500) {
        this.logger.error(logLine);
      } else if (statusCode >= 400) {
        this.logger.warn(logLine);
      } else {
        this.logger.log(logLine);
      }
    });

    next();
  }
}

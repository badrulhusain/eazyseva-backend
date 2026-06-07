import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { Request, Response, NextFunction } from 'express';

/**
 * Generates or echoes a request-scoped trace ID.
 *
 * Frontend can supply its own ID via x-request-id header (useful for
 * correlating browser logs with server logs). If not supplied we generate one.
 * The final ID is echoed back in the x-request-id response header so that
 * clients can correlate their request with backend log lines.
 *
 * Must be registered BEFORE RequestLoggerMiddleware so the logger can read
 * req.requestId.
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const incoming = req.headers['x-request-id'];
    const id =
      typeof incoming === 'string' && incoming.length > 0
        ? incoming
        : randomUUID();

    req.requestId = id;
    res.setHeader('x-request-id', id);
    next();
  }
}

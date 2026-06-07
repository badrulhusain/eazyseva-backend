import type { CurrentUser } from '../common/types/current-user.type';

declare global {
  namespace Express {
    interface Request {
      /** Set by RequestIdMiddleware. Generated as crypto.randomUUID() or echoed from x-request-id header. */
      requestId?: string;
      /** Set by JwtAuthGuard after validating the Supabase access token. */
      user?: CurrentUser;
    }
  }
}

export {};

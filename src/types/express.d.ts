declare global {
  namespace Express {
    interface Request {
      /** Set by RequestIdMiddleware. Generated as crypto.randomUUID() or echoed from x-request-id header. */
      requestId?: string;
    }
  }
}

export {};

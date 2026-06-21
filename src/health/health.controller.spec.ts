import { HealthController } from './health.controller';

const mockSupabaseService = {
  admin: {
    from: jest.fn(),
  },
};

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(() => {
    // Construct directly to avoid NestJS DI resolution in unit tests.
    controller = new HealthController(mockSupabaseService as any);
    jest.clearAllMocks();
  });

  describe('GET /api/v1/health (liveness)', () => {
    it('returns status=ok with uptime and timestamp', () => {
      const result = controller.liveness();
      expect(result.status).toBe('ok');
      expect(typeof result.uptime).toBe('number');
      expect(typeof result.timestamp).toBe('string');
    });

    it('uptime is a non-negative number', () => {
      const { uptime } = controller.liveness();
      expect(uptime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('GET /api/v1/health/db (readiness)', () => {
    it('returns success=true when Supabase read succeeds', async () => {
      const limit = jest.fn().mockResolvedValueOnce({ error: null });
      mockSupabaseService.admin.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        limit,
      });

      const result = await controller.readiness();
      expect(result.success).toBe(true);
      expect(result.status).toBe('ok');
      expect((result as any).db?.connected).toBe(true);
      expect(typeof (result as any).db?.latencyMs).toBe('number');
      expect(mockSupabaseService.admin.from).toHaveBeenCalledWith('services');
    });

    it('returns success=false when Supabase read returns an error', async () => {
      const response = { status: jest.fn() };
      const limit = jest.fn().mockResolvedValueOnce({
        error: { message: 'connection refused' },
      });
      mockSupabaseService.admin.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        limit,
      });

      const result = await controller.readiness(response as any);
      expect(result.success).toBe(false);
      expect(result.status).toBe('degraded');
      expect((result as any).db?.connected).toBe(false);
      expect(response.status).toHaveBeenCalledWith(503);
    });

    it('returns success=false when Supabase read throws', async () => {
      const response = { status: jest.fn() };
      const limit = jest.fn().mockRejectedValueOnce(new Error('network error'));
      mockSupabaseService.admin.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        limit,
      });

      const result = await controller.readiness(response as any);
      expect(result.success).toBe(false);
      expect(result.status).toBe('degraded');
      expect(response.status).toHaveBeenCalledWith(503);
    });
  });
});

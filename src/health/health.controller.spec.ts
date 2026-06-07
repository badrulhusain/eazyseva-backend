import { HealthController } from './health.controller';

const mockSupabaseService = {
  admin: {
    rpc: jest.fn(),
  },
};

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(() => {
    // Construct directly to avoid NestJS DI resolution in unit tests.
    controller = new HealthController(mockSupabaseService as any);
    jest.clearAllMocks();
  });

  describe('GET /health (liveness)', () => {
    it('returns success=true with uptime and timestamp', () => {
      const result = controller.liveness();
      expect(result.success).toBe(true);
      expect(result.status).toBe('ok');
      expect(typeof result.uptime).toBe('number');
      expect(typeof result.timestamp).toBe('string');
    });

    it('uptime is a non-negative number', () => {
      const { uptime } = controller.liveness();
      expect(uptime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('GET /health/db (readiness)', () => {
    it('returns success=true when Supabase RPC succeeds', async () => {
      mockSupabaseService.admin.rpc.mockResolvedValueOnce({
        data: 'ES-00001',
        error: null,
      });
      const result = await controller.readiness();
      expect(result.success).toBe(true);
      expect(result.status).toBe('ok');
      expect((result as any).db?.connected).toBe(true);
      expect(typeof (result as any).db?.latencyMs).toBe('number');
    });

    it('returns success=false when Supabase RPC returns an error', async () => {
      mockSupabaseService.admin.rpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'connection refused' },
      });
      const result = await controller.readiness();
      expect(result.success).toBe(false);
      expect(result.status).toBe('degraded');
      expect((result as any).db?.connected).toBe(false);
    });

    it('returns success=false when Supabase RPC throws', async () => {
      mockSupabaseService.admin.rpc.mockRejectedValueOnce(
        new Error('network error'),
      );
      const result = await controller.readiness();
      expect(result.success).toBe(false);
      expect(result.status).toBe('degraded');
    });
  });
});

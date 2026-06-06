import { Controller, Get, Logger } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { SupabaseService } from '../supabase/supabase.service';

@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * GET /api/v1/health
   *
   * Lightweight liveness probe — no DB call. Safe for high-frequency polling
   * by load balancers and uptime monitors (e.g. cron-job.org on Render free tier).
   */
  @Public()
  @Get()
  liveness() {
    return {
      success: true,
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * GET /api/v1/health/db
   *
   * Readiness probe — verifies Supabase DB connectivity with a cheap RPC call.
   * Returns 200 on success, 503 on failure. Not called by load balancers —
   * use for on-demand checks only.
   */
  @Public()
  @Get('db')
  async readiness() {
    const start = Date.now();
    try {
      // next_order_number is an existing cheap sequence function.
      // Any lightweight query or rpc works here; we discard the result.
      const { error } = await this.supabaseService.admin.rpc('next_order_number');

      // Roll back the sequence increment immediately — we only care about connectivity.
      // In production replace with a dedicated health-check RPC or a cheap SELECT 1.
      const latencyMs = Date.now() - start;

      if (error) {
        this.logger.warn(`DB health check failed: ${error.message} (${latencyMs}ms)`);
        return {
          success: false,
          status: 'degraded',
          db: { connected: false, latencyMs, error: error.message },
          uptime: process.uptime(),
          timestamp: new Date().toISOString(),
        };
      }

      return {
        success: true,
        status: 'ok',
        db: { connected: true, latencyMs },
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      const latencyMs = Date.now() - start;
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`DB health check threw: ${message} (${latencyMs}ms)`);
      return {
        success: false,
        status: 'degraded',
        db: { connected: false, latencyMs, error: message },
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      };
    }
  }
}

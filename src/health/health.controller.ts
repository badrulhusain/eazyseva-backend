import { Controller, Get, HttpStatus, Logger, Res } from '@nestjs/common';
import type { Response } from 'express';
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
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * GET /api/v1/health/db
   *
   * Readiness probe — verifies Supabase DB connectivity with a side-effect-free
   * read. Returns 200 on success, 503 on failure.
   */
  @Public()
  @Get('db')
  async readiness(@Res({ passthrough: true }) response?: Response) {
    const start = Date.now();
    try {
      const { error } = await this.supabaseService.admin
        .from('services')
        .select('id', { head: true, count: 'exact' })
        .limit(1);
      const latencyMs = Date.now() - start;

      if (error) {
        response?.status(HttpStatus.SERVICE_UNAVAILABLE);
        this.logger.warn(
          `DB health check failed: ${error.message} (${latencyMs}ms)`,
        );
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
      response?.status(HttpStatus.SERVICE_UNAVAILABLE);
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

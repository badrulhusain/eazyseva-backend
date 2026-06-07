import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import type { AuditAction, AuditTargetType } from './audit-logs.types';

@Injectable()
export class AuditLogsService {
  private readonly logger = new Logger(AuditLogsService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * Records an admin action for the audit trail. Fire-and-forget by design —
   * a logging failure must never block or fail the admin action it describes.
   */
  async record(
    adminId: string | null,
    action: AuditAction,
    targetType: AuditTargetType,
    targetId: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    const { error } = await this.supabaseService.admin
      .from('audit_logs')
      .insert({
        admin_id: adminId,
        action,
        target_type: targetType,
        target_id: targetId,
        metadata: metadata ?? null,
      });

    if (error) {
      this.logger.error(
        `Failed to record audit log: action=${action} target=${targetType}/${targetId}: ${error.message}`,
      );
    }
  }
}

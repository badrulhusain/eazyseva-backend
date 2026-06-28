import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import type { AuditAction, AuditTargetType } from './audit-logs.types';
import type { QueryAuditLogDto } from './dto/query-audit-log.dto';
import type { AdminActivityItem } from '../orders/orders.types';

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

  async findRecent(query: QueryAuditLogDto): Promise<{
    data: AdminActivityItem[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { page, limit } = query;
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const { data, error, count } = await this.supabaseService.admin
      .from('audit_logs')
      .select(
        'id, admin_id, action, target_type, target_id, metadata, created_at',
        { count: 'exact' },
      )
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      this.logger.error(`Failed to load audit logs: ${error.message}`);
      throw new InternalServerErrorException({
        code: 'ACTIVITY_UNAVAILABLE',
        message: 'Recent activity is temporarily unavailable',
      });
    }

    const rows = (data ?? []) as Array<{
      id: string;
      admin_id: string | null;
      action: string;
      target_type: string;
      target_id: string;
      metadata: Record<string, unknown> | null;
      created_at: string;
    }>;
    const adminIds = [
      ...new Set(
        rows
          .map((row) => row.admin_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const names = new Map<string, string>();

    if (adminIds.length > 0) {
      const { data: profiles, error: profileError } =
        await this.supabaseService.admin
          .from('profiles')
          .select('id, full_name, email')
          .in('id', adminIds);

      if (profileError) {
        this.logger.warn(
          `Audit log admin names unavailable: ${profileError.message}`,
        );
      } else {
        for (const profile of profiles ?? []) {
          names.set(
            profile.id as string,
            (profile.full_name as string | null) ||
              (profile.email as string | null) ||
              'Administrator',
          );
        }
      }
    }

    return {
      data: rows.map((row) => ({
        id: row.id,
        action: row.action,
        targetType: row.target_type,
        targetId: row.target_id,
        metadata: row.metadata,
        createdAt: row.created_at,
        admin: {
          id: row.admin_id,
          name: row.admin_id
            ? (names.get(row.admin_id) ?? 'Administrator')
            : 'System',
        },
      })),
      total: count ?? 0,
      page,
      limit,
    };
  }
}

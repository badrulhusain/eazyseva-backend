      import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { UploadsService } from '../uploads/uploads.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import type { OrderDocumentRow } from './documents.types';

const DEFAULT_RETENTION_DAYS = 30;

/** Minimal shape this service needs from an order's document entries. */
export interface TrackableDocument {
  name: string;
  url: string;
  publicId?: string;
  originalName?: string;
  format?: string;
  bytes?: number;
}

/** Cloudinary stores PDFs as 'raw' resources and everything else as 'image' (mirrors uploads/constants/allowed-file-types.ts resolveResourceType, keyed off the stored format instead of a full MIME type). */
function resourceTypeForFormat(format: string | null): 'image' | 'raw' {
  return format === 'pdf' ? 'raw' : 'image';
}

@Injectable()
export class OrderDocumentsService {
  private readonly logger = new Logger(OrderDocumentsService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly uploadsService: UploadsService,
    private readonly auditLogsService: AuditLogsService,
    private readonly config: ConfigService,
  ) {}

  private get retentionDays(): number {
    return (
      this.config.get<number>('DOCUMENT_RETENTION_DAYS') ??
      DEFAULT_RETENTION_DAYS
    );
  }

  /**
   * Records lifecycle-tracking rows for an order's Cloudinary-managed documents
   * (only entries that carry a publicId can be deleted later by public_id).
   * Best-effort: a tracking failure must not fail order creation.
   */
  async trackDocuments(
    orderId: string,
    userId: string,
    documents: TrackableDocument[],
  ): Promise<void> {
    const trackable = documents.filter((doc) => !!doc.publicId);
    if (trackable.length === 0) return;

    const rows = trackable.map((doc) => ({
      order_id: orderId,
      user_id: userId,
      cloudinary_public_id: doc.publicId,
      secure_url: doc.url,
      original_name: doc.originalName ?? doc.name ?? null,
      mime_type: doc.format ?? null,
      size: doc.bytes ?? null,
      status: 'active',
    }));

    const { error } = await this.supabaseService.admin
      .from('order_documents')
      .insert(rows);
    if (error) {
      this.logger.error(
        `Failed to track documents for order=${orderId}: ${error.message}`,
      );
    }
  }

  /**
   * Marks an order's active documents as scheduled for deletion, due
   * `retentionDays` (default DOCUMENT_RETENTION_DAYS) after now.
   */
  async scheduleForDeletion(orderId: string, adminId: string): Promise<void> {
    const deleteAfter = new Date(
      Date.now() + this.retentionDays * 24 * 60 * 60 * 1000,
    ).toISOString();

    const { data, error } = await this.supabaseService.admin
      .from('order_documents')
      .update({
        status: 'scheduled_for_deletion',
        delete_after: deleteAfter,
      })
      .eq('order_id', orderId)
      .eq('status', 'active')
      .select('id');

    if (error) {
      this.logger.error(
        `Failed to schedule documents for deletion order=${orderId}: ${error.message}`,
      );
      return;
    }

    const ids = ((data ?? []) as { id: string }[]).map((row) => row.id);
    if (ids.length === 0) return;

    this.logger.log(
      `Scheduled ${ids.length} document(s) for deletion: order=${orderId} deleteAfter=${deleteAfter}`,
    );
    await this.auditLogsService.record(
      adminId,
      'DOCUMENT_SCHEDULED_FOR_DELETION',
      'document',
      orderId,
      {
        documentIds: ids,
        deleteAfter,
      },
    );
  }

  /**
   * Deletes every document whose `delete_after` has passed from Cloudinary
   * and updates its lifecycle status. Designed to be triggered by an external
   * cron hitting POST /admin/documents/process-deletions (no in-process
   * scheduler dependency — mirrors the health-check cron pattern).
   */
  async processDueDeletions(
    adminId: string,
  ): Promise<{ processed: number; deleted: number; failed: number }> {
    const { data, error } = await this.supabaseService.admin
      .from('order_documents')
      .select('id, cloudinary_public_id, mime_type')
      .eq('status', 'scheduled_for_deletion')
      .lte('delete_after', new Date().toISOString());

    if (error) {
      throw new InternalServerErrorException({
        code: 'DB_ERROR',
        message: error.message,
      });
    }

    const due = (data ?? []) as Pick<
      OrderDocumentRow,
      'id' | 'cloudinary_public_id' | 'mime_type'
    >[];
    let deleted = 0;
    let failed = 0;

    for (const doc of due) {
      try {
        await this.uploadsService.deleteDocument(
          doc.cloudinary_public_id,
          resourceTypeForFormat(doc.mime_type),
        );
        await this.markDeleted(doc.id);
        await this.auditLogsService.record(
          adminId,
          'DOCUMENT_DELETED',
          'document',
          doc.id,
          {
            publicId: doc.cloudinary_public_id,
          },
        );
        deleted++;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Cloudinary deletion failed';
        await this.markDeletionFailed(doc.id, message);
        await this.auditLogsService.record(
          adminId,
          'DOCUMENT_DELETION_FAILED',
          'document',
          doc.id,
          {
            publicId: doc.cloudinary_public_id,
            error: message,
          },
        );
        this.logger.error(
          `Document deletion failed id=${doc.id} publicId=${doc.cloudinary_public_id}: ${message}`,
        );
        failed++;
      }
    }

    return { processed: due.length, deleted, failed };
  }

  // ── Internal helpers ───────────────────────────────────────────────

  private async markDeleted(id: string): Promise<void> {
    const { error } = await this.supabaseService.admin
      .from('order_documents')
      .update({
        status: 'deleted',
        deleted_at: new Date().toISOString(),
        deletion_error: null,
      })
      .eq('id', id);

    if (error)
      this.logger.error(
        `Failed to mark document deleted id=${id}: ${error.message}`,
      );
  }

  private async markDeletionFailed(id: string, message: string): Promise<void> {
    const { error } = await this.supabaseService.admin
      .from('order_documents')
      .update({
        status: 'deletion_failed',
        deletion_error: message,
      })
      .eq('id', id);

    if (error)
      this.logger.error(
        `Failed to mark document deletion_failed id=${id}: ${error.message}`,
      );
  }
}

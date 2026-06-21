import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { OrderDocumentsService } from '../documents/documents.service';
import type { AuditAction } from '../audit-logs/audit-logs.types';
import type { CreateOrderDto } from './dto/create-order.dto';
import type { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import type { RejectOrderDto } from './dto/reject-order.dto';
import type { RequestCorrectionDto } from './dto/request-correction.dto';
import type {
  AdminOrderSummary,
  Order,
  OrderRow,
  OrderStatus,
  TimelineEntry,
} from './orders.types';
import type { PaginationDto } from '../common/dto/pagination.dto';

// Columns fetched for user-facing single order and my-orders list.
const ORDER_FULL_COLS =
  'id, order_number, user_id, service_type, customer_name, customer_phone, ' +
  'customer_dob, customer_address, documents, price_government_fee, ' +
  'price_service_charge, price_document_handling, price_total, status, ' +
  'payment_status, payment_method, demo_transaction_id, payment_currency, ' +
  'paid_at, payment_failure_reason, timeline, ' +
  'rejection_reason, admin_note, reviewed_by, reviewed_at, ' +
  'created_at, updated_at';

// Lightweight columns for admin list — avoids sending documents/timeline JSON
// over the wire for every row in a paginated list.
const ORDER_LIST_COLS =
  'id, order_number, service_type, customer_name, customer_phone, status, ' +
  'payment_status, price_total, created_at, updated_at';

// Valid forward transitions. Terminal states map to empty arrays.
const STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['UNDER_REVIEW', 'ACCEPTED', 'REJECTED', 'CANCELLED'],
  UNDER_REVIEW: ['ACCEPTED', 'REJECTED', 'CORRECTION_REQUESTED', 'CANCELLED'],
  CORRECTION_REQUESTED: ['UNDER_REVIEW', 'ACCEPTED', 'REJECTED', 'CANCELLED'],
  ACCEPTED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['COMPLETED'],
  COMPLETED: [],
  REJECTED: [],
  CANCELLED: [],
};

// Maps a resulting status to the audit action recorded for it — applies no
// matter which endpoint (dedicated action or generic PATCH .../status) drove
// the transition, so the audit trail stays complete either way.
const STATUS_AUDIT_ACTIONS: Partial<Record<OrderStatus, AuditAction>> = {
  ACCEPTED: 'ADMIN_ACCEPTED_ORDER',
  REJECTED: 'ADMIN_REJECTED_ORDER',
  CORRECTION_REQUESTED: 'ADMIN_REQUESTED_CORRECTION',
  COMPLETED: 'ADMIN_COMPLETED_ORDER',
};

interface SupabaseErrorLike {
  code?: string;
  message: string;
}

interface PaginatedOrders<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

function buildTimelineEvent(status: OrderStatus, reason?: string): string {
  switch (status) {
    case 'UNDER_REVIEW':
      return 'Order moved under review';
    case 'ACCEPTED':
      return 'Order accepted by admin';
    case 'CORRECTION_REQUESTED':
      return reason
        ? `Correction requested: ${reason}`
        : 'Correction requested';
    case 'PROCESSING':
      return 'Order is being processed';
    case 'COMPLETED':
      return 'Order completed';
    case 'REJECTED':
      return reason ? `Order rejected: ${reason}` : 'Order rejected';
    case 'CANCELLED':
      return reason ? `Order cancelled: ${reason}` : 'Order cancelled';
    default:
      return `Status changed to ${status}`;
  }
}

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly auditLogsService: AuditLogsService,
    private readonly orderDocumentsService: OrderDocumentsService,
  ) {}

  // Services table changes rarely (admin-only writes). Cache for 30 seconds to stay
  // within one price-update cycle while avoiding a Supabase RTT on every order.
  private readonly servicesCache = new Map<
    string,
    {
      data: {
        id: string;
        price: number;
        govt_fee: number;
        processing_fee: number;
      } | null;
      expiresAt: number;
    }
  >();
  private readonly SERVICES_CACHE_TTL = 30_000;

  // ── User: create order ────────────────────────────────────────────

  async create(dto: CreateOrderDto, userId: string): Promise<Order> {
    // ── Server-side price lookup from service catalog ──────────────
    // Never trust price values from the frontend. Prices come from the
    // services table only. serviceType must match an active service slug.
    const service = await this.getServiceBySlug(dto.serviceType);

    if (!service) {
      throw new BadRequestException({
        code: 'INVALID_SERVICE',
        message: `Service "${dto.serviceType}" not found or is not currently available.`,
      });
    }

    const governmentFee = Number(service.govt_fee ?? 0);
    const serviceCharge = Number(service.processing_fee ?? 0);
    const documentHandling = 0;
    const total =
      Number(service.price) + governmentFee + serviceCharge + documentHandling;

    // ── Generate unique order number (atomic, race-condition safe) ──
    const orderNumberResult = (await this.supabaseService.admin.rpc(
      'next_order_number',
    )) as { data: string | null; error: SupabaseErrorLike | null };
    const { data: orderNumber, error: seqError } = orderNumberResult;

    if (seqError || !orderNumber) {
      throw new InternalServerErrorException({
        code: 'ORDER_NUMBER_FAILED',
        message: 'Failed to generate order number',
      });
    }

    // ── Insert order row ────────────────────────────────────────────
    const insertResult = (await this.supabaseService.admin
      .from('orders')
      .insert({
        order_number: orderNumber,
        user_id: userId,
        service_type: dto.serviceType,
        customer_name: dto.customer.name,
        customer_phone: dto.customer.phone,
        customer_dob: dto.customer.dateOfBirth,
        customer_address: dto.customer.address,
        documents: dto.documents ?? [],
        price_government_fee: governmentFee,
        price_service_charge: serviceCharge,
        price_document_handling: documentHandling,
        price_total: total,
        status: 'PENDING',
        payment_status: 'NOT_PAID',
      })
      .select()
      .single()) as { data: OrderRow | null; error: SupabaseErrorLike | null };
    const { data, error } = insertResult;

    if (error || !data) {
      throw new InternalServerErrorException({
        code: 'DB_ERROR',
        message: error?.message ?? 'Failed to create order',
      });
    }

    const order = OrdersService.formatRow(data);
    this.logger.log(
      `Order created: ${order.orderNumber} user=${userId} total=${total}`,
    );

    // Best-effort lifecycle tracking for Cloudinary-managed documents — must
    // never fail order creation itself.
    this.orderDocumentsService
      .trackDocuments(order.id, userId, dto.documents ?? [])
      .catch((err) => {
        this.logger.error(
          `Failed to track documents for order=${order.id}: ${err instanceof Error ? err.message : err}`,
        );
      });

    return order;
  }

  // ── User: list own orders ─────────────────────────────────────────

  async findMyOrders(
    userId: string,
    pagination: PaginationDto,
  ): Promise<PaginatedOrders<Order>> {
    const { page, limit, status, search, dateFrom, dateTo } = pagination;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = this.supabaseService.admin
      .from('orders')
      .select(ORDER_FULL_COLS, { count: 'planned' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (status) {
      query = query.eq('status', status);
    }

    if (search?.trim()) {
      const term = `%${search.trim()}%`;
      query = query.or(
        `order_number.ilike.${term},customer_name.ilike.${term},customer_phone.ilike.${term}`,
      );
    }

    if (dateFrom) {
      query = query.gte('created_at', dateFrom);
    }

    if (dateTo) {
      query = query.lte('created_at', dateTo);
    }

    const { data, error, count } = await query;

    if (error) {
      throw new InternalServerErrorException({
        code: 'DB_ERROR',
        message: error.message,
      });
    }

    return {
      data: ((data ?? []) as unknown as OrderRow[]).map((row) =>
        OrdersService.formatRow(row),
      ),
      total: count ?? 0,
      page,
      limit,
    };
  }

  // ── User: get single order ────────────────────────────────────────

  async findOne(id: string, userId: string): Promise<Order> {
    // Filter by both id AND user_id in one query — return 404 for both
    // "not found" and "owned by another user" to avoid leaking existence.
    const { data, error } = await this.supabaseService.admin
      .from('orders')
      .select(ORDER_FULL_COLS)
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new NotFoundException({
          code: 'ORDER_NOT_FOUND',
          message: 'Order not found',
        });
      }
      this.logger.error(
        `findOne db error id=${id} uid=${userId}: [${error.code}] ${error.message}`,
      );
      throw new InternalServerErrorException({
        code: 'DB_ERROR',
        message: error.message,
      });
    }

    if (!data) {
      throw new NotFoundException({
        code: 'ORDER_NOT_FOUND',
        message: 'Order not found',
      });
    }

    return OrdersService.formatRow(data as unknown as OrderRow);
  }

  // ── Admin: paginated list ─────────────────────────────────────────

  async findAll(pagination: PaginationDto): Promise<{
    data: AdminOrderSummary[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { page, limit, status, search, dateFrom, dateTo } = pagination;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    // Use lightweight column list — full order data is available via findOneAdmin.
    // count:'planned' uses the PostgreSQL query planner's row estimate; it is
    // instantaneous but may differ from the exact count by a few percent.
    // Acceptable for pagination UI; use count:'exact' if you need precise counts.
    let query = this.supabaseService.admin
      .from('orders')
      .select(ORDER_LIST_COLS, { count: 'planned' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (status) {
      query = query.eq('status', status);
    }

    if (search?.trim()) {
      const term = `%${search.trim()}%`;
      query = query.or(
        `order_number.ilike.${term},customer_name.ilike.${term},customer_phone.ilike.${term}`,
      );
    }

    if (dateFrom) {
      query = query.gte('created_at', dateFrom);
    }

    if (dateTo) {
      query = query.lte('created_at', dateTo);
    }

    const { data, error, count } = await query;

    if (error) {
      throw new InternalServerErrorException({
        code: 'DB_ERROR',
        message: error.message,
      });
    }

    return {
      data: ((data ?? []) as unknown as Partial<OrderRow>[]).map((row) =>
        OrdersService.formatListRow(row),
      ),
      total: count ?? 0,
      page,
      limit,
    };
  }

  // ── Admin: single order (full detail) ────────────────────────────

  async findOneAdmin(id: string): Promise<Order> {
    const { data, error } = await this.supabaseService.admin
      .from('orders')
      .select(ORDER_FULL_COLS)
      .eq('id', id)
      .single();

    if (error) {
      // PGRST116 = PostgREST "no rows returned" for .single() — genuine 404.
      // Any other code is a real DB/schema error that must surface as 500.
      if (error.code === 'PGRST116') {
        throw new NotFoundException({
          code: 'ORDER_NOT_FOUND',
          message: 'Order not found',
        });
      }
      this.logger.error(
        `findOneAdmin db error id=${id}: [${error.code}] ${error.message}`,
      );
      throw new InternalServerErrorException({
        code: 'DB_ERROR',
        message: error.message,
      });
    }

    if (!data) {
      throw new NotFoundException({
        code: 'ORDER_NOT_FOUND',
        message: 'Order not found',
      });
    }

    return OrdersService.formatRow(data as unknown as OrderRow);
  }

  // ── Admin: update status (generic — kept for backward-compat with the ─────
  // existing admin frontend, which calls PATCH /admin/orders/:id/status for
  // transitions that have no dedicated action endpoint, e.g. PROCESSING,
  // UNDER_REVIEW, CANCELLED). Dedicated endpoints below cover the spec'd
  // accept/reject/request-correction/complete actions with stricter DTOs.

  async updateStatus(
    id: string,
    dto: UpdateOrderStatusDto,
    adminId: string,
  ): Promise<Order> {
    // Belt-and-suspenders guard: DTO @ValidateIf handles HTTP, this covers
    // any direct programmatic call.
    if (
      (dto.status === 'REJECTED' || dto.status === 'CORRECTION_REQUESTED') &&
      !dto.reason?.trim()
    ) {
      throw new BadRequestException({
        code: 'REASON_REQUIRED',
        message:
          'A reason is required when rejecting an order or requesting a correction',
      });
    }

    return this.applyStatusChange(id, dto.status, adminId, {
      reason: dto.reason,
      adminNote: dto.adminNote,
    });
  }

  // ── Admin: dedicated review-workflow actions ──────────────────────

  async acceptOrder(id: string, adminId: string): Promise<Order> {
    return this.applyStatusChange(id, 'ACCEPTED', adminId);
  }

  async rejectOrder(
    id: string,
    dto: RejectOrderDto,
    adminId: string,
  ): Promise<Order> {
    return this.applyStatusChange(id, 'REJECTED', adminId, {
      reason: dto.note,
    });
  }

  async requestCorrection(
    id: string,
    dto: RequestCorrectionDto,
    adminId: string,
  ): Promise<Order> {
    return this.applyStatusChange(id, 'CORRECTION_REQUESTED', adminId, {
      reason: dto.note,
    });
  }

  async completeOrder(id: string, adminId: string): Promise<Order> {
    return this.applyStatusChange(id, 'COMPLETED', adminId);
  }

  // ── Helpers ───────────────────────────────────────────────────────

  /**
   * Shared status-transition machinery for both the generic update endpoint
   * and the dedicated accept/reject/request-correction/complete actions:
   * validates the transition, appends a timeline entry, persists the row,
   * fires the matching audit log, and (for COMPLETED) schedules the order's
   * documents for deletion. Single source of truth so the audit trail and
   * document lifecycle stay correct no matter which endpoint drove the change.
   */
  private async applyStatusChange(
    id: string,
    nextStatus: OrderStatus,
    adminId: string,
    opts: { reason?: string; adminNote?: string } = {},
  ): Promise<Order> {
    const current = await this.findOneAdmin(id);
    this.assertValidTransition(current.status, nextStatus);

    const now = new Date().toISOString();
    const timelineEntry: TimelineEntry = {
      event: buildTimelineEvent(nextStatus, opts.reason),
      timestamp: now,
    };

    const updatePayload: Record<string, unknown> = {
      status: nextStatus,
      timeline: [...(current.timeline ?? []), timelineEntry],
      reviewed_by: adminId,
      reviewed_at: now,
    };

    if (nextStatus === 'REJECTED') {
      updatePayload.rejection_reason = opts.reason!.trim();
    }
    if (nextStatus === 'CORRECTION_REQUESTED') {
      updatePayload.admin_note = opts.reason!.trim();
    }
    if (opts.adminNote?.trim()) {
      updatePayload.admin_note = opts.adminNote.trim();
    }

    const { data, error } = await this.supabaseService.admin
      .from('orders')
      .update(updatePayload)
      .eq('id', id)
      .select(ORDER_FULL_COLS)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new NotFoundException({
          code: 'ORDER_NOT_FOUND',
          message: 'Order not found',
        });
      }
      this.logger.error(
        `applyStatusChange db error id=${id}: [${error.code}] ${error.message}`,
      );
      throw new InternalServerErrorException({
        code: 'DB_ERROR',
        message: error.message,
      });
    }

    if (!data) {
      throw new NotFoundException({
        code: 'ORDER_NOT_FOUND',
        message: 'Order not found',
      });
    }

    const updated = OrdersService.formatRow(data as unknown as OrderRow);
    this.logger.log(
      `Order ${updated.orderNumber} status: ${current.status} → ${nextStatus} by admin=${adminId}`,
    );

    const auditAction = STATUS_AUDIT_ACTIONS[nextStatus];
    if (auditAction) {
      // Fire-and-forget — AuditLogsService.record() never throws (it logs and swallows its own errors).
      void this.auditLogsService.record(
        adminId,
        auditAction,
        'order',
        updated.id,
        {
          orderNumber: updated.orderNumber,
          previousStatus: current.status,
          ...(opts.reason ? { reason: opts.reason.trim() } : {}),
        },
      );
    }

    if (nextStatus === 'COMPLETED') {
      this.orderDocumentsService
        .scheduleForDeletion(updated.id, adminId)
        .catch((err) => {
          this.logger.error(
            `Failed to schedule documents for deletion order=${updated.id}: ${err instanceof Error ? err.message : err}`,
          );
        });
    }

    return updated;
  }

  /** Call after an admin creates/updates/deletes a service so stale prices aren't used. */
  invalidateServiceCache(slug?: string): void {
    if (slug) {
      this.servicesCache.delete(slug);
    } else {
      this.servicesCache.clear();
    }
  }

  private assertValidTransition(current: OrderStatus, next: OrderStatus): void {
    const allowed = STATUS_TRANSITIONS[current];
    if (!allowed.includes(next)) {
      const terminalMsg =
        allowed.length === 0
          ? `Status "${current}" is final and cannot be changed.`
          : `Cannot transition from "${current}" to "${next}". Allowed: ${allowed.join(', ')}.`;
      throw new BadRequestException({
        code: 'INVALID_STATUS_TRANSITION',
        message: terminalMsg,
      });
    }
  }

  private async getServiceBySlug(slug: string) {
    const cached = this.servicesCache.get(slug);
    if (cached && cached.expiresAt > Date.now()) return cached.data;

    const { data, error } = await this.supabaseService.admin
      .from('services')
      .select('id, price, govt_fee, processing_fee')
      .eq('slug', slug)
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException({
        code: 'DB_ERROR',
        message: error.message,
      });
    }

    this.servicesCache.set(slug, {
      data: data ?? null,
      expiresAt: Date.now() + this.SERVICES_CACHE_TTL,
    });
    return data ?? null;
  }

  private static formatRow(row: OrderRow): Order {
    return {
      id: row.id,
      orderNumber: row.order_number,
      userId: row.user_id,
      serviceType: row.service_type,
      customer: {
        name: row.customer_name,
        phone: row.customer_phone,
        dateOfBirth: row.customer_dob,
        address: row.customer_address,
      },
      documents: row.documents,
      price: {
        governmentFee: Number(row.price_government_fee),
        serviceCharge: Number(row.price_service_charge),
        documentHandling: Number(row.price_document_handling),
        total: Number(row.price_total),
      },
      status: row.status,
      paymentStatus: row.payment_status,
      payment: {
        method: row.payment_method ?? null,
        demoTransactionId: row.demo_transaction_id ?? null,
        amount: Number(row.price_total),
        currency: row.payment_currency ?? 'INR',
        paidAt: row.paid_at ?? null,
        failureReason: row.payment_failure_reason ?? null,
      },
      timeline: row.timeline ?? [],
      rejectionReason: row.rejection_reason ?? null,
      adminNote: row.admin_note ?? null,
      reviewedBy: row.reviewed_by ?? null,
      reviewedAt: row.reviewed_at ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private static formatListRow(row: Partial<OrderRow>): AdminOrderSummary {
    return {
      id: row.id!,
      orderNumber: row.order_number!,
      serviceType: row.service_type!,
      customerName: row.customer_name!,
      customerPhone: row.customer_phone!,
      status: row.status!,
      paymentStatus: row.payment_status!,
      priceTotal: Number(row.price_total),
      createdAt: row.created_at!,
      updatedAt: row.updated_at!,
    };
  }
}

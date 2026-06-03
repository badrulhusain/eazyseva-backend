import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import type { CreateOrderDto } from './dto/create-order.dto';
import type { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import type { Order, OrderRow } from './orders.types';
import type { PaginationDto } from '../common/dto/pagination.dto';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);
  constructor(private readonly supabaseService: SupabaseService) {}

  // Services table changes rarely (admin-only writes). Cache for 30 seconds to stay
  // within one price-update cycle while avoiding a Supabase RTT on every order.
  private readonly servicesCache = new Map<string, {
    data: { id: string; price: number; govt_fee: number; processing_fee: number } | null;
    expiresAt: number;
  }>();
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
    const total = Number(service.price) + governmentFee + serviceCharge + documentHandling;

    // ── Generate unique order number (atomic, race-condition safe) ──
    const { data: orderNumber, error: seqError } =
      await this.supabaseService.admin.rpc('next_order_number');

    if (seqError || !orderNumber) {
      throw new InternalServerErrorException({
        code: 'ORDER_NUMBER_FAILED',
        message: 'Failed to generate order number',
      });
    }

    // ── Insert order row ────────────────────────────────────────────
    const { data, error } = await this.supabaseService.admin
      .from('orders')
      .insert({
        order_number: orderNumber as string,
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
      .single();

    if (error || !data) {
      throw new InternalServerErrorException({
        code: 'DB_ERROR',
        message: error?.message ?? 'Failed to create order',
      });
    }

    const order = OrdersService.formatRow(data as OrderRow);
    this.logger.log(`Order created: ${order.orderNumber} user=${userId} total=${total}`);
    return order;
  }

  // ── User: list own orders ─────────────────────────────────────────

  async findMyOrders(userId: string): Promise<Order[]> {
    const { data, error } = await this.supabaseService.admin
      .from('orders')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new InternalServerErrorException({ code: 'DB_ERROR', message: error.message });
    }

    return ((data ?? []) as OrderRow[]).map(OrdersService.formatRow);
  }

  // ── User: get single order ────────────────────────────────────────

  async findOne(id: string, userId: string): Promise<Order> {
    const { data, error } = await this.supabaseService.admin
      .from('orders')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new NotFoundException({ code: 'ORDER_NOT_FOUND', message: 'Order not found' });
    }

    const row = data as OrderRow;

    // Return 404 (not 403) to avoid leaking that another user's order exists
    if (row.user_id !== userId) {
      throw new NotFoundException({ code: 'ORDER_NOT_FOUND', message: 'Order not found' });
    }

    return OrdersService.formatRow(row);
  }

  // ── Admin: paginated list ─────────────────────────────────────────

  async findAll(
    pagination: PaginationDto,
  ): Promise<{ data: Order[]; total: number; page: number; limit: number }> {
    const { page, limit, status } = pagination;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = this.supabaseService.admin
      .from('orders')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error, count } = await query;

    if (error) {
      throw new InternalServerErrorException({ code: 'DB_ERROR', message: error.message });
    }

    return {
      data: ((data ?? []) as OrderRow[]).map(OrdersService.formatRow),
      total: count ?? 0,
      page,
      limit,
    };
  }

  // ── Admin: single order ───────────────────────────────────────────

  async findOneAdmin(id: string): Promise<Order> {
    const { data, error } = await this.supabaseService.admin
      .from('orders')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new NotFoundException({ code: 'ORDER_NOT_FOUND', message: 'Order not found' });
    }

    return OrdersService.formatRow(data as OrderRow);
  }

  // ── Admin: update status ──────────────────────────────────────────

  async updateStatus(id: string, dto: UpdateOrderStatusDto): Promise<Order> {
    const { data, error } = await this.supabaseService.admin
      .from('orders')
      .update({ status: dto.status })
      .eq('id', id)
      .select()
      .single();

    if (error || !data) {
      throw new NotFoundException({ code: 'ORDER_NOT_FOUND', message: 'Order not found' });
    }

    return OrdersService.formatRow(data as OrderRow);
  }

  // ── Helpers ───────────────────────────────────────────────────────

  /** Call after an admin creates/updates/deletes a service so stale prices aren't used. */
  invalidateServiceCache(slug?: string): void {
    if (slug) {
      this.servicesCache.delete(slug);
    } else {
      this.servicesCache.clear();
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
      throw new InternalServerErrorException({ code: 'DB_ERROR', message: error.message });
    }

    this.servicesCache.set(slug, { data: data ?? null, expiresAt: Date.now() + this.SERVICES_CACHE_TTL });
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
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

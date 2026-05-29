import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import type { CreateOrderDto } from './dto/create-order.dto';
import type { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import type { Order, OrderRow } from './orders.types';

@Injectable()
export class OrdersService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async create(dto: CreateOrderDto, userId: string): Promise<Order> {
    const { data: orderNumber, error: seqError } =
      await this.supabaseService.admin.rpc('next_order_number');

    if (seqError || !orderNumber) {
      throw new InternalServerErrorException({
        code: 'ORDER_NUMBER_FAILED',
        message: 'Failed to generate order number',
      });
    }

    // TODO(Phase 3): Replace with server-calculated price from service catalog.
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
        price_government_fee: dto.price.governmentFee ?? 0,
        price_service_charge: dto.price.serviceCharge ?? 0,
        price_document_handling: dto.price.documentHandling ?? 0,
        price_total: dto.price.total,
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

    return OrdersService.formatRow(data as OrderRow);
  }

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

  // ── Admin ─────────────────────────────────────────────────────────

  async findAll(): Promise<Order[]> {
    const { data, error } = await this.supabaseService.admin
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw new InternalServerErrorException({ code: 'DB_ERROR', message: error.message });
    }

    return ((data ?? []) as OrderRow[]).map(OrdersService.formatRow);
  }

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
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

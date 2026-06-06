// ── VIRTUAL PAYMENT PROTOTYPE ─────────────────────────────────────────────────
// This module simulates a payment flow for demo / client-presentation purposes
// ONLY. No real money is collected. No real payment gateway is used.
// To integrate a real gateway (Razorpay, Stripe, etc.) replace the methods
// below with SDK calls and update the payment_status enum accordingly.
// ─────────────────────────────────────────────────────────────────────────────
import { randomBytes } from 'crypto';
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { StartDemoPaymentDto } from './dto/start-demo-payment.dto';
import { ConfirmDemoPaymentDto } from './dto/confirm-demo-payment.dto';
import { PaymentStatus } from './enums/payment-status.enum';
import { DemoPaymentMethod } from './enums/demo-payment-method.enum';
import { DemoPaymentResult } from './enums/demo-payment-result.enum';
import type { OrderRow } from '../orders/orders.types';

// Sessions stuck in PAYMENT_PENDING longer than this are auto-reset on the
// next start attempt so users don't have to call /reset manually.
const PAYMENT_PENDING_TIMEOUT_MS = 15 * 60_000;

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  constructor(private readonly supabaseService: SupabaseService) {}

  // ── POST /payments/demo/start ──────────────────────────────────

  async startPayment(dto: StartDemoPaymentDto, userId: string) {
    const order = await this.findOrderForUser(dto.orderId, userId);

    if (order.payment_status === PaymentStatus.PAID) {
      throw new BadRequestException({
        code: 'ALREADY_PAID',
        message: 'This order has already been paid.',
      });
    }

    if (order.payment_status === PaymentStatus.PAYMENT_PENDING) {
      const sessionAge = Date.now() - new Date(order.updated_at).getTime();
      if (sessionAge < PAYMENT_PENDING_TIMEOUT_MS) {
        throw new BadRequestException({
          code: 'PAYMENT_IN_PROGRESS',
          message: 'A payment is already in progress. Confirm or retry the existing session.',
        });
      }
      // Session is stale — auto-reset so the user can start fresh without calling /reset
      this.logger.warn(`Auto-resetting stale PAYMENT_PENDING session for order ${dto.orderId}`);
      await this.supabaseService.admin
        .from('orders')
        .update({ payment_status: PaymentStatus.NOT_PAID, demo_transaction_id: null, payment_method: null })
        .eq('id', dto.orderId);
    }

    const demoTransactionId = this.generateDemoTransactionId();
    const amount = Number(order.price_total);
    const currency = 'INR';

    const timeline = this.appendTimeline(order.timeline, `Demo payment started via ${dto.method}`);

    const { error } = await this.supabaseService.admin
      .from('orders')
      .update({
        payment_status: PaymentStatus.PAYMENT_PENDING,
        payment_method: dto.method,
        demo_transaction_id: demoTransactionId,
        payment_currency: currency,
        timeline,
      })
      .eq('id', dto.orderId);

    if (error) {
      throw new InternalServerErrorException({ code: 'DB_ERROR', message: error.message });
    }

    this.logger.log(`Payment started: order=${dto.orderId} txn=${demoTransactionId} method=${dto.method}`);

    return {
      success: true,
      message: 'Demo payment started',
      paymentSession: {
        orderId: order.id,
        orderNumber: order.order_number,
        amount,
        currency,
        method: dto.method,
        demoTransactionId,
        status: PaymentStatus.PAYMENT_PENDING,
      },
    };
  }

  // ── POST /payments/demo/confirm ────────────────────────────────

  async confirmPayment(dto: ConfirmDemoPaymentDto, userId: string) {
    const order = await this.findOrderForUser(dto.orderId, userId);

    if (order.payment_status !== PaymentStatus.PAYMENT_PENDING) {
      throw new BadRequestException({
        code: 'INVALID_PAYMENT_STATE',
        message: 'No pending payment found for this order. Call /start first.',
      });
    }

    if (order.demo_transaction_id !== dto.demoTransactionId) {
      throw new BadRequestException({
        code: 'TRANSACTION_ID_MISMATCH',
        message: 'Transaction ID does not match the active payment session.',
      });
    }

    const isSuccess = dto.result === DemoPaymentResult.SUCCESS;
    const now = new Date().toISOString();

    const timeline = this.appendTimeline(
      order.timeline,
      isSuccess ? 'Payment completed successfully' : 'Payment failed',
    );

    const updatePayload: Record<string, unknown> = {
      payment_status: isSuccess ? PaymentStatus.PAID : PaymentStatus.FAILED,
      timeline,
    };

    if (isSuccess) {
      updatePayload.paid_at = now;
    } else {
      updatePayload.payment_failure_reason = 'Demo payment failed (simulated by client)';
    }

    const { data, error } = await this.supabaseService.admin
      .from('orders')
      .update(updatePayload)
      .eq('id', dto.orderId)
      .select()
      .single();

    if (error || !data) {
      throw new InternalServerErrorException({
        code: 'DB_ERROR',
        message: error?.message ?? 'Failed to confirm payment',
      });
    }

    const row = data as OrderRow;

    this.logger.log(
      `Payment ${isSuccess ? 'succeeded' : 'failed'}: order=${dto.orderId} txn=${dto.demoTransactionId}`,
    );

    return {
      success: true,
      message: isSuccess ? 'Payment successful' : 'Payment failed',
      payment: {
        orderId: row.id,
        orderNumber: row.order_number,
        amount: Number(row.price_total),
        currency: row.payment_currency ?? 'INR',
        method: row.payment_method,
        demoTransactionId: row.demo_transaction_id,
        paymentStatus: row.payment_status,
        paidAt: row.paid_at ?? null,
        failureReason: row.payment_failure_reason ?? null,
      },
    };
  }

  // ── PATCH /payments/demo/pay-later/:orderId ────────────────────

  async payLater(orderId: string, userId: string) {
    const order = await this.findOrderForUser(orderId, userId);

    if (order.payment_status === PaymentStatus.PAID) {
      throw new BadRequestException({
        code: 'ALREADY_PAID',
        message: 'This order has already been paid and cannot be changed to Pay Later.',
      });
    }

    const timeline = this.appendTimeline(order.timeline, 'User selected Pay Later');

    const { data, error } = await this.supabaseService.admin
      .from('orders')
      .update({
        payment_status: PaymentStatus.NOT_PAID,
        payment_method: DemoPaymentMethod.PAY_LATER,
        demo_transaction_id: null,
        payment_failure_reason: null,
        timeline,
      })
      .eq('id', orderId)
      .select()
      .single();

    if (error || !data) {
      throw new InternalServerErrorException({
        code: 'DB_ERROR',
        message: error?.message ?? 'Failed to set Pay Later',
      });
    }

    const row = data as OrderRow;

    return {
      success: true,
      message: 'Order marked as Pay Later. You can complete payment at any time.',
      order: {
        orderId: row.id,
        orderNumber: row.order_number,
        amount: Number(row.price_total),
        paymentStatus: row.payment_status,
        method: row.payment_method,
      },
    };
  }

  // ── PATCH /payments/demo/reset/:orderId ───────────────────────
  // Resets a stuck PAYMENT_PENDING session back to NOT_PAID so the user
  // can retry. Only works when status is PAYMENT_PENDING; does nothing
  // (and returns a clear error) if already PAID or FAILED.

  async resetPayment(orderId: string, userId: string) {
    const order = await this.findOrderForUser(orderId, userId);

    if (order.payment_status === PaymentStatus.PAID) {
      throw new BadRequestException({
        code: 'ALREADY_PAID',
        message: 'This order has already been paid and cannot be reset.',
      });
    }

    if (order.payment_status !== PaymentStatus.PAYMENT_PENDING) {
      throw new BadRequestException({
        code: 'INVALID_PAYMENT_STATE',
        message: `Payment cannot be reset from status "${order.payment_status}". Only PAYMENT_PENDING sessions can be reset.`,
      });
    }

    const timeline = this.appendTimeline(order.timeline, 'Payment session reset by user');

    const { data, error } = await this.supabaseService.admin
      .from('orders')
      .update({
        payment_status: PaymentStatus.NOT_PAID,
        demo_transaction_id: null,
        payment_method: null,
        payment_failure_reason: null,
        timeline,
      })
      .eq('id', orderId)
      .select()
      .single();

    if (error || !data) {
      throw new InternalServerErrorException({
        code: 'DB_ERROR',
        message: error?.message ?? 'Failed to reset payment session',
      });
    }

    const row = data as OrderRow;

    return {
      success: true,
      message: 'Payment session reset. You can now start a new payment.',
      order: {
        orderId: row.id,
        orderNumber: row.order_number,
        paymentStatus: row.payment_status,
      },
    };
  }

  // ── GET /payments/demo/order/:orderId ──────────────────────────

  async getPaymentStatus(orderId: string, userId: string) {
    const order = await this.findOrderForUser(orderId, userId);

    return {
      success: true,
      data: {
        orderId: order.id,
        orderNumber: order.order_number,
        amount: Number(order.price_total),
        currency: order.payment_currency ?? 'INR',
        paymentStatus: order.payment_status,
        method: order.payment_method ?? null,
        demoTransactionId: order.demo_transaction_id ?? null,
        paidAt: order.paid_at ?? null,
        failureReason: order.payment_failure_reason ?? null,
      },
    };
  }

  // ── Private helpers ────────────────────────────────────────────

  private async findOrderForUser(orderId: string, userId: string): Promise<OrderRow> {
    const { data, error } = await this.supabaseService.admin
      .from('orders')
      .select(
        'id, order_number, user_id, price_total, payment_status, payment_method, ' +
        'demo_transaction_id, payment_currency, paid_at, payment_failure_reason, timeline, updated_at',
      )
      .eq('id', orderId)
      .single();

    if (error || !data) {
      throw new NotFoundException({ code: 'ORDER_NOT_FOUND', message: 'Order not found.' });
    }

    const row = data as unknown as OrderRow;

    // Return 404 (not 403) to avoid leaking that another user's order exists
    if (row.user_id !== userId) {
      throw new NotFoundException({ code: 'ORDER_NOT_FOUND', message: 'Order not found.' });
    }

    return row;
  }

  private appendTimeline(
    existing: Array<{ event: string; timestamp: string }> | null,
    event: string,
  ): Array<{ event: string; timestamp: string }> {
    return [...(existing ?? []), { event, timestamp: new Date().toISOString() }];
  }

  // Generates a collision-resistant demo transaction ID using crypto.randomBytes
  // (4 bytes = 2^32 possible values) instead of Math.random() which has a weaker
  // PRNG and higher collision probability under load.
  // Replace with the real gateway's order/payment ID when integrating.
  private generateDemoTransactionId(): string {
    const year = new Date().getFullYear();
    const suffix = randomBytes(4).readUInt32BE(0).toString(36).toUpperCase().padStart(7, '0');
    return `DEMO-TXN-${year}-${suffix}`;
  }
}

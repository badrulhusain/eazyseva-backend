import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentStatus } from './enums/payment-status.enum';
import { DemoPaymentResult } from './enums/demo-payment-result.enum';

// ── helpers ───────────────────────────────────────────────────────────────────

function makeOrderRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'order-1',
    order_number: 'ES-00001',
    user_id: 'user-1',
    price_total: '299',
    payment_status: PaymentStatus.NOT_PAID,
    payment_method: null,
    demo_transaction_id: null,
    payment_currency: 'INR',
    paid_at: null,
    payment_failure_reason: null,
    timeline: [],
    updated_at: new Date(Date.now() - 60_000).toISOString(), // 1 min ago
    ...overrides,
  };
}

function buildService(
  findOrderResult: unknown,
  updateResult?: { data: unknown; error: unknown },
) {
  const chain: any = {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(findOrderResult),
  };

  // For update().eq().select().single() chains
  chain.update.mockReturnValue({
    eq: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        single: jest
          .fn()
          .mockResolvedValue(
            updateResult ?? { data: findOrderResult, error: null },
          ),
      }),
    }),
  });

  const supabaseService = { admin: chain };
  return new PaymentsService(supabaseService as any);
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('PaymentsService', () => {
  describe('startPayment', () => {
    it('throws ALREADY_PAID when payment_status is PAID', async () => {
      const service = buildService({
        data: makeOrderRow({ payment_status: PaymentStatus.PAID }),
        error: null,
      });
      await expect(
        service.startPayment(
          { orderId: 'order-1', method: 'DEMO_UPI' as any },
          'user-1',
        ),
      ).rejects.toMatchObject({ response: { code: 'ALREADY_PAID' } });
    });

    it('throws PAYMENT_IN_PROGRESS for a fresh PAYMENT_PENDING session', async () => {
      const service = buildService({
        data: makeOrderRow({
          payment_status: PaymentStatus.PAYMENT_PENDING,
          demo_transaction_id: 'DEMO-TXN-2026-XYZ',
          updated_at: new Date().toISOString(), // just now — not stale
        }),
        error: null,
      });
      await expect(
        service.startPayment(
          { orderId: 'order-1', method: 'DEMO_UPI' as any },
          'user-1',
        ),
      ).rejects.toMatchObject({ response: { code: 'PAYMENT_IN_PROGRESS' } });
    });

    it('throws ORDER_NOT_FOUND when order does not exist', async () => {
      const service = buildService({ data: null, error: { code: 'PGRST116' } });
      await expect(
        service.startPayment(
          { orderId: 'missing', method: 'DEMO_UPI' as any },
          'user-1',
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('confirmPayment', () => {
    it('throws INVALID_PAYMENT_STATE when status is NOT_PAID', async () => {
      const service = buildService({
        data: makeOrderRow({ payment_status: PaymentStatus.NOT_PAID }),
        error: null,
      });
      await expect(
        service.confirmPayment(
          {
            orderId: 'order-1',
            demoTransactionId: 'txn',
            result: DemoPaymentResult.SUCCESS,
          },
          'user-1',
        ),
      ).rejects.toMatchObject({ response: { code: 'INVALID_PAYMENT_STATE' } });
    });

    it('throws INVALID_PAYMENT_STATE when status is already PAID', async () => {
      const service = buildService({
        data: makeOrderRow({ payment_status: PaymentStatus.PAID }),
        error: null,
      });
      await expect(
        service.confirmPayment(
          {
            orderId: 'order-1',
            demoTransactionId: 'txn',
            result: DemoPaymentResult.SUCCESS,
          },
          'user-1',
        ),
      ).rejects.toMatchObject({ response: { code: 'INVALID_PAYMENT_STATE' } });
    });

    it('throws TRANSACTION_ID_MISMATCH when demoTransactionId does not match', async () => {
      const service = buildService({
        data: makeOrderRow({
          payment_status: PaymentStatus.PAYMENT_PENDING,
          demo_transaction_id: 'DEMO-TXN-2026-ABC',
        }),
        error: null,
      });
      await expect(
        service.confirmPayment(
          {
            orderId: 'order-1',
            demoTransactionId: 'WRONG-TXN',
            result: DemoPaymentResult.SUCCESS,
          },
          'user-1',
        ),
      ).rejects.toMatchObject({
        response: { code: 'TRANSACTION_ID_MISMATCH' },
      });
    });
  });

  describe('resetPayment', () => {
    it('throws ALREADY_PAID when trying to reset a PAID order', async () => {
      const service = buildService({
        data: makeOrderRow({ payment_status: PaymentStatus.PAID }),
        error: null,
      });
      await expect(
        service.resetPayment('order-1', 'user-1'),
      ).rejects.toMatchObject({
        response: { code: 'ALREADY_PAID' },
      });
    });

    it('throws INVALID_PAYMENT_STATE when status is NOT_PAID (nothing to reset)', async () => {
      const service = buildService({
        data: makeOrderRow({ payment_status: PaymentStatus.NOT_PAID }),
        error: null,
      });
      await expect(
        service.resetPayment('order-1', 'user-1'),
      ).rejects.toMatchObject({
        response: { code: 'INVALID_PAYMENT_STATE' },
      });
    });

    it('throws INVALID_PAYMENT_STATE when status is FAILED (use start to retry)', async () => {
      const service = buildService({
        data: makeOrderRow({ payment_status: PaymentStatus.FAILED }),
        error: null,
      });
      await expect(
        service.resetPayment('order-1', 'user-1'),
      ).rejects.toMatchObject({
        response: { code: 'INVALID_PAYMENT_STATE' },
      });
    });
  });

  describe('ownership enforcement', () => {
    it('returns 404 (not 403) when order belongs to different user', async () => {
      const service = buildService({
        data: makeOrderRow({ user_id: 'other-user' }),
        error: null,
      });
      let err: any;
      try {
        await service.getPaymentStatus('order-1', 'user-1');
      } catch (e) {
        err = e;
      }
      expect(err).toBeInstanceOf(NotFoundException);
    });
  });
});

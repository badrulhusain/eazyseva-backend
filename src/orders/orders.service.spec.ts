import { NotFoundException } from '@nestjs/common';
import { OrdersService } from './orders.service';

// Minimal SupabaseService mock — we only exercise the Supabase query builder chain.
function buildSupabaseMock(resolveWith: { data: unknown; error: unknown }) {
  const chain: any = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(resolveWith),
    maybeSingle: jest.fn().mockResolvedValue(resolveWith),
  };

  return {
    supabaseService: {
      admin: {
        from: jest.fn().mockReturnValue(chain),
        rpc: jest.fn(),
      },
    } as any,
    chain,
  };
}

describe('OrdersService', () => {
  describe('findOne (user single order)', () => {
    it('returns order when id and user_id both match', async () => {
      const row = {
        id: 'order-1',
        order_number: 'ES-00001',
        user_id: 'user-1',
        service_type: 'pan-card-new',
        customer_name: 'Alice',
        customer_phone: '9876543210',
        customer_dob: '1990-01-01',
        customer_address: '123 Main St',
        documents: [],
        price_government_fee: 100,
        price_service_charge: 50,
        price_document_handling: 0,
        price_total: 150,
        status: 'PENDING',
        payment_status: 'NOT_PAID',
        payment_method: null,
        demo_transaction_id: null,
        payment_currency: 'INR',
        paid_at: null,
        payment_failure_reason: null,
        timeline: [],
        created_at: '2026-06-06T00:00:00Z',
        updated_at: '2026-06-06T00:00:00Z',
      };
      const { supabaseService, chain } = buildSupabaseMock({ data: row, error: null });
      const service = new OrdersService(supabaseService);

      const result = await service.findOne('order-1', 'user-1');

      expect(result.id).toBe('order-1');
      expect(result.userId).toBe('user-1');
      // Verify query filtered by both id AND user_id (ownership enforced in DB)
      expect(chain.eq).toHaveBeenCalledWith('id', 'order-1');
      expect(chain.eq).toHaveBeenCalledWith('user_id', 'user-1');
    });

    it('throws NotFoundException when DB returns nothing (not found or wrong owner)', async () => {
      const { supabaseService } = buildSupabaseMock({
        data: null,
        error: { code: 'PGRST116', message: 'No rows' },
      });
      const service = new OrdersService(supabaseService);

      await expect(service.findOne('order-x', 'user-1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('returns 404 (not 403) so callers cannot infer another user owns the order', async () => {
      const { supabaseService } = buildSupabaseMock({ data: null, error: null });
      const service = new OrdersService(supabaseService);

      let err: any;
      try {
        await service.findOne('order-1', 'wrong-user');
      } catch (e) {
        err = e;
      }
      expect(err).toBeInstanceOf(NotFoundException);
      // Must NOT be a ForbiddenException (403)
      expect(err.getStatus?.()).toBe(404);
    });
  });
});

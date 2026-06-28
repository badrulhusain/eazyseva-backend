import { BadRequestException, NotFoundException } from '@nestjs/common';
import { OrdersService } from './orders.service';

// Minimal SupabaseService mock — we only exercise the Supabase query builder chain.
function buildSupabaseMock(resolveWith: { data: unknown; error: unknown }) {
  const chain: any = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
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

// Builds a full OrdersService with mocked AuditLogsService/OrderDocumentsService
// collaborators — required since applyStatusChange() (the shared machinery behind
// acceptOrder/rejectOrder/requestCorrection/completeOrder/updateStatus) dereferences
// both. `current` is what findOneAdmin's initial fetch resolves to; `updated` is
// what the post-update `.select().single()` resolves to (defaults to `current`).
function buildReviewWorkflowMocks(
  current: Record<string, unknown>,
  updated?: Record<string, unknown>,
) {
  const chain: any = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    single: jest
      .fn()
      .mockResolvedValueOnce({ data: current, error: null })
      .mockResolvedValue({ data: updated ?? current, error: null }),
    maybeSingle: jest.fn(),
  };

  const supabaseService = {
    admin: {
      from: jest.fn().mockReturnValue(chain),
      rpc: jest.fn(),
    },
  } as any;
  const auditLogsService = {
    record: jest.fn().mockResolvedValue(undefined),
  } as any;
  const orderDocumentsService = {
    trackDocuments: jest.fn().mockResolvedValue(undefined),
    scheduleForDeletion: jest.fn().mockResolvedValue(undefined),
  } as any;

  return {
    service: new OrdersService(
      supabaseService,
      auditLogsService,
      orderDocumentsService,
    ),
    chain,
    auditLogsService,
    orderDocumentsService,
  };
}

function buildOrderRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
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
    rejection_reason: null,
    admin_note: null,
    reviewed_by: null,
    reviewed_at: null,
    created_at: '2026-06-06T00:00:00Z',
    updated_at: '2026-06-06T00:00:00Z',
    ...overrides,
  };
}

describe('OrdersService', () => {
  describe('required document validation', () => {
    const buildService = () =>
      new OrdersService({} as any, {} as any, {} as any);

    const uploadedDocument = (name: string, label?: string) =>
      ({
        name,
        label,
        url: 'https://res.cloudinary.com/demo/image/upload/document.jpg',
        publicId: 'ezyseva/documents/user-1/document',
      }) as any;

    it('accepts a JSON-encoded required document when its name was uploaded', () => {
      const service = buildService();

      expect(() =>
        (service as any).validateRequiredDocuments(
          ['{"name":"pan card","isRequired":true}'],
          [uploadedDocument('panCard')],
        ),
      ).not.toThrow();
    });

    it('accepts structured required documents and matches their labels', () => {
      const service = buildService();

      expect(() =>
        (service as any).validateRequiredDocuments(
          [{ name: 'panCard', label: 'PAN Card', isRequired: true }],
          [uploadedDocument('identityProof', 'Pan card')],
        ),
      ).not.toThrow();
    });

    it('does not require entries explicitly marked optional', () => {
      const service = buildService();

      expect(() =>
        (service as any).validateRequiredDocuments(
          [{ name: 'supporting document', isRequired: false }],
          [],
        ),
      ).not.toThrow();
    });

    it('reports the parsed document name instead of raw JSON', () => {
      const service = buildService();

      expect(() =>
        (service as any).validateRequiredDocuments(
          ['{"name":"pan card","isRequired":true}'],
          [],
        ),
      ).toThrow('Missing required documents: pan card');
    });
  });

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
      const { supabaseService, chain } = buildSupabaseMock({
        data: row,
        error: null,
      });
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

      await expect(service.findOne('order-x', 'user-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('returns 404 (not 403) so callers cannot infer another user owns the order', async () => {
      const { supabaseService } = buildSupabaseMock({
        data: null,
        error: null,
      });
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

  describe('admin review workflow (accept/reject/request-correction/complete)', () => {
    it('acceptOrder transitions PENDING → ACCEPTED, persists the row, and fires the audit log', async () => {
      const current = buildOrderRow({ status: 'PENDING' });
      const updated = buildOrderRow({
        status: 'ACCEPTED',
        reviewed_by: 'admin-1',
        reviewed_at: '2026-06-07T00:00:00Z',
      });
      const { service, chain, auditLogsService, orderDocumentsService } =
        buildReviewWorkflowMocks(current, updated);

      const result = await service.acceptOrder('order-1', 'admin-1');

      expect(result.status).toBe('ACCEPTED');
      expect(chain.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'ACCEPTED', reviewed_by: 'admin-1' }),
      );
      expect(auditLogsService.record).toHaveBeenCalledWith(
        'admin-1',
        'ADMIN_ACCEPTED_ORDER',
        'order',
        'order-1',
        expect.objectContaining({ previousStatus: 'PENDING' }),
      );
      // Document scheduling only fires for COMPLETED, not ACCEPTED.
      expect(orderDocumentsService.scheduleForDeletion).not.toHaveBeenCalled();
    });

    it('rejectOrder records the trimmed note as rejection_reason and audits ADMIN_REJECTED_ORDER', async () => {
      const current = buildOrderRow({ status: 'UNDER_REVIEW' });
      const updated = buildOrderRow({
        status: 'REJECTED',
        rejection_reason: 'Documents are illegible',
      });
      const { service, chain, auditLogsService } = buildReviewWorkflowMocks(
        current,
        updated,
      );

      const result = await service.rejectOrder(
        'order-1',
        { note: '  Documents are illegible  ' },
        'admin-1',
      );

      expect(result.status).toBe('REJECTED');
      expect(chain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'REJECTED',
          rejection_reason: 'Documents are illegible',
        }),
      );
      expect(auditLogsService.record).toHaveBeenCalledWith(
        'admin-1',
        'ADMIN_REJECTED_ORDER',
        'order',
        'order-1',
        expect.objectContaining({ reason: 'Documents are illegible' }),
      );
    });

    it('requestCorrection records the trimmed note as admin_note and audits ADMIN_REQUESTED_CORRECTION', async () => {
      const current = buildOrderRow({ status: 'UNDER_REVIEW' });
      const updated = buildOrderRow({
        status: 'CORRECTION_REQUESTED',
        admin_note: 'Please re-upload a clearer photo ID',
      });
      const { service, chain, auditLogsService } = buildReviewWorkflowMocks(
        current,
        updated,
      );

      const result = await service.requestCorrection(
        'order-1',
        { note: '  Please re-upload a clearer photo ID  ' },
        'admin-1',
      );

      expect(result.status).toBe('CORRECTION_REQUESTED');
      expect(chain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'CORRECTION_REQUESTED',
          admin_note: 'Please re-upload a clearer photo ID',
        }),
      );
      expect(auditLogsService.record).toHaveBeenCalledWith(
        'admin-1',
        'ADMIN_REQUESTED_CORRECTION',
        'order',
        'order-1',
        expect.objectContaining({
          reason: 'Please re-upload a clearer photo ID',
        }),
      );
    });

    it('completeOrder transitions to COMPLETED, audits it, and schedules documents for deletion', async () => {
      const current = buildOrderRow({ status: 'PROCESSING' });
      const updated = buildOrderRow({ status: 'COMPLETED' });
      const { service, auditLogsService, orderDocumentsService } =
        buildReviewWorkflowMocks(current, updated);

      const result = await service.completeOrder('order-1', 'admin-1');

      expect(result.status).toBe('COMPLETED');
      expect(auditLogsService.record).toHaveBeenCalledWith(
        'admin-1',
        'ADMIN_COMPLETED_ORDER',
        'order',
        'order-1',
        expect.objectContaining({ previousStatus: 'PROCESSING' }),
      );
      expect(orderDocumentsService.scheduleForDeletion).toHaveBeenCalledWith(
        'order-1',
        'admin-1',
      );
    });

    it('rejects invalid transitions with INVALID_STATUS_TRANSITION (e.g. accepting a COMPLETED order)', async () => {
      const current = buildOrderRow({ status: 'COMPLETED' });
      const { service, auditLogsService, orderDocumentsService } =
        buildReviewWorkflowMocks(current);

      let err: any;
      try {
        await service.acceptOrder('order-1', 'admin-1');
      } catch (e) {
        err = e;
      }

      expect(err).toBeInstanceOf(BadRequestException);
      expect(err.getResponse?.()).toEqual(
        expect.objectContaining({ code: 'INVALID_STATUS_TRANSITION' }),
      );
      // No side effects should fire when the transition itself is rejected.
      expect(auditLogsService.record).not.toHaveBeenCalled();
      expect(orderDocumentsService.scheduleForDeletion).not.toHaveBeenCalled();
    });

    it('updateStatus throws REASON_REQUIRED when rejecting without a reason', async () => {
      const current = buildOrderRow({ status: 'UNDER_REVIEW' });
      const { service, auditLogsService } = buildReviewWorkflowMocks(current);

      let err: any;
      try {
        await service.updateStatus(
          'order-1',
          { status: 'REJECTED' } as any,
          'admin-1',
        );
      } catch (e) {
        err = e;
      }

      expect(err).toBeInstanceOf(BadRequestException);
      expect(err.getResponse?.()).toEqual(
        expect.objectContaining({ code: 'REASON_REQUIRED' }),
      );
      expect(auditLogsService.record).not.toHaveBeenCalled();
    });

    it('updateStatus throws REASON_REQUIRED when requesting a correction without a reason', async () => {
      const current = buildOrderRow({ status: 'UNDER_REVIEW' });
      const { service } = buildReviewWorkflowMocks(current);

      await expect(
        service.updateStatus(
          'order-1',
          { status: 'CORRECTION_REQUESTED', reason: '   ' } as any,
          'admin-1',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});

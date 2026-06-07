import { OrderDocumentsService } from './documents.service';

// Minimal SupabaseService mock. Mirrors the real Supabase query builder: every
// method returns the same chainable object, and the chain itself is "thenable"
// so `await chain.select(...)` and `await chain.select(...).eq(...).lte(...)`
// both resolve to the configured `resolveWith` regardless of chain length —
// matching how `documents.service.ts` terminates its queries at different points
// (`.select('id')` in scheduleForDeletion vs `.select(...).eq(...).lte(...)` in
// processDueDeletions).
function buildSupabaseMock(resolveWith: { data: unknown; error: unknown }) {
  let resolved = resolveWith;
  const chain: any = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn(() => Promise.resolve(resolved)),
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    then: (onFulfilled: (v: unknown) => unknown) =>
      Promise.resolve(resolved).then(onFulfilled),
  };

  return {
    supabaseService: {
      admin: { from: jest.fn().mockReturnValue(chain) },
    } as any,
    chain,
    setResolved: (next: { data: unknown; error: unknown }) => {
      resolved = next;
    },
  };
}

function buildService(opts: {
  resolveWith?: { data: unknown; error: unknown };
  uploadsService?: any;
  config?: Record<string, unknown>;
}) {
  const { supabaseService, chain, setResolved } = buildSupabaseMock(
    opts.resolveWith ?? { data: null, error: null },
  );
  const uploadsService = opts.uploadsService ?? {
    deleteDocument: jest.fn().mockResolvedValue(undefined),
  };
  const auditLogsService = {
    record: jest.fn().mockResolvedValue(undefined),
  } as any;
  const config = {
    get: jest.fn((key: string) => (opts.config ?? {})[key]),
  } as any;

  return {
    service: new OrderDocumentsService(
      supabaseService,
      uploadsService,
      auditLogsService,
      config,
    ),
    chain,
    setResolved,
    auditLogsService,
    uploadsService,
  };
}

describe('OrderDocumentsService', () => {
  describe('trackDocuments', () => {
    it('only inserts rows for documents that carry a Cloudinary publicId', async () => {
      const { service, chain } = buildService({
        resolveWith: { data: null, error: null },
      });

      await service.trackDocuments('order-1', 'user-1', [
        {
          name: 'pan.pdf',
          url: 'https://cdn/pan.pdf',
          publicId: 'orders/pan-1',
          format: 'pdf',
        },
        {
          name: 'external-link.png',
          url: 'https://example.com/no-public-id.png',
        },
      ]);

      expect(chain.insert).toHaveBeenCalledWith([
        expect.objectContaining({
          order_id: 'order-1',
          user_id: 'user-1',
          cloudinary_public_id: 'orders/pan-1',
          status: 'active',
        }),
      ]);
    });

    it('is a no-op when no documents carry a publicId (and never touches the DB)', async () => {
      const { service, chain } = buildService({});

      await service.trackDocuments('order-1', 'user-1', [
        { name: 'external.png', url: 'https://example.com/x.png' },
      ]);

      expect(chain.insert).not.toHaveBeenCalled();
    });

    it('swallows insert errors (best-effort — must never fail order creation)', async () => {
      const { service } = buildService({
        resolveWith: { data: null, error: { message: 'insert failed' } },
      });

      await expect(
        service.trackDocuments('order-1', 'user-1', [
          {
            name: 'pan.pdf',
            url: 'https://cdn/pan.pdf',
            publicId: 'orders/pan-1',
          },
        ]),
      ).resolves.toBeUndefined();
    });
  });

  describe('scheduleForDeletion', () => {
    it('marks active documents as scheduled_for_deletion and records an audit log', async () => {
      const { service, chain, auditLogsService } = buildService({
        resolveWith: { data: [{ id: 'doc-1' }, { id: 'doc-2' }], error: null },
      });

      await service.scheduleForDeletion('order-1', 'admin-1');

      expect(chain.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'scheduled_for_deletion' }),
      );
      expect(chain.eq).toHaveBeenCalledWith('order_id', 'order-1');
      expect(chain.eq).toHaveBeenCalledWith('status', 'active');
      expect(auditLogsService.record).toHaveBeenCalledWith(
        'admin-1',
        'DOCUMENT_SCHEDULED_FOR_DELETION',
        'document',
        'order-1',
        expect.objectContaining({ documentIds: ['doc-1', 'doc-2'] }),
      );
    });

    it('does not record an audit log when no active documents are affected', async () => {
      const { service, auditLogsService } = buildService({
        resolveWith: { data: [], error: null },
      });

      await service.scheduleForDeletion('order-1', 'admin-1');

      expect(auditLogsService.record).not.toHaveBeenCalled();
    });
  });

  describe('processDueDeletions', () => {
    it('deletes due documents from Cloudinary, marks them deleted, and audits each', async () => {
      const due = [
        { id: 'doc-1', cloudinary_public_id: 'orders/pan-1', mime_type: 'pdf' },
        {
          id: 'doc-2',
          cloudinary_public_id: 'orders/photo-1',
          mime_type: 'jpg',
        },
      ];
      const { service, auditLogsService, uploadsService } = buildService({
        resolveWith: { data: due, error: null },
      });

      const summary = await service.processDueDeletions('admin-1');

      expect(uploadsService.deleteDocument).toHaveBeenCalledWith(
        'orders/pan-1',
        'raw',
      );
      expect(uploadsService.deleteDocument).toHaveBeenCalledWith(
        'orders/photo-1',
        'image',
      );
      expect(summary).toEqual({ processed: 2, deleted: 2, failed: 0 });
      expect(auditLogsService.record).toHaveBeenCalledWith(
        'admin-1',
        'DOCUMENT_DELETED',
        'document',
        'doc-1',
        expect.objectContaining({ publicId: 'orders/pan-1' }),
      );
    });

    it('marks a document deletion_failed and audits DOCUMENT_DELETION_FAILED when Cloudinary deletion throws', async () => {
      const due = [
        { id: 'doc-1', cloudinary_public_id: 'orders/pan-1', mime_type: 'pdf' },
      ];
      const uploadsService = {
        deleteDocument: jest
          .fn()
          .mockRejectedValue(new Error('Cloudinary unreachable')),
      };
      const { service, auditLogsService } = buildService({
        resolveWith: { data: due, error: null },
        uploadsService,
      });

      const summary = await service.processDueDeletions('admin-1');

      expect(summary).toEqual({ processed: 1, deleted: 0, failed: 1 });
      expect(auditLogsService.record).toHaveBeenCalledWith(
        'admin-1',
        'DOCUMENT_DELETION_FAILED',
        'document',
        'doc-1',
        expect.objectContaining({
          publicId: 'orders/pan-1',
          error: 'Cloudinary unreachable',
        }),
      );
    });

    it('returns an empty summary when nothing is due', async () => {
      const { service, uploadsService } = buildService({
        resolveWith: { data: [], error: null },
      });

      const summary = await service.processDueDeletions('admin-1');

      expect(summary).toEqual({ processed: 0, deleted: 0, failed: 0 });
      expect(uploadsService.deleteDocument).not.toHaveBeenCalled();
    });
  });
});

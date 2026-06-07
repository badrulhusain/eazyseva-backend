import { BlogsService } from './blogs.service';

// Minimal SupabaseService mock — chainable query builder.
// `slugLookupResults` is consumed in order by successive `.maybeSingle()` calls
// made while probing for a unique slug (base, then -2, -3, …).
function buildSupabaseMock(opts: {
  slugLookupResults: Array<{ id: string } | null>;
  insertResolved: { data: unknown; error: unknown };
}) {
  let slugCallIndex = 0;

  const insertChain: any = {
    select: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(opts.insertResolved),
  };

  const lookupChain: any = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    ilike: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockImplementation(() =>
      Promise.resolve({
        data: opts.slugLookupResults[slugCallIndex++] ?? null,
        error: null,
      }),
    ),
  };

  const from = jest.fn((_table: string) => ({
    ...lookupChain,
    insert: jest.fn().mockReturnValue(insertChain),
  }));

  return { supabaseService: { admin: { from } } as any };
}

const blogRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'blog-1',
  title: 'Hello World',
  slug: 'hello-world',
  excerpt: null,
  content: 'Body',
  cover_image_url: null,
  category: 'news',
  tags: [],
  status: 'draft',
  author_id: 'admin-1',
  seo_title: null,
  seo_description: null,
  published_at: null,
  deleted_at: null,
  created_at: '2026-06-01T00:00:00Z',
  updated_at: '2026-06-01T00:00:00Z',
  ...overrides,
});

describe('BlogsService', () => {
  describe('create — slug generation', () => {
    it('auto-generates a slug from the title when none is provided', async () => {
      const { supabaseService } = buildSupabaseMock({
        slugLookupResults: [null], // base slug is free
        insertResolved: { data: blogRow(), error: null },
      });
      const service = new BlogsService(supabaseService);

      const result = await service.create(
        { title: 'Hello World', content: 'Body' },
        'admin-1',
      );

      expect(result.slug).toBe('hello-world');
    });

    it('appends -2 when the base slug is already taken', async () => {
      const { supabaseService } = buildSupabaseMock({
        slugLookupResults: [{ id: 'existing' }, null], // base taken, -2 free
        insertResolved: {
          data: blogRow({ slug: 'hello-world-2' }),
          error: null,
        },
      });
      const service = new BlogsService(supabaseService);

      const result = await service.create(
        { title: 'Hello World', content: 'Body' },
        'admin-1',
      );

      expect(result.slug).toBe('hello-world-2');
    });

    it('stamps published_at when created directly as published', async () => {
      const { supabaseService } = buildSupabaseMock({
        slugLookupResults: [null],
        insertResolved: {
          data: blogRow({
            status: 'published',
            published_at: '2026-06-01T00:00:00Z',
          }),
          error: null,
        },
      });
      const service = new BlogsService(supabaseService);

      const result = await service.create(
        { title: 'Hello World', content: 'Body', status: 'published' } as any,
        'admin-1',
      );

      expect(result.status).toBe('published');
      expect(result.publishedAt).not.toBeNull();
    });
  });
});

import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import type { CreateBlogDto } from './dto/create-blog.dto';
import type { UpdateBlogDto } from './dto/update-blog.dto';
import type {
  AdminBlogQueryDto,
  PublicBlogQueryDto,
} from './dto/query-blog.dto';
import type { Blog, BlogRow, BlogSummary } from './blogs.types';

const BLOG_FULL_COLS =
  'id, title, slug, excerpt, content, cover_image_url, category, tags, status, ' +
  'author_id, seo_title, seo_description, published_at, deleted_at, created_at, updated_at';

// Lightweight columns for list endpoints — omits the (potentially large) content body.
const BLOG_LIST_COLS =
  'id, title, slug, excerpt, cover_image_url, category, tags, status, ' +
  'published_at, created_at, updated_at';

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // strip combining diacritics left over from NFKD normalization
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 200);
}

@Injectable()
export class BlogsService {
  private readonly logger = new Logger(BlogsService.name);
  private readonly publicListCache = new Map<
    string,
    {
      data: {
        data: BlogSummary[];
        total: number;
        page: number;
        limit: number;
      };
      expiresAt: number;
    }
  >();
  private readonly publicDetailCache = new Map<
    string,
    { data: Blog; expiresAt: number }
  >();
  private readonly PUBLIC_CACHE_TTL = 30_000;

  constructor(private readonly supabaseService: SupabaseService) {}

  // ── Admin: create ─────────────────────────────────────────────────

  async create(dto: CreateBlogDto, authorId: string): Promise<Blog> {
    const baseSlug = dto.slug?.trim() || slugify(dto.title);
    if (!baseSlug) {
      throw new BadRequestException({
        code: 'INVALID_TITLE',
        message: 'Could not derive a slug from the title',
      });
    }
    const slug = await this.generateUniqueSlug(baseSlug);

    const status = dto.status ?? 'draft';
    const publishedAt =
      status === 'published' ? new Date().toISOString() : null;

    const { data, error } = await this.supabaseService.admin
      .from('blogs')
      .insert({
        title: dto.title,
        slug,
        excerpt: dto.excerpt ?? null,
        content: dto.content,
        cover_image_url: dto.coverImageUrl ?? null,
        category: dto.category ?? null,
        tags: dto.tags ?? [],
        status,
        author_id: authorId,
        seo_title: dto.seoTitle ?? null,
        seo_description: dto.seoDescription ?? null,
        published_at: publishedAt,
      })
      .select(BLOG_FULL_COLS)
      .single();

    if (error || !data) {
      throw new InternalServerErrorException({
        code: 'DB_ERROR',
        message: error?.message ?? 'Failed to create blog',
      });
    }

    const blog = BlogsService.formatRow(data as unknown as BlogRow);
    this.logger.log(
      `Blog created: ${blog.id} slug=${blog.slug} status=${blog.status} author=${authorId}`,
    );
    this.invalidatePublicCache();
    return blog;
  }

  // ── Admin: update ─────────────────────────────────────────────────

  async update(id: string, dto: UpdateBlogDto): Promise<Blog> {
    const current = await this.findOneAdmin(id);

    const patch: Record<string, unknown> = {};
    if (dto.title !== undefined) patch.title = dto.title;
    if (dto.excerpt !== undefined) patch.excerpt = dto.excerpt;
    if (dto.content !== undefined) patch.content = dto.content;
    if (dto.coverImageUrl !== undefined)
      patch.cover_image_url = dto.coverImageUrl;
    if (dto.category !== undefined) patch.category = dto.category;
    if (dto.tags !== undefined) patch.tags = dto.tags;
    if (dto.seoTitle !== undefined) patch.seo_title = dto.seoTitle;
    if (dto.seoDescription !== undefined)
      patch.seo_description = dto.seoDescription;

    if (dto.slug !== undefined && dto.slug !== current.slug) {
      patch.slug = await this.generateUniqueSlug(dto.slug, id);
    }

    if (dto.status !== undefined && dto.status !== current.status) {
      patch.status = dto.status;
      // First transition into "published" stamps published_at; later re-publishes keep it.
      if (dto.status === 'published' && !current.publishedAt) {
        patch.published_at = new Date().toISOString();
      }
    }

    if (Object.keys(patch).length === 0) {
      return current;
    }

    const { data, error } = await this.supabaseService.admin
      .from('blogs')
      .update(patch)
      .eq('id', id)
      .select(BLOG_FULL_COLS)
      .single();

    if (error || !data) {
      throw new InternalServerErrorException({
        code: 'DB_ERROR',
        message: error?.message ?? 'Failed to update blog',
      });
    }

    const updated = BlogsService.formatRow(data as unknown as BlogRow);
    this.logger.log(
      `Blog updated: ${updated.id} slug=${updated.slug} status=${current.status}→${updated.status}`,
    );
    this.invalidatePublicCache();
    return updated;
  }

  // ── Admin: soft delete ────────────────────────────────────────────

  async softDelete(id: string): Promise<Blog> {
    await this.findOneAdmin(id);

    const { data, error } = await this.supabaseService.admin
      .from('blogs')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .select(BLOG_FULL_COLS)
      .single();

    if (error || !data) {
      throw new InternalServerErrorException({
        code: 'DB_ERROR',
        message: error?.message ?? 'Failed to delete blog',
      });
    }

    const blog = BlogsService.formatRow(data as unknown as BlogRow);
    this.invalidatePublicCache();
    return blog;
  }

  // ── Admin: list / detail ──────────────────────────────────────────

  async findAllAdmin(query: AdminBlogQueryDto): Promise<{
    data: BlogSummary[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { page, limit, search, category, status } = query;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let q = this.supabaseService.admin
      .from('blogs')
      .select(BLOG_LIST_COLS, { count: 'planned' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (status) q = q.eq('status', status);
    if (category) q = q.eq('category', category);
    if (search) q = q.ilike('title', `%${search}%`);

    const { data, error, count } = await q;
    if (error) {
      throw new InternalServerErrorException({
        code: 'DB_ERROR',
        message: error.message,
      });
    }

    return {
      data: ((data ?? []) as unknown as Partial<BlogRow>[]).map((row) =>
        BlogsService.formatSummaryRow(row),
      ),
      total: count ?? 0,
      page,
      limit,
    };
  }

  async findOneAdmin(id: string): Promise<Blog> {
    const { data, error } = await this.supabaseService.admin
      .from('blogs')
      .select(BLOG_FULL_COLS)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new NotFoundException({
          code: 'BLOG_NOT_FOUND',
          message: 'Blog not found',
        });
      }
      throw new InternalServerErrorException({
        code: 'DB_ERROR',
        message: error.message,
      });
    }
    if (!data) {
      throw new NotFoundException({
        code: 'BLOG_NOT_FOUND',
        message: 'Blog not found',
      });
    }

    return BlogsService.formatRow(data as unknown as BlogRow);
  }

  // ── Public: list / detail ─────────────────────────────────────────

  async findPublished(query: PublicBlogQueryDto): Promise<{
    data: BlogSummary[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { page, limit, search, category } = query;
    const cacheKey = BlogsService.publicListCacheKey(query);
    const cached = this.publicListCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.data;

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let q = this.supabaseService.admin
      .from('blogs')
      .select(BLOG_LIST_COLS, { count: 'planned' })
      .eq('status', 'published')
      .is('deleted_at', null)
      .order('published_at', { ascending: false })
      .range(from, to);

    if (category) q = q.eq('category', category);
    if (search) q = q.ilike('title', `%${search}%`);

    const { data, error, count } = await q;
    if (error) {
      throw new InternalServerErrorException({
        code: 'DB_ERROR',
        message: error.message,
      });
    }

    const result = {
      data: ((data ?? []) as unknown as Partial<BlogRow>[]).map((row) =>
        BlogsService.formatSummaryRow(row),
      ),
      total: count ?? 0,
      page,
      limit,
    };
    this.publicListCache.set(cacheKey, {
      data: result,
      expiresAt: Date.now() + this.PUBLIC_CACHE_TTL,
    });
    return result;
  }

  async findBySlug(slug: string): Promise<Blog> {
    const cached = this.publicDetailCache.get(slug);
    if (cached && cached.expiresAt > Date.now()) return cached.data;

    const { data, error } = await this.supabaseService.admin
      .from('blogs')
      .select(BLOG_FULL_COLS)
      .eq('slug', slug)
      .eq('status', 'published')
      .is('deleted_at', null)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException({
        code: 'DB_ERROR',
        message: error.message,
      });
    }
    if (!data) {
      throw new NotFoundException({
        code: 'BLOG_NOT_FOUND',
        message: 'Blog not found',
      });
    }

    const blog = BlogsService.formatRow(data as unknown as BlogRow);
    this.publicDetailCache.set(slug, {
      data: blog,
      expiresAt: Date.now() + this.PUBLIC_CACHE_TTL,
    });
    return blog;
  }

  // ── Helpers ───────────────────────────────────────────────────────

  /** Finds a free slug in small batches instead of probing one collision per DB round-trip. */
  private async generateUniqueSlug(
    baseSlug: string,
    excludeId?: string,
  ): Promise<string> {
    const batchSize = 25;
    const maxSuffix = 1000;
    const candidates = [baseSlug];

    for (let suffix = 2; suffix <= maxSuffix; suffix++) {
      candidates.push(`${baseSlug}-${suffix}`);
    }

    for (let start = 0; start < candidates.length; start += batchSize) {
      const batch = candidates.slice(start, start + batchSize);

      let q = this.supabaseService.admin
        .from('blogs')
        .select('slug')
        .in('slug', batch);
      if (excludeId) q = q.neq('id', excludeId);

      const { data, error } = await q;
      if (error) {
        throw new InternalServerErrorException({
          code: 'DB_ERROR',
          message: error.message,
        });
      }

      const taken = new Set(
        ((data ?? []) as Array<{ slug: string }>).map((row) => row.slug),
      );
      const available = batch.find((candidate) => !taken.has(candidate));
      if (available) return available;
    }

    throw new InternalServerErrorException({
      code: 'SLUG_GENERATION_FAILED',
      message: 'Could not generate a unique slug',
    });
  }

  private static formatRow(row: BlogRow): Blog {
    return {
      id: row.id,
      title: row.title,
      slug: row.slug,
      excerpt: row.excerpt ?? null,
      content: row.content,
      coverImageUrl: row.cover_image_url ?? null,
      category: row.category ?? null,
      tags: row.tags ?? [],
      status: row.status,
      authorId: row.author_id ?? null,
      seoTitle: row.seo_title ?? null,
      seoDescription: row.seo_description ?? null,
      publishedAt: row.published_at ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private static formatSummaryRow(row: Partial<BlogRow>): BlogSummary {
    return {
      id: row.id!,
      title: row.title!,
      slug: row.slug!,
      excerpt: row.excerpt ?? null,
      coverImageUrl: row.cover_image_url ?? null,
      category: row.category ?? null,
      tags: row.tags ?? [],
      status: row.status!,
      publishedAt: row.published_at ?? null,
      createdAt: row.created_at!,
      updatedAt: row.updated_at!,
    };
  }

  private invalidatePublicCache(): void {
    this.publicListCache.clear();
    this.publicDetailCache.clear();
  }

  private static publicListCacheKey(query: PublicBlogQueryDto): string {
    return JSON.stringify({
      page: query.page,
      limit: query.limit,
      search: query.search ?? '',
      category: query.category ?? '',
    });
  }
}

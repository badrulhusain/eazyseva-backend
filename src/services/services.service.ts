import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { OrdersService } from '../orders/orders.service';
import type {
  ServiceCategory,
  ServiceListItem,
  ServiceItem,
} from './services.types';
import type { CreateServiceDto } from './dto/create-service.dto';
import type { UpdateServiceDto } from './dto/update-service.dto';

const LIST_COLUMNS =
  'id, title, slug, category, price, govt_fee, processing_fee, delivery_days_min, delivery_days_max, icon, is_popular' as const;

const DETAIL_COLUMNS =
  'id, title, slug, description, category, price, govt_fee, processing_fee, delivery_days_min, delivery_days_max, required_documents, icon, is_popular, is_active, created_at, updated_at' as const;

@Injectable()
export class ServicesService {
  private readonly logger = new Logger(ServicesService.name);
  private readonly publicListCache = new Map<
    string,
    { data: ServiceListItem[]; expiresAt: number }
  >();
  private readonly publicDetailCache = new Map<
    string,
    { data: ServiceItem; expiresAt: number }
  >();
  private readonly PUBLIC_CACHE_TTL = 30_000;

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly ordersService: OrdersService,
  ) {}

  async findAll(category?: ServiceCategory): Promise<ServiceListItem[]> {
    const cacheKey = category ?? '__all__';
    const cached = this.publicListCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.data;

    let query = this.supabaseService.admin
      .from('services')
      .select(LIST_COLUMNS)
      .eq('is_active', true)
      .order('is_popular', { ascending: false })
      .order('title', { ascending: true });

    if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await query;
    if (error)
      throw new InternalServerErrorException({
        code: 'DB_ERROR',
        message: error.message,
      });
    const services = (data ?? []) as ServiceListItem[];
    this.publicListCache.set(cacheKey, {
      data: services,
      expiresAt: Date.now() + this.PUBLIC_CACHE_TTL,
    });
    return services;
  }

  async findAllAdmin(): Promise<ServiceItem[]> {
    const { data, error } = await this.supabaseService.admin
      .from('services')
      .select(DETAIL_COLUMNS)
      .order('is_popular', { ascending: false })
      .order('title', { ascending: true });

    if (error)
      throw new InternalServerErrorException({
        code: 'DB_ERROR',
        message: error.message,
      });
    return data ?? [];
  }

  async findBySlug(slug: string): Promise<ServiceItem> {
    const cached = this.publicDetailCache.get(slug);
    if (cached && cached.expiresAt > Date.now()) return cached.data;

    const { data, error } = await this.supabaseService.admin
      .from('services')
      .select(DETAIL_COLUMNS)
      .eq('slug', slug)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      throw new NotFoundException({
        code: 'SERVICE_NOT_FOUND',
        message: 'Service not found',
      });
    }
    const service = data as ServiceItem;
    this.publicDetailCache.set(slug, {
      data: service,
      expiresAt: Date.now() + this.PUBLIC_CACHE_TTL,
    });
    return service;
  }

  async create(dto: CreateServiceDto) {
    const { data: existing } = await this.supabaseService.admin
      .from('services')
      .select('id')
      .eq('slug', dto.slug)
      .maybeSingle();

    if (existing) {
      throw new ConflictException({
        code: 'SLUG_CONFLICT',
        message: 'A service with this slug already exists',
      });
    }

    const { data, error } = await this.supabaseService.admin
      .from('services')
      .insert({
        title: dto.title,
        slug: dto.slug,
        description: dto.description ?? null,
        category: dto.category,
        price: dto.price,
        govt_fee: dto.govtFee ?? 0,
        processing_fee: dto.processingFee ?? 0,
        delivery_days_min: dto.deliveryDaysMin ?? 1,
        delivery_days_max: dto.deliveryDaysMax ?? 7,
        required_documents: dto.requiredDocuments ?? [],
        icon: dto.icon ?? null,
        is_popular: dto.isPopular ?? false,
        is_active: dto.isActive ?? true,
      })
      .select()
      .single();

    if (error || !data) {
      throw new InternalServerErrorException({
        code: 'DB_ERROR',
        message: error?.message ?? 'Failed to create service',
      });
    }
    this.logger.log(`Service created: ${data.id} slug=${dto.slug}`);
    this.invalidatePublicCache();
    this.ordersService.invalidateServiceCache();
    return data;
  }

  async update(id: string, dto: UpdateServiceDto) {
    if (dto.slug) {
      const { data: existing } = await this.supabaseService.admin
        .from('services')
        .select('id')
        .eq('slug', dto.slug)
        .neq('id', id)
        .maybeSingle();

      if (existing) {
        throw new ConflictException({
          code: 'SLUG_CONFLICT',
          message: 'A service with this slug already exists',
        });
      }
    }

    const patch: Record<string, unknown> = {};
    if (dto.title !== undefined) patch.title = dto.title;
    if (dto.slug !== undefined) patch.slug = dto.slug;
    if (dto.description !== undefined) patch.description = dto.description;
    if (dto.category !== undefined) patch.category = dto.category;
    if (dto.price !== undefined) patch.price = dto.price;
    if (dto.govtFee !== undefined) patch.govt_fee = dto.govtFee;
    if (dto.processingFee !== undefined)
      patch.processing_fee = dto.processingFee;
    if (dto.deliveryDaysMin !== undefined)
      patch.delivery_days_min = dto.deliveryDaysMin;
    if (dto.deliveryDaysMax !== undefined)
      patch.delivery_days_max = dto.deliveryDaysMax;
    if (dto.requiredDocuments !== undefined)
      patch.required_documents = dto.requiredDocuments;
    if (dto.icon !== undefined) patch.icon = dto.icon;
    if (dto.isPopular !== undefined) patch.is_popular = dto.isPopular;
    if (dto.isActive !== undefined) patch.is_active = dto.isActive;

    const { data, error } = await this.supabaseService.admin
      .from('services')
      .update(patch)
      .eq('id', id)
      .select()
      .single();

    if (error || !data) {
      throw new NotFoundException({
        code: 'SERVICE_NOT_FOUND',
        message: 'Service not found',
      });
    }
    this.logger.log(`Service updated: ${id}`);
    this.invalidatePublicCache();
    this.ordersService.invalidateServiceCache();
    return data;
  }

  async softDelete(id: string) {
    const { data, error } = await this.supabaseService.admin
      .from('services')
      .update({ is_active: false })
      .eq('id', id)
      .select('id')
      .single();

    if (error || !data) {
      throw new NotFoundException({
        code: 'SERVICE_NOT_FOUND',
        message: 'Service not found',
      });
    }
    this.logger.log(`Service soft-deleted: ${id}`);
    this.invalidatePublicCache();
    this.ordersService.invalidateServiceCache();
    return { deleted: true, id };
  }

  private invalidatePublicCache(): void {
    this.publicListCache.clear();
    this.publicDetailCache.clear();
  }
}

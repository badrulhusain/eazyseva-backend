import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import type { ServiceCategory, ServiceListItem, ServiceItem } from './services.types';
import type { CreateServiceDto } from './dto/create-service.dto';
import type { UpdateServiceDto } from './dto/update-service.dto';

const LIST_COLUMNS =
  'id, title, slug, category, price, govt_fee, processing_fee, delivery_days_min, delivery_days_max, icon, is_popular' as const;

const DETAIL_COLUMNS =
  'id, title, slug, description, category, price, govt_fee, processing_fee, delivery_days_min, delivery_days_max, required_documents, icon, is_popular, is_active, created_at, updated_at' as const;

@Injectable()
export class ServicesService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async findAll(category?: ServiceCategory): Promise<ServiceListItem[]> {
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
    if (error) throw new InternalServerErrorException({ code: 'DB_ERROR', message: error.message });
    return data ?? [];
  }

  async findBySlug(slug: string): Promise<ServiceItem> {
    const { data, error } = await this.supabaseService.admin
      .from('services')
      .select(DETAIL_COLUMNS)
      .eq('slug', slug)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      throw new NotFoundException({ code: 'SERVICE_NOT_FOUND', message: 'Service not found' });
    }
    return data;
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
        govt_fee: dto.govt_fee ?? 0,
        processing_fee: dto.processing_fee ?? 0,
        delivery_days_min: dto.delivery_days_min ?? 1,
        delivery_days_max: dto.delivery_days_max ?? 7,
        required_documents: dto.required_documents ?? [],
        icon: dto.icon ?? null,
        is_popular: dto.is_popular ?? false,
        is_active: dto.is_active ?? true,
      })
      .select()
      .single();

    if (error || !data) {
      throw new InternalServerErrorException({
        code: 'DB_ERROR',
        message: error?.message ?? 'Failed to create service',
      });
    }
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

    const { data, error } = await this.supabaseService.admin
      .from('services')
      .update(dto)
      .eq('id', id)
      .select()
      .single();

    if (error || !data) {
      throw new NotFoundException({ code: 'SERVICE_NOT_FOUND', message: 'Service not found' });
    }
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
      throw new NotFoundException({ code: 'SERVICE_NOT_FOUND', message: 'Service not found' });
    }
    return { deleted: true, id };
  }
}

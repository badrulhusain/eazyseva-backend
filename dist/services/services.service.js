"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServicesService = void 0;
const common_1 = require("@nestjs/common");
const supabase_service_1 = require("../supabase/supabase.service");
let ServicesService = class ServicesService {
    supabaseService;
    constructor(supabaseService) {
        this.supabaseService = supabaseService;
    }
    async findAll(category) {
        let query = this.supabaseService.admin
            .from('services')
            .select('*')
            .eq('is_active', true)
            .order('is_popular', { ascending: false })
            .order('title', { ascending: true });
        if (category) {
            query = query.eq('category', category);
        }
        const { data, error } = await query;
        if (error)
            throw new common_1.InternalServerErrorException({ code: 'DB_ERROR', message: error.message });
        return data ?? [];
    }
    async findBySlug(slug) {
        const { data, error } = await this.supabaseService.admin
            .from('services')
            .select('*')
            .eq('slug', slug)
            .eq('is_active', true)
            .single();
        if (error || !data) {
            throw new common_1.NotFoundException({ code: 'SERVICE_NOT_FOUND', message: 'Service not found' });
        }
        return data;
    }
    async create(dto) {
        const { data: existing } = await this.supabaseService.admin
            .from('services')
            .select('id')
            .eq('slug', dto.slug)
            .maybeSingle();
        if (existing) {
            throw new common_1.ConflictException({
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
            throw new common_1.InternalServerErrorException({
                code: 'DB_ERROR',
                message: error?.message ?? 'Failed to create service',
            });
        }
        return data;
    }
    async update(id, dto) {
        if (dto.slug) {
            const { data: existing } = await this.supabaseService.admin
                .from('services')
                .select('id')
                .eq('slug', dto.slug)
                .neq('id', id)
                .maybeSingle();
            if (existing) {
                throw new common_1.ConflictException({
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
            throw new common_1.NotFoundException({ code: 'SERVICE_NOT_FOUND', message: 'Service not found' });
        }
        return data;
    }
    async softDelete(id) {
        const { data, error } = await this.supabaseService.admin
            .from('services')
            .update({ is_active: false })
            .eq('id', id)
            .select('id')
            .single();
        if (error || !data) {
            throw new common_1.NotFoundException({ code: 'SERVICE_NOT_FOUND', message: 'Service not found' });
        }
        return { deleted: true, id };
    }
};
exports.ServicesService = ServicesService;
exports.ServicesService = ServicesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [supabase_service_1.SupabaseService])
], ServicesService);
//# sourceMappingURL=services.service.js.map
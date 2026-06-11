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
var ServicesService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServicesService = void 0;
const common_1 = require("@nestjs/common");
const supabase_service_1 = require("../supabase/supabase.service");
const orders_service_1 = require("../orders/orders.service");
const LIST_COLUMNS = 'id, title, slug, category, price, govt_fee, processing_fee, delivery_days_min, delivery_days_max, icon, is_popular';
const DETAIL_COLUMNS = 'id, title, slug, description, category, price, govt_fee, processing_fee, delivery_days_min, delivery_days_max, required_documents, icon, is_popular, is_active, created_at, updated_at';
let ServicesService = ServicesService_1 = class ServicesService {
    supabaseService;
    ordersService;
    logger = new common_1.Logger(ServicesService_1.name);
    publicListCache = new Map();
    publicDetailCache = new Map();
    PUBLIC_CACHE_TTL = 30_000;
    constructor(supabaseService, ordersService) {
        this.supabaseService = supabaseService;
        this.ordersService = ordersService;
    }
    async findAll(category) {
        const cacheKey = category ?? '__all__';
        const cached = this.publicListCache.get(cacheKey);
        if (cached && cached.expiresAt > Date.now())
            return cached.data;
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
            throw new common_1.InternalServerErrorException({
                code: 'DB_ERROR',
                message: error.message,
            });
        const services = (data ?? []);
        this.publicListCache.set(cacheKey, {
            data: services,
            expiresAt: Date.now() + this.PUBLIC_CACHE_TTL,
        });
        return services;
    }
    async findAllAdmin() {
        const { data, error } = await this.supabaseService.admin
            .from('services')
            .select(DETAIL_COLUMNS)
            .order('is_popular', { ascending: false })
            .order('title', { ascending: true });
        if (error)
            throw new common_1.InternalServerErrorException({
                code: 'DB_ERROR',
                message: error.message,
            });
        return data ?? [];
    }
    async findBySlug(slug) {
        const cached = this.publicDetailCache.get(slug);
        if (cached && cached.expiresAt > Date.now())
            return cached.data;
        const { data, error } = await this.supabaseService.admin
            .from('services')
            .select(DETAIL_COLUMNS)
            .eq('slug', slug)
            .eq('is_active', true)
            .single();
        if (error || !data) {
            throw new common_1.NotFoundException({
                code: 'SERVICE_NOT_FOUND',
                message: 'Service not found',
            });
        }
        const service = data;
        this.publicDetailCache.set(slug, {
            data: service,
            expiresAt: Date.now() + this.PUBLIC_CACHE_TTL,
        });
        return service;
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
            throw new common_1.InternalServerErrorException({
                code: 'DB_ERROR',
                message: error?.message ?? 'Failed to create service',
            });
        }
        this.logger.log(`Service created: ${data.id} slug=${dto.slug}`);
        this.invalidatePublicCache();
        this.ordersService.invalidateServiceCache();
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
        const patch = {};
        if (dto.title !== undefined)
            patch.title = dto.title;
        if (dto.slug !== undefined)
            patch.slug = dto.slug;
        if (dto.description !== undefined)
            patch.description = dto.description;
        if (dto.category !== undefined)
            patch.category = dto.category;
        if (dto.price !== undefined)
            patch.price = dto.price;
        if (dto.govtFee !== undefined)
            patch.govt_fee = dto.govtFee;
        if (dto.processingFee !== undefined)
            patch.processing_fee = dto.processingFee;
        if (dto.deliveryDaysMin !== undefined)
            patch.delivery_days_min = dto.deliveryDaysMin;
        if (dto.deliveryDaysMax !== undefined)
            patch.delivery_days_max = dto.deliveryDaysMax;
        if (dto.requiredDocuments !== undefined)
            patch.required_documents = dto.requiredDocuments;
        if (dto.icon !== undefined)
            patch.icon = dto.icon;
        if (dto.isPopular !== undefined)
            patch.is_popular = dto.isPopular;
        if (dto.isActive !== undefined)
            patch.is_active = dto.isActive;
        const { data, error } = await this.supabaseService.admin
            .from('services')
            .update(patch)
            .eq('id', id)
            .select()
            .single();
        if (error || !data) {
            throw new common_1.NotFoundException({
                code: 'SERVICE_NOT_FOUND',
                message: 'Service not found',
            });
        }
        this.logger.log(`Service updated: ${id}`);
        this.invalidatePublicCache();
        this.ordersService.invalidateServiceCache();
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
            throw new common_1.NotFoundException({
                code: 'SERVICE_NOT_FOUND',
                message: 'Service not found',
            });
        }
        this.logger.log(`Service soft-deleted: ${id}`);
        this.invalidatePublicCache();
        this.ordersService.invalidateServiceCache();
        return { deleted: true, id };
    }
    invalidatePublicCache() {
        this.publicListCache.clear();
        this.publicDetailCache.clear();
    }
};
exports.ServicesService = ServicesService;
exports.ServicesService = ServicesService = ServicesService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [supabase_service_1.SupabaseService,
        orders_service_1.OrdersService])
], ServicesService);
//# sourceMappingURL=services.service.js.map
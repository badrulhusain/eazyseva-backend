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
var OrdersService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrdersService = void 0;
const common_1 = require("@nestjs/common");
const supabase_service_1 = require("../supabase/supabase.service");
const ORDER_FULL_COLS = 'id, order_number, user_id, service_type, customer_name, customer_phone, ' +
    'customer_dob, customer_address, documents, price_government_fee, ' +
    'price_service_charge, price_document_handling, price_total, status, ' +
    'payment_status, payment_method, demo_transaction_id, payment_currency, ' +
    'paid_at, payment_failure_reason, timeline, created_at, updated_at';
const ORDER_LIST_COLS = 'id, order_number, service_type, customer_name, customer_phone, status, ' +
    'payment_status, price_total, created_at, updated_at';
let OrdersService = OrdersService_1 = class OrdersService {
    supabaseService;
    logger = new common_1.Logger(OrdersService_1.name);
    constructor(supabaseService) {
        this.supabaseService = supabaseService;
    }
    servicesCache = new Map();
    SERVICES_CACHE_TTL = 30_000;
    async create(dto, userId) {
        const service = await this.getServiceBySlug(dto.serviceType);
        if (!service) {
            throw new common_1.BadRequestException({
                code: 'INVALID_SERVICE',
                message: `Service "${dto.serviceType}" not found or is not currently available.`,
            });
        }
        const governmentFee = Number(service.govt_fee ?? 0);
        const serviceCharge = Number(service.processing_fee ?? 0);
        const documentHandling = 0;
        const total = Number(service.price) + governmentFee + serviceCharge + documentHandling;
        const { data: orderNumber, error: seqError } = await this.supabaseService.admin.rpc('next_order_number');
        if (seqError || !orderNumber) {
            throw new common_1.InternalServerErrorException({
                code: 'ORDER_NUMBER_FAILED',
                message: 'Failed to generate order number',
            });
        }
        const { data, error } = await this.supabaseService.admin
            .from('orders')
            .insert({
            order_number: orderNumber,
            user_id: userId,
            service_type: dto.serviceType,
            customer_name: dto.customer.name,
            customer_phone: dto.customer.phone,
            customer_dob: dto.customer.dateOfBirth,
            customer_address: dto.customer.address,
            documents: dto.documents ?? [],
            price_government_fee: governmentFee,
            price_service_charge: serviceCharge,
            price_document_handling: documentHandling,
            price_total: total,
            status: 'PENDING',
            payment_status: 'NOT_PAID',
        })
            .select()
            .single();
        if (error || !data) {
            throw new common_1.InternalServerErrorException({
                code: 'DB_ERROR',
                message: error?.message ?? 'Failed to create order',
            });
        }
        const order = OrdersService_1.formatRow(data);
        this.logger.log(`Order created: ${order.orderNumber} user=${userId} total=${total}`);
        return order;
    }
    async findMyOrders(userId) {
        const { data, error } = await this.supabaseService.admin
            .from('orders')
            .select(ORDER_FULL_COLS)
            .eq('user_id', userId)
            .order('created_at', { ascending: false });
        if (error) {
            throw new common_1.InternalServerErrorException({ code: 'DB_ERROR', message: error.message });
        }
        return (data ?? []).map(OrdersService_1.formatRow);
    }
    async findOne(id, userId) {
        const { data, error } = await this.supabaseService.admin
            .from('orders')
            .select(ORDER_FULL_COLS)
            .eq('id', id)
            .eq('user_id', userId)
            .single();
        if (error || !data) {
            throw new common_1.NotFoundException({ code: 'ORDER_NOT_FOUND', message: 'Order not found' });
        }
        return OrdersService_1.formatRow(data);
    }
    async findAll(pagination) {
        const { page, limit, status } = pagination;
        const from = (page - 1) * limit;
        const to = from + limit - 1;
        let query = this.supabaseService.admin
            .from('orders')
            .select(ORDER_LIST_COLS, { count: 'planned' })
            .order('created_at', { ascending: false })
            .range(from, to);
        if (status) {
            query = query.eq('status', status);
        }
        const { data, error, count } = await query;
        if (error) {
            throw new common_1.InternalServerErrorException({ code: 'DB_ERROR', message: error.message });
        }
        return {
            data: (data ?? []).map(OrdersService_1.formatListRow),
            total: count ?? 0,
            page,
            limit,
        };
    }
    async findOneAdmin(id) {
        const { data, error } = await this.supabaseService.admin
            .from('orders')
            .select(ORDER_FULL_COLS)
            .eq('id', id)
            .single();
        if (error || !data) {
            throw new common_1.NotFoundException({ code: 'ORDER_NOT_FOUND', message: 'Order not found' });
        }
        return OrdersService_1.formatRow(data);
    }
    async updateStatus(id, dto) {
        const { data, error } = await this.supabaseService.admin
            .from('orders')
            .update({ status: dto.status })
            .eq('id', id)
            .select(ORDER_FULL_COLS)
            .single();
        if (error || !data) {
            throw new common_1.NotFoundException({ code: 'ORDER_NOT_FOUND', message: 'Order not found' });
        }
        return OrdersService_1.formatRow(data);
    }
    invalidateServiceCache(slug) {
        if (slug) {
            this.servicesCache.delete(slug);
        }
        else {
            this.servicesCache.clear();
        }
    }
    async getServiceBySlug(slug) {
        const cached = this.servicesCache.get(slug);
        if (cached && cached.expiresAt > Date.now())
            return cached.data;
        const { data, error } = await this.supabaseService.admin
            .from('services')
            .select('id, price, govt_fee, processing_fee')
            .eq('slug', slug)
            .eq('is_active', true)
            .maybeSingle();
        if (error) {
            throw new common_1.InternalServerErrorException({ code: 'DB_ERROR', message: error.message });
        }
        this.servicesCache.set(slug, { data: data ?? null, expiresAt: Date.now() + this.SERVICES_CACHE_TTL });
        return data ?? null;
    }
    static formatRow(row) {
        return {
            id: row.id,
            orderNumber: row.order_number,
            userId: row.user_id,
            serviceType: row.service_type,
            customer: {
                name: row.customer_name,
                phone: row.customer_phone,
                dateOfBirth: row.customer_dob,
                address: row.customer_address,
            },
            documents: row.documents,
            price: {
                governmentFee: Number(row.price_government_fee),
                serviceCharge: Number(row.price_service_charge),
                documentHandling: Number(row.price_document_handling),
                total: Number(row.price_total),
            },
            status: row.status,
            paymentStatus: row.payment_status,
            payment: {
                method: row.payment_method ?? null,
                demoTransactionId: row.demo_transaction_id ?? null,
                amount: Number(row.price_total),
                currency: row.payment_currency ?? 'INR',
                paidAt: row.paid_at ?? null,
                failureReason: row.payment_failure_reason ?? null,
            },
            timeline: row.timeline ?? [],
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }
    static formatListRow(row) {
        return {
            id: row.id,
            orderNumber: row.order_number,
            serviceType: row.service_type,
            customerName: row.customer_name,
            customerPhone: row.customer_phone,
            status: row.status,
            paymentStatus: row.payment_status,
            priceTotal: Number(row.price_total),
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }
};
exports.OrdersService = OrdersService;
exports.OrdersService = OrdersService = OrdersService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [supabase_service_1.SupabaseService])
], OrdersService);
//# sourceMappingURL=orders.service.js.map
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
let OrdersService = OrdersService_1 = class OrdersService {
    supabaseService;
    constructor(supabaseService) {
        this.supabaseService = supabaseService;
    }
    async create(dto, userId) {
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
            price_government_fee: dto.price.governmentFee ?? 0,
            price_service_charge: dto.price.serviceCharge ?? 0,
            price_document_handling: dto.price.documentHandling ?? 0,
            price_total: dto.price.total,
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
        return OrdersService_1.formatRow(data);
    }
    async findMyOrders(userId) {
        const { data, error } = await this.supabaseService.admin
            .from('orders')
            .select('*')
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
            .select('*')
            .eq('id', id)
            .single();
        if (error || !data) {
            throw new common_1.NotFoundException({ code: 'ORDER_NOT_FOUND', message: 'Order not found' });
        }
        const row = data;
        if (row.user_id !== userId) {
            throw new common_1.NotFoundException({ code: 'ORDER_NOT_FOUND', message: 'Order not found' });
        }
        return OrdersService_1.formatRow(row);
    }
    async findAll() {
        const { data, error } = await this.supabaseService.admin
            .from('orders')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) {
            throw new common_1.InternalServerErrorException({ code: 'DB_ERROR', message: error.message });
        }
        return (data ?? []).map(OrdersService_1.formatRow);
    }
    async updateStatus(id, dto) {
        const { data, error } = await this.supabaseService.admin
            .from('orders')
            .update({ status: dto.status })
            .eq('id', id)
            .select()
            .single();
        if (error || !data) {
            throw new common_1.NotFoundException({ code: 'ORDER_NOT_FOUND', message: 'Order not found' });
        }
        return OrdersService_1.formatRow(data);
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
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
const audit_logs_service_1 = require("../audit-logs/audit-logs.service");
const documents_service_1 = require("../documents/documents.service");
const ORDER_FULL_COLS = 'id, order_number, user_id, service_type, customer_name, customer_phone, ' +
    'customer_dob, customer_address, documents, price_government_fee, ' +
    'price_service_charge, price_document_handling, price_total, status, ' +
    'payment_status, payment_method, demo_transaction_id, payment_currency, ' +
    'paid_at, payment_failure_reason, timeline, ' +
    'rejection_reason, admin_note, reviewed_by, reviewed_at, ' +
    'created_at, updated_at';
const ORDER_LIST_COLS = 'id, order_number, service_type, customer_name, customer_phone, status, ' +
    'payment_status, price_total, created_at, updated_at';
const STATUS_TRANSITIONS = {
    PENDING: ['UNDER_REVIEW', 'ACCEPTED', 'REJECTED', 'CANCELLED'],
    UNDER_REVIEW: ['ACCEPTED', 'REJECTED', 'CORRECTION_REQUESTED', 'CANCELLED'],
    CORRECTION_REQUESTED: ['UNDER_REVIEW', 'ACCEPTED', 'REJECTED', 'CANCELLED'],
    ACCEPTED: ['PROCESSING', 'CANCELLED'],
    PROCESSING: ['COMPLETED'],
    COMPLETED: [],
    REJECTED: [],
    CANCELLED: [],
};
const STATUS_AUDIT_ACTIONS = {
    ACCEPTED: 'ADMIN_ACCEPTED_ORDER',
    REJECTED: 'ADMIN_REJECTED_ORDER',
    CORRECTION_REQUESTED: 'ADMIN_REQUESTED_CORRECTION',
    COMPLETED: 'ADMIN_COMPLETED_ORDER',
};
function buildTimelineEvent(status, reason) {
    switch (status) {
        case 'UNDER_REVIEW':
            return 'Order moved under review';
        case 'ACCEPTED':
            return 'Order accepted by admin';
        case 'CORRECTION_REQUESTED':
            return reason
                ? `Correction requested: ${reason}`
                : 'Correction requested';
        case 'PROCESSING':
            return 'Order is being processed';
        case 'COMPLETED':
            return 'Order completed';
        case 'REJECTED':
            return reason ? `Order rejected: ${reason}` : 'Order rejected';
        case 'CANCELLED':
            return reason ? `Order cancelled: ${reason}` : 'Order cancelled';
        default:
            return `Status changed to ${status}`;
    }
}
let OrdersService = OrdersService_1 = class OrdersService {
    supabaseService;
    auditLogsService;
    orderDocumentsService;
    logger = new common_1.Logger(OrdersService_1.name);
    constructor(supabaseService, auditLogsService, orderDocumentsService) {
        this.supabaseService = supabaseService;
        this.auditLogsService = auditLogsService;
        this.orderDocumentsService = orderDocumentsService;
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
        const orderNumberResult = (await this.supabaseService.admin.rpc('next_order_number'));
        const { data: orderNumber, error: seqError } = orderNumberResult;
        if (seqError || !orderNumber) {
            throw new common_1.InternalServerErrorException({
                code: 'ORDER_NUMBER_FAILED',
                message: 'Failed to generate order number',
            });
        }
        const insertResult = (await this.supabaseService.admin
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
            .single());
        const { data, error } = insertResult;
        if (error || !data) {
            throw new common_1.InternalServerErrorException({
                code: 'DB_ERROR',
                message: error?.message ?? 'Failed to create order',
            });
        }
        const order = OrdersService_1.formatRow(data);
        this.logger.log(`Order created: ${order.orderNumber} user=${userId} total=${total}`);
        this.orderDocumentsService
            .trackDocuments(order.id, userId, dto.documents ?? [])
            .catch((err) => {
            this.logger.error(`Failed to track documents for order=${order.id}: ${err instanceof Error ? err.message : err}`);
        });
        return order;
    }
    async findMyOrders(userId, pagination) {
        const { page, limit, status, search, dateFrom, dateTo } = pagination;
        const from = (page - 1) * limit;
        const to = from + limit - 1;
        let query = this.supabaseService.admin
            .from('orders')
            .select(ORDER_FULL_COLS, { count: 'planned' })
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .range(from, to);
        if (status) {
            query = query.eq('status', status);
        }
        if (search?.trim()) {
            const term = `%${search.trim()}%`;
            query = query.or(`order_number.ilike.${term},customer_name.ilike.${term},customer_phone.ilike.${term}`);
        }
        if (dateFrom) {
            query = query.gte('created_at', dateFrom);
        }
        if (dateTo) {
            query = query.lte('created_at', dateTo);
        }
        const { data, error, count } = await query;
        if (error) {
            throw new common_1.InternalServerErrorException({
                code: 'DB_ERROR',
                message: error.message,
            });
        }
        return {
            data: (data ?? []).map((row) => OrdersService_1.formatRow(row)),
            total: count ?? 0,
            page,
            limit,
        };
    }
    async findOne(id, userId) {
        const { data, error } = await this.supabaseService.admin
            .from('orders')
            .select(ORDER_FULL_COLS)
            .eq('id', id)
            .eq('user_id', userId)
            .single();
        if (error) {
            if (error.code === 'PGRST116') {
                throw new common_1.NotFoundException({
                    code: 'ORDER_NOT_FOUND',
                    message: 'Order not found',
                });
            }
            this.logger.error(`findOne db error id=${id} uid=${userId}: [${error.code}] ${error.message}`);
            throw new common_1.InternalServerErrorException({
                code: 'DB_ERROR',
                message: error.message,
            });
        }
        if (!data) {
            throw new common_1.NotFoundException({
                code: 'ORDER_NOT_FOUND',
                message: 'Order not found',
            });
        }
        return OrdersService_1.formatRow(data);
    }
    async findAll(pagination) {
        const { page, limit, status, search, dateFrom, dateTo } = pagination;
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
        if (search?.trim()) {
            const term = `%${search.trim()}%`;
            query = query.or(`order_number.ilike.${term},customer_name.ilike.${term},customer_phone.ilike.${term}`);
        }
        if (dateFrom) {
            query = query.gte('created_at', dateFrom);
        }
        if (dateTo) {
            query = query.lte('created_at', dateTo);
        }
        const { data, error, count } = await query;
        if (error) {
            throw new common_1.InternalServerErrorException({
                code: 'DB_ERROR',
                message: error.message,
            });
        }
        return {
            data: (data ?? []).map((row) => OrdersService_1.formatListRow(row)),
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
        if (error) {
            if (error.code === 'PGRST116') {
                throw new common_1.NotFoundException({
                    code: 'ORDER_NOT_FOUND',
                    message: 'Order not found',
                });
            }
            this.logger.error(`findOneAdmin db error id=${id}: [${error.code}] ${error.message}`);
            throw new common_1.InternalServerErrorException({
                code: 'DB_ERROR',
                message: error.message,
            });
        }
        if (!data) {
            throw new common_1.NotFoundException({
                code: 'ORDER_NOT_FOUND',
                message: 'Order not found',
            });
        }
        return OrdersService_1.formatRow(data);
    }
    async updateStatus(id, dto, adminId) {
        if ((dto.status === 'REJECTED' || dto.status === 'CORRECTION_REQUESTED') &&
            !dto.reason?.trim()) {
            throw new common_1.BadRequestException({
                code: 'REASON_REQUIRED',
                message: 'A reason is required when rejecting an order or requesting a correction',
            });
        }
        return this.applyStatusChange(id, dto.status, adminId, {
            reason: dto.reason,
            adminNote: dto.adminNote,
        });
    }
    async acceptOrder(id, adminId) {
        return this.applyStatusChange(id, 'ACCEPTED', adminId);
    }
    async rejectOrder(id, dto, adminId) {
        return this.applyStatusChange(id, 'REJECTED', adminId, {
            reason: dto.note,
        });
    }
    async requestCorrection(id, dto, adminId) {
        return this.applyStatusChange(id, 'CORRECTION_REQUESTED', adminId, {
            reason: dto.note,
        });
    }
    async completeOrder(id, adminId) {
        return this.applyStatusChange(id, 'COMPLETED', adminId);
    }
    async applyStatusChange(id, nextStatus, adminId, opts = {}) {
        const current = await this.findOneAdmin(id);
        this.assertValidTransition(current.status, nextStatus);
        const now = new Date().toISOString();
        const timelineEntry = {
            event: buildTimelineEvent(nextStatus, opts.reason),
            timestamp: now,
        };
        const updatePayload = {
            status: nextStatus,
            timeline: [...(current.timeline ?? []), timelineEntry],
            reviewed_by: adminId,
            reviewed_at: now,
        };
        if (nextStatus === 'REJECTED') {
            updatePayload.rejection_reason = opts.reason.trim();
        }
        if (nextStatus === 'CORRECTION_REQUESTED') {
            updatePayload.admin_note = opts.reason.trim();
        }
        if (opts.adminNote?.trim()) {
            updatePayload.admin_note = opts.adminNote.trim();
        }
        const { data, error } = await this.supabaseService.admin
            .from('orders')
            .update(updatePayload)
            .eq('id', id)
            .select(ORDER_FULL_COLS)
            .single();
        if (error) {
            if (error.code === 'PGRST116') {
                throw new common_1.NotFoundException({
                    code: 'ORDER_NOT_FOUND',
                    message: 'Order not found',
                });
            }
            this.logger.error(`applyStatusChange db error id=${id}: [${error.code}] ${error.message}`);
            throw new common_1.InternalServerErrorException({
                code: 'DB_ERROR',
                message: error.message,
            });
        }
        if (!data) {
            throw new common_1.NotFoundException({
                code: 'ORDER_NOT_FOUND',
                message: 'Order not found',
            });
        }
        const updated = OrdersService_1.formatRow(data);
        this.logger.log(`Order ${updated.orderNumber} status: ${current.status} → ${nextStatus} by admin=${adminId}`);
        const auditAction = STATUS_AUDIT_ACTIONS[nextStatus];
        if (auditAction) {
            void this.auditLogsService.record(adminId, auditAction, 'order', updated.id, {
                orderNumber: updated.orderNumber,
                previousStatus: current.status,
                ...(opts.reason ? { reason: opts.reason.trim() } : {}),
            });
        }
        if (nextStatus === 'COMPLETED') {
            this.orderDocumentsService
                .scheduleForDeletion(updated.id, adminId)
                .catch((err) => {
                this.logger.error(`Failed to schedule documents for deletion order=${updated.id}: ${err instanceof Error ? err.message : err}`);
            });
        }
        return updated;
    }
    invalidateServiceCache(slug) {
        if (slug) {
            this.servicesCache.delete(slug);
        }
        else {
            this.servicesCache.clear();
        }
    }
    assertValidTransition(current, next) {
        const allowed = STATUS_TRANSITIONS[current];
        if (!allowed.includes(next)) {
            const terminalMsg = allowed.length === 0
                ? `Status "${current}" is final and cannot be changed.`
                : `Cannot transition from "${current}" to "${next}". Allowed: ${allowed.join(', ')}.`;
            throw new common_1.BadRequestException({
                code: 'INVALID_STATUS_TRANSITION',
                message: terminalMsg,
            });
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
            throw new common_1.InternalServerErrorException({
                code: 'DB_ERROR',
                message: error.message,
            });
        }
        this.servicesCache.set(slug, {
            data: data ?? null,
            expiresAt: Date.now() + this.SERVICES_CACHE_TTL,
        });
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
            rejectionReason: row.rejection_reason ?? null,
            adminNote: row.admin_note ?? null,
            reviewedBy: row.reviewed_by ?? null,
            reviewedAt: row.reviewed_at ?? null,
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
    __metadata("design:paramtypes", [supabase_service_1.SupabaseService,
        audit_logs_service_1.AuditLogsService,
        documents_service_1.OrderDocumentsService])
], OrdersService);
//# sourceMappingURL=orders.service.js.map
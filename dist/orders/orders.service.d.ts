import { SupabaseService } from '../supabase/supabase.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { OrderDocumentsService } from '../documents/documents.service';
import type { CreateOrderDto } from './dto/create-order.dto';
import type { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import type { RejectOrderDto } from './dto/reject-order.dto';
import type { RequestCorrectionDto } from './dto/request-correction.dto';
import type { AdminOrderSummary, AdminDashboardStats, Order, PublicTrackedOrder } from './orders.types';
import type { PaginationDto } from '../common/dto/pagination.dto';
interface PaginatedOrders<T> {
    data: T[];
    total: number;
    page: number;
    limit: number;
}
export declare class OrdersService {
    private readonly supabaseService;
    private readonly auditLogsService;
    private readonly orderDocumentsService;
    private readonly logger;
    constructor(supabaseService: SupabaseService, auditLogsService: AuditLogsService, orderDocumentsService: OrderDocumentsService);
    private readonly servicesCache;
    private readonly SERVICES_CACHE_TTL;
    private readonly adminListCache;
    private readonly adminStatsCache;
    private readonly ADMIN_LIST_CACHE_TTL;
    private readonly ADMIN_STATS_CACHE_TTL;
    create(dto: CreateOrderDto, userId: string): Promise<Order>;
    findMyOrders(userId: string, pagination: PaginationDto): Promise<PaginatedOrders<Order>>;
    findOne(id: string, userId: string): Promise<Order>;
    trackPublic(orderNumber: string, phone: string): Promise<PublicTrackedOrder>;
    createReceipt(id: string, userId: string): Promise<Buffer>;
    findAll(pagination: PaginationDto): Promise<{
        data: AdminOrderSummary[];
        total: number;
        page: number;
        limit: number;
    }>;
    findOneAdmin(id: string): Promise<Order>;
    getDashboardStats(): Promise<AdminDashboardStats>;
    updateStatus(id: string, dto: UpdateOrderStatusDto, adminId: string): Promise<Order>;
    acceptOrder(id: string, adminId: string): Promise<Order>;
    rejectOrder(id: string, dto: RejectOrderDto, adminId: string): Promise<Order>;
    requestCorrection(id: string, dto: RequestCorrectionDto, adminId: string): Promise<Order>;
    completeOrder(id: string, adminId: string): Promise<Order>;
    private applyStatusChange;
    invalidateServiceCache(slug?: string): void;
    invalidateAdminReadCaches(): void;
    private assertValidTransition;
    private getServiceBySlug;
    private validateDocumentReferences;
    private validateRequiredDocuments;
    private findByIdempotencyKey;
    private renderReceipt;
    private static formatRow;
    private static formatListRow;
    private static adminListCacheKey;
}
export {};

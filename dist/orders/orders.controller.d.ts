import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { RejectOrderDto } from './dto/reject-order.dto';
import { RequestCorrectionDto } from './dto/request-correction.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import type { CurrentUser as CurrentUserType } from '../common/types/current-user.type';
import { TrackOrderDto } from './dto/track-order.dto';
import type { Response } from 'express';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { QueryAuditLogDto } from '../audit-logs/dto/query-audit-log.dto';
export declare class OrdersController {
    private readonly ordersService;
    constructor(ordersService: OrdersService);
    create(dto: CreateOrderDto, user: CurrentUserType): Promise<{
        success: boolean;
        data: import("./orders.types").Order;
    }>;
    getMyOrders(user: CurrentUserType, query: PaginationDto): Promise<{
        data: import("./orders.types").Order[];
        total: number;
        page: number;
        limit: number;
        success: boolean;
    }>;
    track(dto: TrackOrderDto): Promise<{
        success: boolean;
        data: import("./orders.types").PublicTrackedOrder;
    }>;
    receipt(id: string, user: CurrentUserType, response: Response): Promise<Buffer<ArrayBufferLike>>;
    findOne(id: string, user: CurrentUserType): Promise<{
        success: boolean;
        data: import("./orders.types").Order;
    }>;
}
export declare class AdminOrdersController {
    private readonly ordersService;
    private readonly auditLogsService;
    constructor(ordersService: OrdersService, auditLogsService: AuditLogsService);
    findAll(query: PaginationDto): Promise<{
        data: import("./orders.types").AdminOrderSummary[];
        total: number;
        page: number;
        limit: number;
        success: boolean;
    }>;
    stats(): Promise<{
        success: boolean;
        data: import("./orders.types").AdminDashboardStats;
    }>;
    activity(query: QueryAuditLogDto): Promise<{
        data: import("./orders.types").AdminActivityItem[];
        total: number;
        page: number;
        limit: number;
        success: boolean;
    }>;
    findOne(id: string): Promise<{
        success: boolean;
        data: import("./orders.types").Order;
    }>;
    updateStatus(id: string, dto: UpdateOrderStatusDto, user: CurrentUserType): Promise<{
        success: boolean;
        data: import("./orders.types").Order;
    }>;
    accept(id: string, user: CurrentUserType): Promise<{
        success: boolean;
        data: import("./orders.types").Order;
    }>;
    reject(id: string, dto: RejectOrderDto, user: CurrentUserType): Promise<{
        success: boolean;
        data: import("./orders.types").Order;
    }>;
    requestCorrection(id: string, dto: RequestCorrectionDto, user: CurrentUserType): Promise<{
        success: boolean;
        data: import("./orders.types").Order;
    }>;
    complete(id: string, user: CurrentUserType): Promise<{
        success: boolean;
        data: import("./orders.types").Order;
    }>;
}

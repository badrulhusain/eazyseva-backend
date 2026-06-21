import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { RejectOrderDto } from './dto/reject-order.dto';
import { RequestCorrectionDto } from './dto/request-correction.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import type { CurrentUser as CurrentUserType } from '../common/types/current-user.type';
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
    findOne(id: string, user: CurrentUserType): Promise<{
        success: boolean;
        data: import("./orders.types").Order;
    }>;
}
export declare class AdminOrdersController {
    private readonly ordersService;
    constructor(ordersService: OrdersService);
    findAll(query: PaginationDto): Promise<{
        data: import("./orders.types").AdminOrderSummary[];
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

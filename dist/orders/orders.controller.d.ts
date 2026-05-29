import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import type { CurrentUser as CurrentUserType } from '../common/types/current-user.type';
export declare class OrdersController {
    private readonly ordersService;
    constructor(ordersService: OrdersService);
    create(dto: CreateOrderDto, user: CurrentUserType): Promise<{
        success: boolean;
        data: import("./orders.types").Order;
    }>;
    getMyOrders(user: CurrentUserType): Promise<{
        success: boolean;
        data: import("./orders.types").Order[];
    }>;
    findOne(id: string, user: CurrentUserType): Promise<{
        success: boolean;
        data: import("./orders.types").Order;
    }>;
}
export declare class AdminOrdersController {
    private readonly ordersService;
    constructor(ordersService: OrdersService);
    findAll(): Promise<{
        success: boolean;
        data: import("./orders.types").Order[];
    }>;
    updateStatus(id: string, dto: UpdateOrderStatusDto): Promise<{
        success: boolean;
        data: import("./orders.types").Order;
    }>;
}

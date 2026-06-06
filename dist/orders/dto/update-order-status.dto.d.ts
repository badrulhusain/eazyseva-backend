import type { OrderStatus } from '../orders.types';
export declare class UpdateOrderStatusDto {
    status: OrderStatus;
    reason?: string;
    adminNote?: string;
}

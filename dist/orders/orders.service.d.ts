import { SupabaseService } from '../supabase/supabase.service';
import type { CreateOrderDto } from './dto/create-order.dto';
import type { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import type { Order } from './orders.types';
export declare class OrdersService {
    private readonly supabaseService;
    constructor(supabaseService: SupabaseService);
    create(dto: CreateOrderDto, userId: string): Promise<Order>;
    findMyOrders(userId: string): Promise<Order[]>;
    findOne(id: string, userId: string): Promise<Order>;
    findAll(): Promise<Order[]>;
    updateStatus(id: string, dto: UpdateOrderStatusDto): Promise<Order>;
    private static formatRow;
}

import { SupabaseService } from '../supabase/supabase.service';
import type { CreateOrderDto } from './dto/create-order.dto';
import type { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import type { Order } from './orders.types';
import type { PaginationDto } from '../common/dto/pagination.dto';
export declare class OrdersService {
    private readonly supabaseService;
    private readonly logger;
    constructor(supabaseService: SupabaseService);
    private readonly servicesCache;
    private readonly SERVICES_CACHE_TTL;
    create(dto: CreateOrderDto, userId: string): Promise<Order>;
    findMyOrders(userId: string): Promise<Order[]>;
    findOne(id: string, userId: string): Promise<Order>;
    findAll(pagination: PaginationDto): Promise<{
        data: Order[];
        total: number;
        page: number;
        limit: number;
    }>;
    findOneAdmin(id: string): Promise<Order>;
    updateStatus(id: string, dto: UpdateOrderStatusDto): Promise<Order>;
    invalidateServiceCache(slug?: string): void;
    private getServiceBySlug;
    private static formatRow;
}

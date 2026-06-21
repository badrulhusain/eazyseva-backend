import { SupabaseService } from '../supabase/supabase.service';
import { OrdersService } from '../orders/orders.service';
import type { ServiceListItem, ServiceItem } from './services.types';
import type { CreateServiceDto } from './dto/create-service.dto';
import type { ServiceQueryDto } from './dto/query-service.dto';
import type { UpdateServiceDto } from './dto/update-service.dto';
interface PaginatedServices<T> {
    data: T[];
    total: number;
    page: number;
    limit: number;
}
export declare class ServicesService {
    private readonly supabaseService;
    private readonly ordersService;
    private readonly logger;
    private readonly publicListCache;
    private readonly publicDetailCache;
    private readonly PUBLIC_CACHE_TTL;
    constructor(supabaseService: SupabaseService, ordersService: OrdersService);
    findAll(query: ServiceQueryDto): Promise<PaginatedServices<ServiceListItem>>;
    findAllAdmin(query: ServiceQueryDto): Promise<PaginatedServices<ServiceItem>>;
    findBySlug(slug: string): Promise<ServiceItem>;
    findById(id: string): Promise<ServiceItem>;
    create(dto: CreateServiceDto): Promise<ServiceItem>;
    update(id: string, dto: UpdateServiceDto): Promise<ServiceItem>;
    softDelete(id: string): Promise<{
        deleted: true;
        id: string;
    }>;
    private invalidatePublicCache;
    private static publicListCacheKey;
}
export {};

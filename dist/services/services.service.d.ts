import { SupabaseService } from '../supabase/supabase.service';
import { OrdersService } from '../orders/orders.service';
import type { ServiceCategory, ServiceListItem, ServiceItem } from './services.types';
import type { CreateServiceDto } from './dto/create-service.dto';
import type { UpdateServiceDto } from './dto/update-service.dto';
export declare class ServicesService {
    private readonly supabaseService;
    private readonly ordersService;
    private readonly logger;
    private readonly publicListCache;
    private readonly publicDetailCache;
    private readonly PUBLIC_CACHE_TTL;
    constructor(supabaseService: SupabaseService, ordersService: OrdersService);
    findAll(category?: ServiceCategory): Promise<ServiceListItem[]>;
    findAllAdmin(): Promise<ServiceItem[]>;
    findBySlug(slug: string): Promise<ServiceItem>;
    create(dto: CreateServiceDto): Promise<any>;
    update(id: string, dto: UpdateServiceDto): Promise<any>;
    softDelete(id: string): Promise<{
        deleted: boolean;
        id: string;
    }>;
    private invalidatePublicCache;
}

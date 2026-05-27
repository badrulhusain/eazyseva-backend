import { SupabaseService } from '../supabase/supabase.service';
import type { ServiceCategory } from './services.types';
import type { CreateServiceDto } from './dto/create-service.dto';
import type { UpdateServiceDto } from './dto/update-service.dto';
export declare class ServicesService {
    private readonly supabaseService;
    constructor(supabaseService: SupabaseService);
    findAll(category?: ServiceCategory): Promise<any[]>;
    findBySlug(slug: string): Promise<any>;
    create(dto: CreateServiceDto): Promise<any>;
    update(id: string, dto: UpdateServiceDto): Promise<any>;
    softDelete(id: string): Promise<{
        deleted: boolean;
        id: string;
    }>;
}

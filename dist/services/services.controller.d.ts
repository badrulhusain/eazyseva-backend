import { ServicesService } from './services.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import type { ServiceCategory } from './services.types';
export declare class ServicesController {
    private readonly servicesService;
    constructor(servicesService: ServicesService);
    findAll(category?: ServiceCategory): Promise<{
        success: boolean;
        data: import("./services.types").ServiceListItem[];
    }>;
    findBySlug(slug: string): Promise<{
        success: boolean;
        data: import("./services.types").ServiceItem;
    }>;
}
export declare class AdminServicesController {
    private readonly servicesService;
    constructor(servicesService: ServicesService);
    create(dto: CreateServiceDto): Promise<{
        success: boolean;
        data: any;
    }>;
    update(id: string, dto: UpdateServiceDto): Promise<{
        success: boolean;
        data: any;
    }>;
    remove(id: string): Promise<{
        success: boolean;
        data: {
            deleted: boolean;
            id: string;
        };
    }>;
}

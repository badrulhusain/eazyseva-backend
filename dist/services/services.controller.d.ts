import { ServicesService } from './services.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { ServiceQueryDto } from './dto/query-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
export declare class ServicesController {
    private readonly servicesService;
    constructor(servicesService: ServicesService);
    findAll(query: ServiceQueryDto): Promise<{
        data: import("./services.types").ServiceListItem[];
        total: number;
        page: number;
        limit: number;
        success: boolean;
    }>;
    findBySlug(slug: string): Promise<{
        success: boolean;
        data: import("./services.types").ServiceItem;
    }>;
}
export declare class AdminServicesController {
    private readonly servicesService;
    constructor(servicesService: ServicesService);
    findAll(query: ServiceQueryDto): Promise<{
        data: import("./services.types").ServiceItem[];
        total: number;
        page: number;
        limit: number;
        success: boolean;
    }>;
    findById(id: string): Promise<{
        success: boolean;
        data: import("./services.types").ServiceItem;
    }>;
    create(dto: CreateServiceDto): Promise<{
        success: boolean;
        data: import("./services.types").ServiceItem;
    }>;
    update(id: string, dto: UpdateServiceDto): Promise<{
        success: boolean;
        data: import("./services.types").ServiceItem;
    }>;
    remove(id: string): Promise<{
        success: boolean;
        data: {
            deleted: true;
            id: string;
        };
    }>;
}

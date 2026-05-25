import { ServicesService } from './services.service';
import type { ServiceCategory } from './services.types';
export declare class ServicesController {
    private readonly servicesService;
    constructor(servicesService: ServicesService);
    findAll(category?: ServiceCategory): {
        success: boolean;
        data: import("./services.types").ServiceItem[];
    };
    findBySlug(slug: string): {
        success: boolean;
        data: import("./services.types").ServiceItem;
    };
}

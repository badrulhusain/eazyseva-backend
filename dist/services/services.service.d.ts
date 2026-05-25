import type { ServiceCategory, ServiceItem } from './services.types';
export declare class ServicesService {
    findAll(category?: ServiceCategory): ServiceItem[];
    findBySlug(slug: string): ServiceItem;
}

import type { ServiceCategory } from '../services.types';
export declare class CreateServiceDto {
    title: string;
    slug: string;
    description?: string;
    category: ServiceCategory;
    price: number;
    govt_fee?: number;
    processing_fee?: number;
    delivery_days_min?: number;
    delivery_days_max?: number;
    required_documents?: string[];
    icon?: string;
    is_popular?: boolean;
    is_active?: boolean;
}

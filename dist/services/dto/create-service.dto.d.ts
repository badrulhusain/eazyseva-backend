import type { ServiceCategory } from '../services.types';
export declare class RequiredDocumentDto {
    name: string;
    isRequired: boolean;
}
export declare class CreateServiceDto {
    title: string;
    slug: string;
    description?: string;
    category: ServiceCategory;
    price: number;
    govtFee?: number;
    processingFee?: number;
    deliveryDaysMin?: number;
    deliveryDaysMax?: number;
    requiredDocuments?: RequiredDocumentDto[];
    icon?: string;
    isPopular?: boolean;
    isActive?: boolean;
}

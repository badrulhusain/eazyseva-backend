export type ServiceCategory = 'ID_CARD' | 'CERTIFICATE' | 'TRAVEL' | 'FINANCIAL' | 'VEHICLE' | 'PROPERTY';
export interface ServiceItem {
    id: string;
    name: string;
    slug: string;
    category: ServiceCategory;
    price: number;
    govtFee: number;
    processingFee: number;
    deliveryDaysMin: number;
    deliveryDaysMax: number;
    requiredDocs: string[];
    isPopular: boolean;
    isActive: boolean;
    icon: string;
}

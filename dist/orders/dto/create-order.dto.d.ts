export declare class CustomerDto {
    name: string;
    phone: string;
    dateOfBirth: string;
    address: string;
}
export declare class DocumentDto {
    name: string;
    url: string;
    publicId?: string;
}
export declare class PriceDto {
    governmentFee?: number;
    serviceCharge?: number;
    documentHandling?: number;
    total: number;
}
export declare class CreateOrderDto {
    serviceType: string;
    customer: CustomerDto;
    documents?: DocumentDto[];
    price: PriceDto;
}

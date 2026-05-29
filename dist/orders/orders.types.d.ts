export type OrderStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'REJECTED';
export type PaymentStatus = 'NOT_PAID' | 'PAID' | 'FAILED';
export interface OrderDocument {
    name: string;
    url: string;
    publicId?: string;
}
export interface OrderCustomer {
    name: string;
    phone: string;
    dateOfBirth: string;
    address: string;
}
export interface OrderPrice {
    governmentFee: number;
    serviceCharge: number;
    documentHandling: number;
    total: number;
}
export interface Order {
    id: string;
    orderNumber: string;
    userId: string;
    serviceType: string;
    customer: OrderCustomer;
    documents: OrderDocument[];
    price: OrderPrice;
    status: OrderStatus;
    paymentStatus: PaymentStatus;
    createdAt: string;
    updatedAt: string;
}
export interface OrderRow {
    id: string;
    order_number: string;
    user_id: string;
    service_type: string;
    customer_name: string;
    customer_phone: string;
    customer_dob: string;
    customer_address: string;
    documents: OrderDocument[];
    price_government_fee: number | string;
    price_service_charge: number | string;
    price_document_handling: number | string;
    price_total: number | string;
    status: OrderStatus;
    payment_status: PaymentStatus;
    created_at: string;
    updated_at: string;
}

export type OrderStatus = 'PENDING' | 'UNDER_REVIEW' | 'ACCEPTED' | 'CORRECTION_REQUESTED' | 'PROCESSING' | 'COMPLETED' | 'REJECTED' | 'CANCELLED';
export type PaymentStatus = 'NOT_PAID' | 'PAYMENT_PENDING' | 'PAID' | 'FAILED';
export type DemoPaymentMethod = 'DEMO_UPI' | 'DEMO_CARD' | 'DEMO_CASH' | 'PAY_LATER';
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
export interface OrderPayment {
    method: DemoPaymentMethod | null;
    demoTransactionId: string | null;
    amount: number;
    currency: string;
    paidAt: string | null;
    failureReason: string | null;
}
export interface TimelineEntry {
    event: string;
    timestamp: string;
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
    payment: OrderPayment;
    timeline: TimelineEntry[];
    rejectionReason: string | null;
    adminNote: string | null;
    reviewedBy: string | null;
    reviewedAt: string | null;
    createdAt: string;
    updatedAt: string;
}
export interface AdminOrderSummary {
    id: string;
    orderNumber: string;
    serviceType: string;
    customerName: string;
    customerPhone: string;
    status: OrderStatus;
    paymentStatus: PaymentStatus;
    priceTotal: number;
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
    payment_method: DemoPaymentMethod | null;
    demo_transaction_id: string | null;
    payment_currency: string;
    paid_at: string | null;
    payment_failure_reason: string | null;
    timeline: TimelineEntry[];
    rejection_reason: string | null;
    admin_note: string | null;
    reviewed_by: string | null;
    reviewed_at: string | null;
    created_at: string;
    updated_at: string;
}

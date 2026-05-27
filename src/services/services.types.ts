export type ServiceCategory =
  | 'ID_CARD'
  | 'CERTIFICATE'
  | 'TRAVEL'
  | 'FINANCIAL'
  | 'VEHICLE'
  | 'PROPERTY'
  | 'SCHOLARSHIP'
  | 'FORM_FILLING'
  | 'GOVERNMENT_SCHEME';

export interface ServiceItem {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  category: ServiceCategory;
  price: number;
  govt_fee: number;
  processing_fee: number;
  delivery_days_min: number;
  delivery_days_max: number;
  required_documents: string[];
  icon: string | null;
  is_popular: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

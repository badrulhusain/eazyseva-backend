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

export interface ServiceListItem {
  id: string;
  title: string;
  slug: string;
  category: ServiceCategory;
  price: number;
  govt_fee: number;
  processing_fee: number;
  delivery_days_min: number;
  delivery_days_max: number;
  icon: string | null;
  is_popular: boolean;
}

export interface ServiceItem extends ServiceListItem {
  description: string | null;
  required_documents: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type OrderDocumentStatus =
  | 'active'
  | 'scheduled_for_deletion'
  | 'deleted'
  | 'deletion_failed';

export interface OrderDocumentRow {
  id: string;
  order_id: string;
  user_id: string;
  cloudinary_public_id: string;
  secure_url: string;
  original_name: string | null;
  mime_type: string | null;
  size: number | null;
  status: OrderDocumentStatus;
  delete_after: string | null;
  deleted_at: string | null;
  deletion_error: string | null;
  created_at: string;
  updated_at: string;
}

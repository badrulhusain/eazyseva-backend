-- ============================================================
-- EazySeva – Pagination and Search Indexes
-- Run in: Supabase Dashboard → SQL Editor
--
-- These indexes match paginated list endpoints introduced for:
--   - GET /services
--   - GET /admin/services
--   - GET /orders/my-orders
--
-- CONCURRENTLY is not used because Supabase's SQL Editor runs inside
-- a transaction. For a busy production database, run equivalent
-- CREATE INDEX CONCURRENTLY statements manually during a maintenance window.
-- ============================================================

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

-- Public services list:
-- WHERE is_active = true [AND category = ?]
-- ORDER BY is_popular DESC, title ASC
CREATE INDEX IF NOT EXISTS idx_services_active_category_popular_title
  ON public.services(is_active, category, is_popular DESC, title ASC);

-- Admin services list:
-- ORDER BY is_popular DESC, title ASC
CREATE INDEX IF NOT EXISTS idx_services_popular_title
  ON public.services(is_popular DESC, title ASC);

-- Services title search via ilike '%term%'.
CREATE INDEX IF NOT EXISTS idx_services_title_trgm
  ON public.services USING gin (title gin_trgm_ops);

-- User order history:
-- WHERE user_id = ? [AND status = ?] ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_orders_user_status_created_at
  ON public.orders(user_id, status, created_at DESC);

-- User/admin order text search via ilike '%term%'.
CREATE INDEX IF NOT EXISTS idx_orders_order_number_trgm
  ON public.orders USING gin (order_number gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_orders_customer_name_trgm
  ON public.orders USING gin (customer_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_orders_customer_phone_trgm
  ON public.orders USING gin (customer_phone gin_trgm_ops);

-- Blog title search already paginates; this makes ilike '%term%' scale.
CREATE INDEX IF NOT EXISTS idx_blogs_title_trgm
  ON public.blogs USING gin (title gin_trgm_ops);

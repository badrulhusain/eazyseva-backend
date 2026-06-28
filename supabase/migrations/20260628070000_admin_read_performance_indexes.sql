-- EzySeva admin read performance indexes.
-- These match the dashboard/list queries that poll frequently from the admin UI.
-- For busy production databases, run equivalent CREATE INDEX CONCURRENTLY
-- statements manually outside Supabase SQL Editor's transaction wrapper.

CREATE INDEX IF NOT EXISTS idx_orders_created_at_desc
  ON public.orders(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_status_created_at_desc
  ON public.orders(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_user_created_at_desc
  ON public.orders(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_blogs_created_at_desc
  ON public.blogs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_blogs_status_created_at_desc
  ON public.blogs(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_blogs_category_created_at_desc
  ON public.blogs(category, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_services_category_popular_title
  ON public.services(category, is_popular DESC, title ASC);

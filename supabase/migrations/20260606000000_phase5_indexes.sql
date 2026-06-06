-- ============================================================
-- EazySeva Phase 5 – Performance Indexes
-- Run in: Supabase Dashboard → SQL Editor
--
-- All indexes use IF NOT EXISTS so this script is safe to re-run.
-- CONCURRENTLY is not used here because Supabase's SQL Editor runs
-- inside a transaction; run these manually with CONCURRENTLY on a
-- live production database to avoid table locks.
-- ============================================================


-- ── orders table ─────────────────────────────────────────────────────────────

-- Admin list: default sort is created_at DESC
CREATE INDEX IF NOT EXISTS idx_orders_created_at_desc
  ON public.orders(created_at DESC);

-- User my-orders query (user_id = ? ORDER BY created_at DESC)
CREATE INDEX IF NOT EXISTS idx_orders_user_id_created_at
  ON public.orders(user_id, created_at DESC);

-- Admin status filter (status = ? ORDER BY created_at DESC)
CREATE INDEX IF NOT EXISTS idx_orders_status_created_at
  ON public.orders(status, created_at DESC);

-- Payment status filter used by admin and payment service
CREATE INDEX IF NOT EXISTS idx_orders_payment_status
  ON public.orders(payment_status);

-- Single-column user_id for existence checks and ownership enforcement
CREATE INDEX IF NOT EXISTS idx_orders_user_id
  ON public.orders(user_id);

-- Already created in phase3 migration; kept here for completeness.
-- Skipped if already present because of IF NOT EXISTS.
CREATE INDEX IF NOT EXISTS idx_orders_demo_txn_id
  ON public.orders(demo_transaction_id)
  WHERE demo_transaction_id IS NOT NULL;


-- ── profiles table ───────────────────────────────────────────────────────────

-- Profile lookup by id is the primary key; no extra index needed.
-- Add this if you ever query by email (e.g. admin user search):
-- CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);


-- ── services table ───────────────────────────────────────────────────────────

-- Slug lookup used by order creation (getServiceBySlug)
CREATE INDEX IF NOT EXISTS idx_services_slug
  ON public.services(slug)
  WHERE is_active = true;

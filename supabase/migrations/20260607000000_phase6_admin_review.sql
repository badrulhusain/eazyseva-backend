-- ============================================================
-- EazySeva Phase 6 – Admin Review Workflow
-- ============================================================
-- Adds the ACCEPTED status to the order lifecycle and four
-- admin-review columns so the admin panel can track who
-- reviewed an order, when, and why it was rejected.
-- ============================================================

-- ----------------------------------------------------------------
-- 1. Extend order_status enum
--    AFTER 'PENDING' keeps the logical sequence intact.
--    IF NOT EXISTS is safe to re-run (PostgreSQL 12+).
-- ----------------------------------------------------------------
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'ACCEPTED' AFTER 'PENDING';

-- ----------------------------------------------------------------
-- 2. Add admin review columns to orders table
-- ----------------------------------------------------------------
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS admin_note       TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_by      UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS reviewed_at      TIMESTAMPTZ;

COMMENT ON COLUMN public.orders.rejection_reason IS 'Reason provided by admin when rejecting an order. Required when status = REJECTED.';
COMMENT ON COLUMN public.orders.admin_note       IS 'Internal admin note (not exposed to the customer).';
COMMENT ON COLUMN public.orders.reviewed_by      IS 'UUID of the admin user who last reviewed this order.';
COMMENT ON COLUMN public.orders.reviewed_at      IS 'Timestamp of the last admin status review.';

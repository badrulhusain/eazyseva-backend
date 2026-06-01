-- ============================================================
-- EazySeva Phase 3 – Virtual / Demo Payment Fields
-- Run this in: Supabase Dashboard → SQL Editor
--
-- IMPORTANT: Run this script outside of any transaction block.
-- ALTER TYPE ... ADD VALUE cannot execute inside a BEGIN/COMMIT
-- block in PostgreSQL.
-- ============================================================


-- ----------------------------------------------------------------
-- 1. Extend the payment_status enum with PAYMENT_PENDING
--    (safe to re-run — IF NOT EXISTS guards it)
-- ----------------------------------------------------------------

ALTER TYPE public.payment_status ADD VALUE IF NOT EXISTS 'PAYMENT_PENDING';


-- ----------------------------------------------------------------
-- 2. Add demo-payment columns to the orders table
--
--    payment_method        – which demo method was chosen
--    demo_transaction_id   – DEMO-TXN-YYYY-NNNNN reference
--    payment_currency      – always INR for this prototype
--    paid_at               – set when payment is confirmed SUCCESS
--    payment_failure_reason – set when payment is FAILED
--    timeline              – ordered log of status-change events
-- ----------------------------------------------------------------

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_method          TEXT,
  ADD COLUMN IF NOT EXISTS demo_transaction_id     TEXT,
  ADD COLUMN IF NOT EXISTS payment_currency        TEXT    NOT NULL DEFAULT 'INR',
  ADD COLUMN IF NOT EXISTS paid_at                 TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_failure_reason  TEXT,
  ADD COLUMN IF NOT EXISTS timeline                JSONB   NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.orders.payment_method        IS 'Demo-only: DEMO_UPI | DEMO_CARD | DEMO_CASH | PAY_LATER';
COMMENT ON COLUMN public.orders.demo_transaction_id   IS 'Demo-only transaction reference (DEMO-TXN-YYYY-NNNNN). Replace with real gateway reference in Phase 4.';
COMMENT ON COLUMN public.orders.timeline              IS 'Array of { event: string, timestamp: ISO-string } entries.';


-- ----------------------------------------------------------------
-- 3. Index on demo_transaction_id for fast confirm lookups
-- ----------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_orders_demo_txn_id
  ON public.orders(demo_transaction_id)
  WHERE demo_transaction_id IS NOT NULL;

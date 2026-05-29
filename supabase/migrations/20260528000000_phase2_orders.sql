-- ============================================================
-- EazySeva Phase 2 – Orders Migration
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================


-- ----------------------------------------------------------------
-- 1. Enums
-- ----------------------------------------------------------------

CREATE TYPE public.order_status AS ENUM (
  'PENDING',
  'PROCESSING',
  'COMPLETED',
  'REJECTED'
);

CREATE TYPE public.payment_status AS ENUM (
  'NOT_PAID',
  'PAID',
  'FAILED'
);


-- ----------------------------------------------------------------
-- 2. Order number sequence counter
--    Atomic upsert eliminates race conditions when concurrent
--    orders are created at the same second.
-- ----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.order_number_sequences (
  year     INT  PRIMARY KEY,
  last_seq INT  NOT NULL DEFAULT 0
);

COMMENT ON TABLE public.order_number_sequences IS 'Per-year atomic counter for order number generation.';


-- ----------------------------------------------------------------
-- 3. Function: next_order_number()
--    Returns: ES-2026-00001 format, year is dynamic
--    SECURITY DEFINER bypasses RLS so the function always runs
--    with owner privileges regardless of caller.
-- ----------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.next_order_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year INT;
  v_seq  INT;
BEGIN
  v_year := EXTRACT(YEAR FROM NOW())::INT;

  INSERT INTO public.order_number_sequences (year, last_seq)
  VALUES (v_year, 1)
  ON CONFLICT (year)
  DO UPDATE SET last_seq = order_number_sequences.last_seq + 1
  RETURNING last_seq INTO v_seq;

  RETURN 'ES-' || v_year || '-' || LPAD(v_seq::TEXT, 5, '0');
END;
$$;


-- ----------------------------------------------------------------
-- 4. orders table
-- ----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.orders (
  id                      UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number            TEXT              NOT NULL UNIQUE,
  user_id                 UUID              NOT NULL REFERENCES auth.users(id),

  service_type            TEXT              NOT NULL,

  customer_name           TEXT              NOT NULL,
  customer_phone          TEXT              NOT NULL,
  customer_dob            DATE              NOT NULL,
  customer_address        TEXT              NOT NULL,

  -- Array of { name, url, publicId } objects
  documents               JSONB             NOT NULL DEFAULT '[]'::jsonb,

  -- Price breakdown (frontend-provided in Phase 2)
  -- TODO Phase 3: compute from service catalog instead of trusting frontend
  price_government_fee    NUMERIC(10, 2)    NOT NULL DEFAULT 0,
  price_service_charge    NUMERIC(10, 2)    NOT NULL DEFAULT 0,
  price_document_handling NUMERIC(10, 2)    NOT NULL DEFAULT 0,
  price_total             NUMERIC(10, 2)    NOT NULL CHECK (price_total >= 0),

  status                  public.order_status    NOT NULL DEFAULT 'PENDING',
  payment_status          public.payment_status  NOT NULL DEFAULT 'NOT_PAID',

  created_at              TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.orders IS 'Customer service orders. Price accepted from frontend in Phase 2 — server-side calculation in Phase 3.';
COMMENT ON COLUMN public.orders.documents IS 'Array of {name, url, publicId} uploaded document objects.';


-- ----------------------------------------------------------------
-- 5. Indexes
-- ----------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_orders_user_id
  ON public.orders(user_id);

CREATE INDEX IF NOT EXISTS idx_orders_status
  ON public.orders(status);

CREATE INDEX IF NOT EXISTS idx_orders_created_at
  ON public.orders(created_at DESC);


-- ----------------------------------------------------------------
-- 6. updated_at trigger (reuses set_updated_at from Phase 1)
-- ----------------------------------------------------------------

CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ----------------------------------------------------------------
-- 7. Row Level Security
-- ----------------------------------------------------------------

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orders: user read own"
  ON public.orders
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "orders: user insert own"
  ON public.orders
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "orders: admin read all"
  ON public.orders
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'ADMIN'
    )
  );

CREATE POLICY "orders: admin update"
  ON public.orders
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'ADMIN'
    )
  );

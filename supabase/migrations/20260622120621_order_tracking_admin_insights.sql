-- EazySeva production order tracking and admin insights.
-- Safe to deploy after the existing phase 7 and pagination migrations.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

COMMENT ON COLUMN public.orders.idempotency_key IS
  'Client-generated UUID used to make order creation idempotent per user.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_user_idempotency_key
  ON public.orders(user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_payment_status_created_at
  ON public.orders(payment_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_status_payment_created_at
  ON public.orders(status, payment_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action_created_at
  ON public.audit_logs(action, created_at DESC);

-- Existing orders pre-date structured history. Preserve any existing entries
-- and seed only rows that have no timeline at all.
UPDATE public.orders
SET timeline = CASE
  WHEN status = 'PENDING' THEN
    jsonb_build_array(
      jsonb_build_object(
        'event', 'Order submitted',
        'status', 'PENDING',
        'timestamp', created_at,
        'actor', 'CUSTOMER'
      )
    )
  ELSE
    jsonb_build_array(
      jsonb_build_object(
        'event', 'Order submitted',
        'status', 'PENDING',
        'timestamp', created_at,
        'actor', 'CUSTOMER'
      ),
      jsonb_build_object(
        'event', 'Current status imported from existing order',
        'status', status::text,
        'timestamp', updated_at,
        'actor', 'SYSTEM'
      )
    )
END
WHERE timeline IS NULL OR timeline = '[]'::jsonb;

CREATE OR REPLACE FUNCTION public.admin_order_dashboard_stats()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH status_totals AS (
    SELECT status::text AS status, COUNT(*)::bigint AS total
    FROM public.orders
    GROUP BY status
  )
  SELECT jsonb_build_object(
    'totalOrders', COUNT(*)::bigint,
    'newLast7Days', COUNT(*) FILTER (
      WHERE created_at >= NOW() - INTERVAL '7 days'
    )::bigint,
    'pendingPayment', COUNT(*) FILTER (
      WHERE payment_status <> 'PAID'
    )::bigint,
    'paidRevenue', COALESCE(SUM(price_total) FILTER (
      WHERE payment_status = 'PAID'
    ), 0),
    'statusCounts', COALESCE(
      (SELECT jsonb_object_agg(status, total) FROM status_totals),
      '{}'::jsonb
    )
  )
  FROM public.orders;
$$;

REVOKE ALL ON FUNCTION public.admin_order_dashboard_stats()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_order_dashboard_stats()
  TO service_role;

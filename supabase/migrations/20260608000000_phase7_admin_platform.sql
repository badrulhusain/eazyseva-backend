-- ============================================================
-- EazySeva Phase 7 – Admin Platform
-- ============================================================
-- Adds: extended order-review statuses, Terms/Consent tracking,
-- the Blog system, an order-document deletion lifecycle, and an
-- admin audit-log trail.
-- ============================================================

-- ----------------------------------------------------------------
-- 1. Extend order_status enum with the richer review workflow
--    IF NOT EXISTS is safe to re-run (PostgreSQL 12+).
-- ----------------------------------------------------------------
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'UNDER_REVIEW' AFTER 'PENDING';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'CORRECTION_REQUESTED' AFTER 'ACCEPTED';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'CANCELLED';


-- ----------------------------------------------------------------
-- 2. profiles: track acceptance of the latest Terms/Consent policy
-- ----------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS accepted_latest_policy BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.profiles.accepted_latest_policy IS 'Convenience flag — TRUE once the user has accepted CURRENT_POLICY_VERSION. Source of truth is consent_acceptances.';


-- ----------------------------------------------------------------
-- 3. consent_acceptances table
--    One row per (user, policy_version) acceptance — append-only,
--    immutable snapshot of what the user agreed to and when.
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.consent_acceptances (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  policy_version        TEXT         NOT NULL,
  consent_text_snapshot TEXT         NOT NULL,
  source                TEXT         NOT NULL CHECK (source IN ('email_login', 'google_oauth', 'session_restore', 'policy_modal')),
  ip_address            TEXT,
  user_agent            TEXT,
  accepted_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.consent_acceptances IS 'Append-only record of Terms/Consent acceptances. Each row is an immutable snapshot — never updated.';
COMMENT ON COLUMN public.consent_acceptances.consent_text_snapshot IS 'Backend-stored terms text at the moment of acceptance (TERMS_TEXT_SNAPSHOT) — not the client-supplied text.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_consent_user_policy
  ON public.consent_acceptances(user_id, policy_version);

CREATE INDEX IF NOT EXISTS idx_consent_user_accepted_at
  ON public.consent_acceptances(user_id, accepted_at DESC);

ALTER TABLE public.consent_acceptances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "consent_acceptances: user read own"
  ON public.consent_acceptances
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "consent_acceptances: user insert own"
  ON public.consent_acceptances
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "consent_acceptances: admin read all"
  ON public.consent_acceptances
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'ADMIN'
    )
  );


-- ----------------------------------------------------------------
-- 4. blogs table
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.blogs (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  title             TEXT         NOT NULL,
  slug              TEXT         NOT NULL UNIQUE,
  excerpt           TEXT,
  content           TEXT         NOT NULL,
  cover_image_url   TEXT,
  category          TEXT,
  tags              TEXT[]       NOT NULL DEFAULT '{}',
  status            TEXT         NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  author_id         UUID         REFERENCES auth.users(id),
  seo_title         TEXT,
  seo_description   TEXT,
  published_at      TIMESTAMPTZ,
  deleted_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.blogs IS 'Admin-authored blog posts. Soft-deleted via deleted_at; visibility to the public requires status = published AND deleted_at IS NULL.';
COMMENT ON COLUMN public.blogs.published_at IS 'Stamped the first time a post transitions to status = published.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_blogs_slug
  ON public.blogs(slug);

CREATE INDEX IF NOT EXISTS idx_blogs_status_published_at
  ON public.blogs(status, published_at DESC);

CREATE INDEX IF NOT EXISTS idx_blogs_category
  ON public.blogs(category);

CREATE INDEX IF NOT EXISTS idx_blogs_deleted_at
  ON public.blogs(deleted_at);

CREATE INDEX IF NOT EXISTS idx_blogs_author_id
  ON public.blogs(author_id);

CREATE TRIGGER trg_blogs_updated_at
  BEFORE UPDATE ON public.blogs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.blogs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "blogs: public read published"
  ON public.blogs
  FOR SELECT
  USING (status = 'published' AND deleted_at IS NULL);

CREATE POLICY "blogs: admin read all"
  ON public.blogs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'ADMIN'
    )
  );

CREATE POLICY "blogs: admin insert"
  ON public.blogs
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'ADMIN'
    )
  );

CREATE POLICY "blogs: admin update"
  ON public.blogs
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'ADMIN'
    )
  );

CREATE POLICY "blogs: admin delete"
  ON public.blogs
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'ADMIN'
    )
  );


-- ----------------------------------------------------------------
-- 5. order_documents table
--    Lifecycle/deletion tracking for Cloudinary-managed order
--    documents. Separate from orders.documents (JSONB) — that
--    column remains the canonical shape the frontend renders;
--    this table exists purely to drive scheduled Cloudinary cleanup.
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.order_documents (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id              UUID         NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id               UUID         NOT NULL REFERENCES auth.users(id),
  cloudinary_public_id  TEXT         NOT NULL,
  secure_url            TEXT         NOT NULL,
  original_name         TEXT,
  mime_type             TEXT,
  size                  BIGINT,
  status                TEXT         NOT NULL DEFAULT 'active'
                                       CHECK (status IN ('active', 'scheduled_for_deletion', 'deleted', 'deletion_failed')),
  delete_after          TIMESTAMPTZ,
  deleted_at            TIMESTAMPTZ,
  deletion_error        TEXT,
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.order_documents IS 'Lifecycle tracking for Cloudinary-managed order documents — drives scheduled deletion after order completion.';
COMMENT ON COLUMN public.order_documents.cloudinary_public_id IS 'Cloudinary public_id — required to delete the asset (never derive from secure_url).';
COMMENT ON COLUMN public.order_documents.delete_after IS 'Set when status = scheduled_for_deletion; processDueDeletions() picks up rows where delete_after <= NOW().';

CREATE INDEX IF NOT EXISTS idx_order_documents_order_id
  ON public.order_documents(order_id);

CREATE INDEX IF NOT EXISTS idx_order_documents_user_id
  ON public.order_documents(user_id);

CREATE INDEX IF NOT EXISTS idx_order_documents_status
  ON public.order_documents(status);

CREATE INDEX IF NOT EXISTS idx_order_documents_delete_after
  ON public.order_documents(delete_after)
  WHERE status = 'scheduled_for_deletion';

CREATE TRIGGER trg_order_documents_updated_at
  BEFORE UPDATE ON public.order_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.order_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "order_documents: user read own"
  ON public.order_documents
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "order_documents: admin read all"
  ON public.order_documents
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'ADMIN'
    )
  );


-- ----------------------------------------------------------------
-- 6. audit_logs table
--    Append-only trail of admin actions. Written exclusively via
--    the service-role client (AuditLogsService), bypassing RLS —
--    no INSERT policy is needed or granted to authenticated users.
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id     UUID         REFERENCES auth.users(id),
  action       TEXT         NOT NULL,
  target_type  TEXT         NOT NULL CHECK (target_type IN ('order', 'blog', 'document')),
  target_id    UUID         NOT NULL,
  metadata     JSONB,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.audit_logs IS 'Append-only admin action trail. Inserted only by the service-role client (fire-and-forget) — never updated.';

CREATE INDEX IF NOT EXISTS idx_audit_logs_target
  ON public.audit_logs(target_type, target_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
  ON public.audit_logs(created_at DESC);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_logs: admin read all"
  ON public.audit_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'ADMIN'
    )
  );

-- ============================================================
-- EazySeva Phase 1 – Foundation Migration
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================


-- ----------------------------------------------------------------
-- 1. Enums
-- ----------------------------------------------------------------

CREATE TYPE public.user_role AS ENUM ('USER', 'ADMIN');

CREATE TYPE public.service_category AS ENUM (
  'ID_CARD',
  'CERTIFICATE',
  'TRAVEL',
  'FINANCIAL',
  'VEHICLE',
  'PROPERTY',
  'SCHOLARSHIP',
  'FORM_FILLING',
  'GOVERNMENT_SCHEME'
);


-- ----------------------------------------------------------------
-- 2. profiles table
--    id = auth.users.id (Supabase Auth owns identity)
-- ----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.profiles (
  id         UUID         PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      TEXT         NOT NULL,
  full_name  TEXT,
  phone      TEXT,
  role       public.user_role  NOT NULL DEFAULT 'USER',
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.profiles IS 'One row per auth.users entry. Role is server-managed only.';
COMMENT ON COLUMN public.profiles.role IS 'Cannot be changed by the user themselves — server/admin only.';


-- ----------------------------------------------------------------
-- 3. services table
-- ----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.services (
  id                UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  title             TEXT              NOT NULL,
  slug              TEXT              NOT NULL UNIQUE,
  description       TEXT,
  category          public.service_category  NOT NULL,
  price             INTEGER           NOT NULL CHECK (price >= 0),
  govt_fee          INTEGER           NOT NULL DEFAULT 0 CHECK (govt_fee >= 0),
  processing_fee    INTEGER           NOT NULL DEFAULT 0 CHECK (processing_fee >= 0),
  delivery_days_min INTEGER           NOT NULL DEFAULT 1 CHECK (delivery_days_min >= 0),
  delivery_days_max INTEGER           NOT NULL DEFAULT 7 CHECK (delivery_days_max >= 0),
  required_documents JSONB            NOT NULL DEFAULT '[]'::jsonb,
  icon              TEXT,
  is_popular        BOOLEAN           NOT NULL DEFAULT FALSE,
  is_active         BOOLEAN           NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.services IS 'Service catalog. Soft-deleted via is_active = false.';


-- ----------------------------------------------------------------
-- 4. Indexes
-- ----------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_profiles_role
  ON public.profiles(role);

CREATE INDEX IF NOT EXISTS idx_services_slug
  ON public.services(slug);

CREATE INDEX IF NOT EXISTS idx_services_category
  ON public.services(category);

CREATE INDEX IF NOT EXISTS idx_services_active_popular
  ON public.services(is_active, is_popular);


-- ----------------------------------------------------------------
-- 5. updated_at auto-maintenance trigger
-- ----------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_services_updated_at
  BEFORE UPDATE ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ----------------------------------------------------------------
-- 6. Auto-create profile when Supabase Auth creates a new user
--    Runs as SECURITY DEFINER so it can write to profiles.
-- ----------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, phone, role)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'phone',
    'USER'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ----------------------------------------------------------------
-- 7. Row Level Security – enable
-- ----------------------------------------------------------------

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;


-- ----------------------------------------------------------------
-- 8. RLS Policies – profiles
-- ----------------------------------------------------------------

-- User can read their own profile
CREATE POLICY "profiles: user read own"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

-- User can update ONLY full_name and phone (role is excluded via NestJS layer)
-- The WITH CHECK ensures role cannot be escalated even with a raw DB call
CREATE POLICY "profiles: user update own (no role escalation)"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role = (
      SELECT p.role FROM public.profiles p WHERE p.id = auth.uid()
    )
  );

-- Admin can read all profiles
CREATE POLICY "profiles: admin read all"
  ON public.profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'ADMIN'
    )
  );


-- ----------------------------------------------------------------
-- 9. RLS Policies – services
-- ----------------------------------------------------------------

-- Public: anyone (anon included) can read active services
CREATE POLICY "services: public read active"
  ON public.services
  FOR SELECT
  USING (is_active = TRUE);

-- Admin can read ALL services including inactive
CREATE POLICY "services: admin read all"
  ON public.services
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'ADMIN'
    )
  );

-- Only admin can insert
CREATE POLICY "services: admin insert"
  ON public.services
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'ADMIN'
    )
  );

-- Only admin can update
CREATE POLICY "services: admin update"
  ON public.services
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'ADMIN'
    )
  );

-- Only admin can hard-delete (soft delete via update is the normal path)
CREATE POLICY "services: admin delete"
  ON public.services
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'ADMIN'
    )
  );


-- ----------------------------------------------------------------
-- 10. Seed data – 10 EazySeva services
-- ----------------------------------------------------------------

INSERT INTO public.services
  (title, slug, description, category, price, govt_fee, processing_fee,
   delivery_days_min, delivery_days_max, required_documents, icon, is_popular, is_active)
VALUES
  (
    'Passport Application Assistance',
    'passport-application',
    'End-to-end help for fresh Indian passport applications — form filling, document checklist, and appointment scheduling at Passport Seva Kendra.',
    'TRAVEL', 49900, 150000, 1800, 30, 45,
    '["photo","identity_proof","address_proof","birth_certificate"]',
    'PASS', TRUE, TRUE
  ),
  (
    'PAN Card (New)',
    'pan-card-new',
    'Apply for a fresh PAN card with guided form filling and document submission for individuals and HUFs.',
    'ID_CARD', 29900, 10700, 1800, 5, 7,
    '["photo","identity_proof","address_proof"]',
    'PAN', TRUE, TRUE
  ),
  (
    'PAN Card (Correction)',
    'pan-card-correction',
    'Correct name, date of birth, father name, or address on your existing PAN card.',
    'ID_CARD', 24900, 10700, 1800, 3, 5,
    '["photo","identity_proof","existing_pan"]',
    'PAN', FALSE, TRUE
  ),
  (
    'Aadhaar Card Update',
    'aadhaar-update',
    'Update your name, address, mobile number, or date of birth on Aadhaar through UIDAI-authorised process.',
    'ID_CARD', 9900, 5000, 1800, 7, 10,
    '["identity_proof","address_proof"]',
    'UID', FALSE, TRUE
  ),
  (
    'Income Certificate',
    'income-certificate',
    'Official income certificate from the Revenue Department for use in scholarship, loan, and government scheme applications.',
    'CERTIFICATE', 24900, 0, 1800, 5, 7,
    '["identity_proof","income_proof","address_proof"]',
    'INC', FALSE, TRUE
  ),
  (
    'Caste Certificate',
    'caste-certificate',
    'SC/ST/OBC community certificate for reservation benefits, government jobs, and educational admissions.',
    'CERTIFICATE', 24900, 0, 1800, 7, 10,
    '["identity_proof","community_proof","address_proof"]',
    'CERT', FALSE, TRUE
  ),
  (
    'Scholarship Application Support',
    'scholarship-application',
    'Full assistance in filling and submitting National Scholarship Portal, state scholarships, and minority welfare scholarship applications.',
    'SCHOLARSHIP', 14900, 0, 1800, 1, 3,
    '["identity_proof","income_certificate","marks_card","bank_passbook"]',
    'SCH', TRUE, TRUE
  ),
  (
    'Online Form Filling',
    'online-form-filling',
    'Professional assistance for government job applications, competitive exam forms, and utility registrations — submitted accurately and on time.',
    'FORM_FILLING', 9900, 0, 1800, 1, 2,
    '["identity_proof","relevant_certificates"]',
    'FORM', FALSE, TRUE
  ),
  (
    'Document Typing & Printing',
    'document-typing',
    'Professional typing of affidavits, applications, rental agreements, and official documents in English and regional languages.',
    'FORM_FILLING', 4900, 0, 0, 0, 1,
    '[]',
    'TYPE', FALSE, TRUE
  ),
  (
    'Government Scheme Registration',
    'government-scheme-registration',
    'Registration assistance for PM-KISAN, Ayushman Bharat, PM Awas Yojana, and other central and state government welfare programmes.',
    'GOVERNMENT_SCHEME', 19900, 0, 1800, 2, 5,
    '["identity_proof","address_proof","bank_passbook"]',
    'GOVT', TRUE, TRUE
  );

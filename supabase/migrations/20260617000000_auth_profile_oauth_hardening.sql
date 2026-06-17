-- ============================================================
-- Auth profile hardening for OAuth users
-- ============================================================
-- Some OAuth providers can send display-name/email metadata under provider-
-- specific keys. Keep profile creation tolerant so Supabase Auth user creation
-- does not fail because public.profiles.email is NOT NULL.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, phone, role)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.email,
      NEW.raw_user_meta_data ->> 'email',
      NEW.raw_user_meta_data ->> 'email_address',
      ''
    ),
    COALESCE(
      NEW.raw_user_meta_data ->> 'full_name',
      NEW.raw_user_meta_data ->> 'name'
    ),
    NEW.raw_user_meta_data ->> 'phone',
    'USER'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

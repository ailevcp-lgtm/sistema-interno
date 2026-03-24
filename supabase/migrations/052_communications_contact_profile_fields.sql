-- ============================================================
-- 052: Campos ampliados de perfil para comunicaciones
-- ============================================================

ALTER TABLE email_contacts
  ADD COLUMN IF NOT EXISTS account_name TEXT,
  ADD COLUMN IF NOT EXISTS account_image_url TEXT,
  ADD COLUMN IF NOT EXISTS account_roles JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS account_is_active BOOLEAN,
  ADD COLUMN IF NOT EXISTS birth_date DATE,
  ADD COLUMN IF NOT EXISTS dni TEXT,
  ADD COLUMN IF NOT EXISTS phone_number TEXT;

ALTER TABLE email_contact_tags
  ADD COLUMN IF NOT EXISTS origin TEXT NOT NULL DEFAULT 'manual';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'email_contact_tags_origin_chk'
      AND conrelid = 'email_contact_tags'::regclass
  ) THEN
    ALTER TABLE email_contact_tags
      ADD CONSTRAINT email_contact_tags_origin_chk CHECK (origin IN ('manual', 'sync'));
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_email_contacts_birth_date
  ON email_contacts (birth_date);

CREATE INDEX IF NOT EXISTS idx_email_contacts_dni
  ON email_contacts (dni);

CREATE INDEX IF NOT EXISTS idx_email_contact_tags_origin
  ON email_contact_tags (origin);

DROP FUNCTION IF EXISTS fn_upsert_email_contact_from_sync(
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  BOOLEAN,
  JSONB,
  TIMESTAMPTZ,
  TIMESTAMPTZ
);

CREATE OR REPLACE FUNCTION fn_upsert_email_contact_from_sync(
  p_email TEXT,
  p_first_name TEXT DEFAULT NULL,
  p_last_name TEXT DEFAULT NULL,
  p_full_name TEXT DEFAULT NULL,
  p_source TEXT DEFAULT 'mongodb',
  p_provider TEXT DEFAULT NULL,
  p_status TEXT DEFAULT 'active',
  p_opt_in BOOLEAN DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_source_created_at TIMESTAMPTZ DEFAULT NULL,
  p_last_synced_at TIMESTAMPTZ DEFAULT now(),
  p_account_name TEXT DEFAULT NULL,
  p_account_image_url TEXT DEFAULT NULL,
  p_account_roles JSONB DEFAULT '[]'::jsonb,
  p_email_verified_at TIMESTAMPTZ DEFAULT NULL,
  p_account_is_active BOOLEAN DEFAULT NULL,
  p_birth_date DATE DEFAULT NULL,
  p_dni TEXT DEFAULT NULL,
  p_phone_number TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT := fn_communications_normalize_email(p_email);
  v_status TEXT := COALESCE(NULLIF(btrim(COALESCE(p_status, '')), ''), 'active');
BEGIN
  IF v_email = '' THEN
    RAISE EXCEPTION 'Email invalido para sync';
  END IF;

  IF v_status NOT IN ('active', 'inactive') THEN
    v_status := 'active';
  END IF;

  INSERT INTO email_contacts (
    email,
    first_name,
    last_name,
    full_name,
    account_name,
    account_image_url,
    account_roles,
    email_verified_at,
    account_is_active,
    birth_date,
    dni,
    phone_number,
    source,
    provider,
    status,
    opt_in,
    metadata,
    source_created_at,
    last_synced_at
  )
  VALUES (
    v_email,
    NULLIF(btrim(COALESCE(p_first_name, '')), ''),
    NULLIF(btrim(COALESCE(p_last_name, '')), ''),
    NULLIF(btrim(COALESCE(p_full_name, '')), ''),
    NULLIF(btrim(COALESCE(p_account_name, '')), ''),
    NULLIF(btrim(COALESCE(p_account_image_url, '')), ''),
    COALESCE(p_account_roles, '[]'::jsonb),
    p_email_verified_at,
    p_account_is_active,
    p_birth_date,
    NULLIF(btrim(COALESCE(p_dni, '')), ''),
    NULLIF(btrim(COALESCE(p_phone_number, '')), ''),
    COALESCE(NULLIF(btrim(COALESCE(p_source, '')), ''), 'mongodb'),
    NULLIF(btrim(COALESCE(p_provider, '')), ''),
    v_status,
    p_opt_in,
    COALESCE(p_metadata, '{}'::jsonb),
    p_source_created_at,
    COALESCE(p_last_synced_at, now())
  )
  ON CONFLICT (email) DO UPDATE
  SET
    first_name = COALESCE(EXCLUDED.first_name, email_contacts.first_name),
    last_name = COALESCE(EXCLUDED.last_name, email_contacts.last_name),
    full_name = COALESCE(EXCLUDED.full_name, email_contacts.full_name),
    account_name = COALESCE(EXCLUDED.account_name, email_contacts.account_name),
    account_image_url = COALESCE(EXCLUDED.account_image_url, email_contacts.account_image_url),
    account_roles = CASE
      WHEN jsonb_typeof(EXCLUDED.account_roles) = 'array' AND jsonb_array_length(EXCLUDED.account_roles) > 0 THEN EXCLUDED.account_roles
      ELSE email_contacts.account_roles
    END,
    email_verified_at = COALESCE(EXCLUDED.email_verified_at, email_contacts.email_verified_at),
    account_is_active = COALESCE(EXCLUDED.account_is_active, email_contacts.account_is_active),
    birth_date = COALESCE(EXCLUDED.birth_date, email_contacts.birth_date),
    dni = COALESCE(EXCLUDED.dni, email_contacts.dni),
    phone_number = COALESCE(EXCLUDED.phone_number, email_contacts.phone_number),
    source = COALESCE(EXCLUDED.source, email_contacts.source),
    provider = COALESCE(EXCLUDED.provider, email_contacts.provider),
    status = COALESCE(EXCLUDED.status, email_contacts.status),
    opt_in = COALESCE(EXCLUDED.opt_in, email_contacts.opt_in),
    metadata = COALESCE(email_contacts.metadata, '{}'::jsonb) || COALESCE(EXCLUDED.metadata, '{}'::jsonb),
    source_created_at = COALESCE(EXCLUDED.source_created_at, email_contacts.source_created_at),
    last_synced_at = COALESCE(EXCLUDED.last_synced_at, now()),
    updated_at = now();

  IF EXISTS (
    SELECT 1
    FROM email_contacts
    WHERE email = v_email
      AND created_at = updated_at
  ) THEN
    RETURN 'created';
  END IF;

  RETURN 'updated';
END;
$$;

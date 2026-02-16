-- 031_auth_google_access_control.sql
-- Refuerza el vínculo entre Auth y socios para habilitar OAuth Google
-- únicamente a miembros autorizados.

-- 1) Normalizar emails existentes
UPDATE socios
SET email = NULL
WHERE email IS NOT NULL
  AND btrim(email) = '';

UPDATE socios
SET email = lower(btrim(email))
WHERE email IS NOT NULL
  AND email <> lower(btrim(email));

-- 2) Trigger para normalizar email en altas/ediciones
CREATE OR REPLACE FUNCTION fn_socios_normalize_email()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.email IS NOT NULL THEN
    NEW.email := lower(btrim(NEW.email));
    IF NEW.email = '' THEN
      NEW.email := NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_socios_normalize_email ON socios;
CREATE TRIGGER trg_socios_normalize_email
BEFORE INSERT OR UPDATE OF email ON socios
FOR EACH ROW
EXECUTE FUNCTION fn_socios_normalize_email();

-- 3) Verificar duplicados antes de crear índices únicos
DO $$
DECLARE
  v_duplicate_email TEXT;
  v_duplicate_user_id UUID;
BEGIN
  SELECT lower(email)
  INTO v_duplicate_email
  FROM socios
  WHERE email IS NOT NULL
  GROUP BY lower(email)
  HAVING COUNT(*) > 1
  LIMIT 1;

  IF v_duplicate_email IS NOT NULL THEN
    RAISE EXCEPTION 'Duplicated socio email detected: %', v_duplicate_email;
  END IF;

  SELECT usuario_id
  INTO v_duplicate_user_id
  FROM socios
  WHERE usuario_id IS NOT NULL
  GROUP BY usuario_id
  HAVING COUNT(*) > 1
  LIMIT 1;

  IF v_duplicate_user_id IS NOT NULL THEN
    RAISE EXCEPTION 'Duplicated socios.usuario_id detected: %', v_duplicate_user_id;
  END IF;
END;
$$;

-- 4) Índices para garantizar unicidad y acelerar lookup de autorización
CREATE UNIQUE INDEX IF NOT EXISTS idx_socios_email_ci_unique
  ON socios ((lower(email)))
  WHERE email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_socios_usuario_id_unique
  ON socios (usuario_id)
  WHERE usuario_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_socios_estado_email_ci
  ON socios (estado, lower(email))
  WHERE email IS NOT NULL;

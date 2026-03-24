-- ============================================================
-- 051: Comunicaciones institucionales
-- ============================================================

ALTER TABLE role_permission_overrides
DROP CONSTRAINT IF EXISTS role_permission_overrides_recurso_chk;

ALTER TABLE role_permission_overrides
ADD CONSTRAINT role_permission_overrides_recurso_chk CHECK (
  recurso IN (
    'dashboard',
    'calendario',
    'tareas',
    'socios',
    'deudas',
    'movimientos',
    'finanzas',
    'tesoreria',
    'reintegros',
    'documentos',
    'configuracion',
    'estatuto',
    'resoluciones',
    'balances',
    'logs',
    'reuniones',
    'comunicaciones',
    'propuestas'
  )
);

CREATE OR REPLACE FUNCTION fn_has_resource_permission(
  p_recurso TEXT,
  p_accion TEXT,
  p_usuario_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_user_id UUID := COALESCE(p_usuario_id, auth.uid());
  v_recurso TEXT := fn_tasks_normalize_text(p_recurso);
  v_accion TEXT := fn_tasks_normalize_text(p_accion);
  v_rol TEXT;
  v_rol_aile_id UUID;
  v_rol_aile_name TEXT;
  v_override BOOLEAN;
BEGIN
  IF v_actor_user_id IS NULL OR v_recurso = '' OR v_accion = '' THEN
    RETURN false;
  END IF;

  IF fn_is_global_manager_user(v_actor_user_id) THEN
    RETURN true;
  END IF;

  SELECT
    s.rol,
    s.rol_aile_id,
    fn_tasks_normalize_text(COALESCE(rad.nombre, s.rol_aile, ''))
  INTO
    v_rol,
    v_rol_aile_id,
    v_rol_aile_name
  FROM socios s
  LEFT JOIN rol_aile_definitions rad ON rad.id = s.rol_aile_id
  WHERE s.usuario_id = v_actor_user_id
    AND COALESCE(s.estado, 'activo') = 'activo'
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  SELECT rpo.permitido
  INTO v_override
  FROM role_permission_overrides rpo
  WHERE rpo.recurso = v_recurso
    AND rpo.accion = v_accion
    AND (
      (v_rol_aile_id IS NOT NULL AND rpo.rol_aile_definition_id = v_rol_aile_id)
      OR (
        v_rol_aile_id IS NULL
        AND EXISTS (
          SELECT 1
          FROM rol_aile_definitions rad2
          WHERE rad2.id = rpo.rol_aile_definition_id
            AND fn_tasks_normalize_text(rad2.nombre) = v_rol_aile_name
        )
      )
    )
  ORDER BY
    CASE
      WHEN v_rol_aile_id IS NOT NULL AND rpo.rol_aile_definition_id = v_rol_aile_id THEN 0
      ELSE 1
    END
  LIMIT 1;

  IF v_override IS NOT NULL THEN
    RETURN v_override;
  END IF;

  CASE v_recurso
    WHEN 'dashboard' THEN
      RETURN CASE v_accion
        WHEN 'ver' THEN v_rol IN ('socio', 'comision_directiva', 'revisor_cuentas', 'admin')
        ELSE false
      END;
    WHEN 'calendario' THEN
      RETURN CASE v_accion
        WHEN 'ver' THEN v_rol IN ('socio', 'comision_directiva', 'revisor_cuentas', 'admin')
        WHEN 'crear' THEN v_rol IN ('comision_directiva', 'admin')
        WHEN 'editar' THEN v_rol IN ('comision_directiva', 'admin')
        WHEN 'eliminar' THEN v_rol IN ('comision_directiva', 'admin')
        ELSE false
      END;
    WHEN 'tareas' THEN
      RETURN CASE v_accion
        WHEN 'ver' THEN v_rol IN ('socio', 'comision_directiva', 'revisor_cuentas', 'admin')
        ELSE false
      END;
    WHEN 'socios' THEN
      RETURN CASE v_accion
        WHEN 'ver' THEN v_rol IN ('comision_directiva', 'revisor_cuentas', 'admin')
        WHEN 'crear' THEN v_rol IN ('comision_directiva', 'admin')
        WHEN 'editar' THEN v_rol IN ('comision_directiva', 'admin')
        WHEN 'eliminar' THEN v_rol = 'admin'
        ELSE false
      END;
    WHEN 'deudas' THEN
      RETURN CASE v_accion
        WHEN 'ver' THEN v_rol IN ('comision_directiva', 'revisor_cuentas', 'admin')
        WHEN 'crear' THEN v_rol IN ('comision_directiva', 'admin')
        WHEN 'editar' THEN v_rol IN ('comision_directiva', 'admin')
        WHEN 'eliminar' THEN v_rol = 'admin'
        ELSE false
      END;
    WHEN 'movimientos' THEN
      RETURN CASE v_accion
        WHEN 'ver' THEN v_rol IN ('socio', 'comision_directiva', 'revisor_cuentas', 'admin')
        WHEN 'crear' THEN v_rol IN ('comision_directiva', 'admin')
        WHEN 'editar' THEN v_rol IN ('comision_directiva', 'admin')
        WHEN 'eliminar' THEN v_rol = 'admin'
        ELSE false
      END;
    WHEN 'finanzas' THEN
      RETURN CASE v_accion
        WHEN 'ver' THEN v_rol IN ('comision_directiva', 'revisor_cuentas', 'admin')
        WHEN 'crear' THEN v_rol IN ('comision_directiva', 'admin')
        WHEN 'editar' THEN v_rol IN ('comision_directiva', 'admin')
        WHEN 'eliminar' THEN v_rol = 'admin'
        ELSE false
      END;
    WHEN 'tesoreria' THEN
      RETURN CASE v_accion
        WHEN 'ver' THEN v_rol IN ('comision_directiva', 'revisor_cuentas', 'admin')
        WHEN 'crear' THEN v_rol IN ('comision_directiva', 'admin')
        WHEN 'editar' THEN v_rol IN ('comision_directiva', 'admin')
        WHEN 'eliminar' THEN v_rol = 'admin'
        ELSE false
      END;
    WHEN 'reintegros' THEN
      RETURN CASE v_accion
        WHEN 'ver' THEN v_rol IN ('comision_directiva', 'admin')
        WHEN 'crear' THEN v_rol IN ('comision_directiva', 'admin')
        WHEN 'editar' THEN v_rol IN ('comision_directiva', 'admin')
        WHEN 'eliminar' THEN v_rol = 'admin'
        WHEN 'aprobar' THEN v_rol IN ('comision_directiva', 'admin')
        ELSE false
      END;
    WHEN 'documentos' THEN
      RETURN CASE v_accion
        WHEN 'ver' THEN v_rol IN ('comision_directiva', 'revisor_cuentas', 'admin')
        WHEN 'crear' THEN v_rol IN ('comision_directiva', 'admin')
        WHEN 'editar' THEN v_rol IN ('comision_directiva', 'admin')
        WHEN 'eliminar' THEN v_rol = 'admin'
        ELSE false
      END;
    WHEN 'configuracion' THEN
      RETURN CASE v_accion
        WHEN 'ver' THEN v_rol IN ('comision_directiva', 'admin')
        WHEN 'crear' THEN v_rol IN ('comision_directiva', 'admin')
        WHEN 'editar' THEN v_rol IN ('comision_directiva', 'admin')
        WHEN 'eliminar' THEN v_rol = 'admin'
        ELSE false
      END;
    WHEN 'estatuto' THEN
      RETURN CASE v_accion
        WHEN 'ver' THEN v_rol IN ('comision_directiva', 'revisor_cuentas', 'admin')
        WHEN 'editar' THEN v_rol = 'admin'
        ELSE false
      END;
    WHEN 'resoluciones' THEN
      RETURN CASE v_accion
        WHEN 'ver' THEN v_rol IN ('comision_directiva', 'revisor_cuentas', 'admin')
        WHEN 'crear' THEN v_rol IN ('comision_directiva', 'admin')
        WHEN 'editar' THEN v_rol IN ('comision_directiva', 'admin')
        WHEN 'eliminar' THEN v_rol = 'admin'
        ELSE false
      END;
    WHEN 'balances' THEN
      RETURN CASE v_accion
        WHEN 'ver' THEN v_rol IN ('comision_directiva', 'revisor_cuentas', 'admin')
        WHEN 'crear' THEN v_rol IN ('comision_directiva', 'admin')
        WHEN 'editar' THEN v_rol IN ('comision_directiva', 'admin')
        WHEN 'eliminar' THEN v_rol = 'admin'
        WHEN 'aprobar' THEN v_rol IN ('comision_directiva', 'admin')
        ELSE false
      END;
    WHEN 'logs' THEN
      RETURN CASE v_accion
        WHEN 'ver' THEN v_rol IN ('comision_directiva', 'admin')
        ELSE false
      END;
    WHEN 'reuniones' THEN
      RETURN CASE v_accion
        WHEN 'ver' THEN v_rol IN ('socio', 'comision_directiva', 'revisor_cuentas', 'admin')
        WHEN 'crear' THEN v_rol IN ('comision_directiva', 'admin')
        WHEN 'editar' THEN v_rol IN ('comision_directiva', 'admin')
        WHEN 'eliminar' THEN v_rol = 'admin'
        ELSE false
      END;
    WHEN 'comunicaciones' THEN
      RETURN CASE v_accion
        WHEN 'ver' THEN v_rol IN ('comision_directiva', 'admin')
        WHEN 'crear' THEN v_rol IN ('comision_directiva', 'admin')
        WHEN 'editar' THEN v_rol IN ('comision_directiva', 'admin')
        WHEN 'eliminar' THEN v_rol = 'admin'
        WHEN 'aprobar' THEN v_rol IN ('comision_directiva', 'admin')
        ELSE false
      END;
    WHEN 'propuestas' THEN
      RETURN CASE v_accion
        WHEN 'ver' THEN v_rol IN ('comision_directiva', 'admin')
        WHEN 'crear' THEN v_rol IN ('comision_directiva', 'admin')
        WHEN 'editar' THEN v_rol IN ('comision_directiva', 'admin')
        WHEN 'eliminar' THEN v_rol = 'admin'
        ELSE false
      END;
    ELSE
      RETURN false;
  END CASE;
END;
$$;

CREATE OR REPLACE FUNCTION fn_communications_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION fn_communications_normalize_email(p_email TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(btrim(COALESCE(p_email, '')));
$$;

CREATE TABLE IF NOT EXISTS communication_module_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS email_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  first_name TEXT,
  last_name TEXT,
  full_name TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  provider TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  opt_in BOOLEAN,
  unsubscribed BOOLEAN NOT NULL DEFAULT false,
  bounced BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_created_at TIMESTAMPTZ,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS email_contact_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES email_contacts(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT email_contact_tags_unique UNIQUE (contact_id, tag)
);

CREATE TABLE IF NOT EXISTS email_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'manual' CHECK (type IN ('manual', 'dynamic')),
  criteria_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  key TEXT UNIQUE,
  description TEXT,
  is_system BOOLEAN NOT NULL DEFAULT false,
  content_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS email_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  preheader TEXT,
  sender_name TEXT,
  sender_email TEXT,
  template_id UUID REFERENCES email_templates(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'test_sent', 'scheduled', 'sending', 'sent', 'failed')),
  content_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  selection_mode TEXT NOT NULL DEFAULT 'manual' CHECK (selection_mode IN ('manual', 'filters')),
  filters_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  recipient_count_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_error TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS email_campaign_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES email_campaigns(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES email_contacts(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  delivery_status TEXT NOT NULL DEFAULT 'pending' CHECK (
    delivery_status IN ('pending', 'test_sent', 'sent', 'failed', 'skipped', 'delivered', 'opened', 'clicked', 'bounced', 'unsubscribed')
  ),
  resend_id TEXT,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  bounced_at TIMESTAMPTZ,
  unsubscribed_at TIMESTAMPTZ,
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS email_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES email_campaigns(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES email_contacts(id) ON DELETE SET NULL,
  campaign_recipient_id UUID REFERENCES email_campaign_recipients(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS email_sync_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'running',
  totals JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_summary TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_communication_module_access_user_id
  ON communication_module_access (user_id);
CREATE INDEX IF NOT EXISTS idx_email_contacts_status
  ON email_contacts (status);
CREATE INDEX IF NOT EXISTS idx_email_contacts_source
  ON email_contacts (source);
CREATE INDEX IF NOT EXISTS idx_email_contacts_last_synced_at
  ON email_contacts (last_synced_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_contact_tags_tag
  ON email_contact_tags (tag);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_status
  ON email_campaigns (status);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_created_at
  ON email_campaigns (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_campaign_recipients_campaign_id
  ON email_campaign_recipients (campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_campaign_recipients_contact_id
  ON email_campaign_recipients (contact_id);
CREATE INDEX IF NOT EXISTS idx_email_campaign_recipients_delivery_status
  ON email_campaign_recipients (delivery_status);
CREATE INDEX IF NOT EXISTS idx_email_events_campaign_id
  ON email_events (campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_events_contact_id
  ON email_events (contact_id);
CREATE INDEX IF NOT EXISTS idx_email_sync_runs_started_at
  ON email_sync_runs (started_at DESC);

CREATE OR REPLACE FUNCTION fn_communications_prepare_contact()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.email := fn_communications_normalize_email(NEW.email);
  NEW.first_name := NULLIF(btrim(COALESCE(NEW.first_name, '')), '');
  NEW.last_name := NULLIF(btrim(COALESCE(NEW.last_name, '')), '');
  NEW.full_name := NULLIF(
    btrim(
      COALESCE(
        NEW.full_name,
        concat_ws(' ', NULLIF(btrim(COALESCE(NEW.first_name, '')), ''), NULLIF(btrim(COALESCE(NEW.last_name, '')), ''))
      )
    ),
    ''
  );
  NEW.source := COALESCE(NULLIF(btrim(COALESCE(NEW.source, '')), ''), 'manual');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_email_contacts_prepare ON email_contacts;
CREATE TRIGGER trg_email_contacts_prepare
BEFORE INSERT OR UPDATE ON email_contacts
FOR EACH ROW
EXECUTE FUNCTION fn_communications_prepare_contact();

DROP TRIGGER IF EXISTS trg_email_contacts_set_updated_at ON email_contacts;
CREATE TRIGGER trg_email_contacts_set_updated_at
BEFORE UPDATE ON email_contacts
FOR EACH ROW
EXECUTE FUNCTION fn_communications_set_updated_at();

DROP TRIGGER IF EXISTS trg_email_segments_set_updated_at ON email_segments;
CREATE TRIGGER trg_email_segments_set_updated_at
BEFORE UPDATE ON email_segments
FOR EACH ROW
EXECUTE FUNCTION fn_communications_set_updated_at();

DROP TRIGGER IF EXISTS trg_email_templates_set_updated_at ON email_templates;
CREATE TRIGGER trg_email_templates_set_updated_at
BEFORE UPDATE ON email_templates
FOR EACH ROW
EXECUTE FUNCTION fn_communications_set_updated_at();

DROP TRIGGER IF EXISTS trg_email_campaigns_set_updated_at ON email_campaigns;
CREATE TRIGGER trg_email_campaigns_set_updated_at
BEFORE UPDATE ON email_campaigns
FOR EACH ROW
EXECUTE FUNCTION fn_communications_set_updated_at();

CREATE OR REPLACE FUNCTION fn_has_communications_module_access(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    fn_has_resource_permission('comunicaciones', 'ver', COALESCE(p_user_id, auth.uid()))
    OR EXISTS (
      SELECT 1
      FROM communication_module_access cma
      WHERE cma.user_id = COALESCE(p_user_id, auth.uid())
    );
$$;

CREATE OR REPLACE FUNCTION fn_can_manage_communications_access(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    fn_has_resource_permission('comunicaciones', 'editar', COALESCE(p_user_id, auth.uid()))
    OR fn_has_resource_permission('configuracion', 'editar', COALESCE(p_user_id, auth.uid()));
$$;

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
  p_last_synced_at TIMESTAMPTZ DEFAULT now()
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

ALTER TABLE communication_module_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_contact_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_campaign_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_sync_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS communication_module_access_select ON communication_module_access;
CREATE POLICY communication_module_access_select
ON communication_module_access
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR fn_can_manage_communications_access(auth.uid())
);

DROP POLICY IF EXISTS communication_module_access_insert ON communication_module_access;
CREATE POLICY communication_module_access_insert
ON communication_module_access
FOR INSERT
TO authenticated
WITH CHECK (fn_can_manage_communications_access(auth.uid()));

DROP POLICY IF EXISTS communication_module_access_delete ON communication_module_access;
CREATE POLICY communication_module_access_delete
ON communication_module_access
FOR DELETE
TO authenticated
USING (fn_can_manage_communications_access(auth.uid()));

DROP POLICY IF EXISTS email_contacts_select ON email_contacts;
CREATE POLICY email_contacts_select
ON email_contacts
FOR SELECT
TO authenticated
USING (fn_has_communications_module_access(auth.uid()));

DROP POLICY IF EXISTS email_contacts_insert ON email_contacts;
CREATE POLICY email_contacts_insert
ON email_contacts
FOR INSERT
TO authenticated
WITH CHECK (fn_has_communications_module_access(auth.uid()));

DROP POLICY IF EXISTS email_contacts_update ON email_contacts;
CREATE POLICY email_contacts_update
ON email_contacts
FOR UPDATE
TO authenticated
USING (fn_has_communications_module_access(auth.uid()))
WITH CHECK (fn_has_communications_module_access(auth.uid()));

DROP POLICY IF EXISTS email_contacts_delete ON email_contacts;
CREATE POLICY email_contacts_delete
ON email_contacts
FOR DELETE
TO authenticated
USING (fn_has_communications_module_access(auth.uid()));

DROP POLICY IF EXISTS email_contact_tags_select ON email_contact_tags;
CREATE POLICY email_contact_tags_select
ON email_contact_tags
FOR SELECT
TO authenticated
USING (fn_has_communications_module_access(auth.uid()));

DROP POLICY IF EXISTS email_contact_tags_insert ON email_contact_tags;
CREATE POLICY email_contact_tags_insert
ON email_contact_tags
FOR INSERT
TO authenticated
WITH CHECK (fn_has_communications_module_access(auth.uid()));

DROP POLICY IF EXISTS email_contact_tags_update ON email_contact_tags;
CREATE POLICY email_contact_tags_update
ON email_contact_tags
FOR UPDATE
TO authenticated
USING (fn_has_communications_module_access(auth.uid()))
WITH CHECK (fn_has_communications_module_access(auth.uid()));

DROP POLICY IF EXISTS email_contact_tags_delete ON email_contact_tags;
CREATE POLICY email_contact_tags_delete
ON email_contact_tags
FOR DELETE
TO authenticated
USING (fn_has_communications_module_access(auth.uid()));

DROP POLICY IF EXISTS email_segments_select ON email_segments;
CREATE POLICY email_segments_select
ON email_segments
FOR SELECT
TO authenticated
USING (fn_has_communications_module_access(auth.uid()));

DROP POLICY IF EXISTS email_segments_insert ON email_segments;
CREATE POLICY email_segments_insert
ON email_segments
FOR INSERT
TO authenticated
WITH CHECK (fn_has_communications_module_access(auth.uid()));

DROP POLICY IF EXISTS email_segments_update ON email_segments;
CREATE POLICY email_segments_update
ON email_segments
FOR UPDATE
TO authenticated
USING (fn_has_communications_module_access(auth.uid()))
WITH CHECK (fn_has_communications_module_access(auth.uid()));

DROP POLICY IF EXISTS email_segments_delete ON email_segments;
CREATE POLICY email_segments_delete
ON email_segments
FOR DELETE
TO authenticated
USING (fn_has_communications_module_access(auth.uid()));

DROP POLICY IF EXISTS email_templates_select ON email_templates;
CREATE POLICY email_templates_select
ON email_templates
FOR SELECT
TO authenticated
USING (fn_has_communications_module_access(auth.uid()));

DROP POLICY IF EXISTS email_templates_insert ON email_templates;
CREATE POLICY email_templates_insert
ON email_templates
FOR INSERT
TO authenticated
WITH CHECK (fn_has_communications_module_access(auth.uid()));

DROP POLICY IF EXISTS email_templates_update ON email_templates;
CREATE POLICY email_templates_update
ON email_templates
FOR UPDATE
TO authenticated
USING (fn_has_communications_module_access(auth.uid()))
WITH CHECK (fn_has_communications_module_access(auth.uid()));

DROP POLICY IF EXISTS email_templates_delete ON email_templates;
CREATE POLICY email_templates_delete
ON email_templates
FOR DELETE
TO authenticated
USING (fn_has_communications_module_access(auth.uid()));

DROP POLICY IF EXISTS email_campaigns_select ON email_campaigns;
CREATE POLICY email_campaigns_select
ON email_campaigns
FOR SELECT
TO authenticated
USING (fn_has_communications_module_access(auth.uid()));

DROP POLICY IF EXISTS email_campaigns_insert ON email_campaigns;
CREATE POLICY email_campaigns_insert
ON email_campaigns
FOR INSERT
TO authenticated
WITH CHECK (fn_has_communications_module_access(auth.uid()));

DROP POLICY IF EXISTS email_campaigns_update ON email_campaigns;
CREATE POLICY email_campaigns_update
ON email_campaigns
FOR UPDATE
TO authenticated
USING (fn_has_communications_module_access(auth.uid()))
WITH CHECK (fn_has_communications_module_access(auth.uid()));

DROP POLICY IF EXISTS email_campaigns_delete ON email_campaigns;
CREATE POLICY email_campaigns_delete
ON email_campaigns
FOR DELETE
TO authenticated
USING (fn_has_communications_module_access(auth.uid()));

DROP POLICY IF EXISTS email_campaign_recipients_select ON email_campaign_recipients;
CREATE POLICY email_campaign_recipients_select
ON email_campaign_recipients
FOR SELECT
TO authenticated
USING (fn_has_communications_module_access(auth.uid()));

DROP POLICY IF EXISTS email_campaign_recipients_insert ON email_campaign_recipients;
CREATE POLICY email_campaign_recipients_insert
ON email_campaign_recipients
FOR INSERT
TO authenticated
WITH CHECK (fn_has_communications_module_access(auth.uid()));

DROP POLICY IF EXISTS email_campaign_recipients_update ON email_campaign_recipients;
CREATE POLICY email_campaign_recipients_update
ON email_campaign_recipients
FOR UPDATE
TO authenticated
USING (fn_has_communications_module_access(auth.uid()))
WITH CHECK (fn_has_communications_module_access(auth.uid()));

DROP POLICY IF EXISTS email_campaign_recipients_delete ON email_campaign_recipients;
CREATE POLICY email_campaign_recipients_delete
ON email_campaign_recipients
FOR DELETE
TO authenticated
USING (fn_has_communications_module_access(auth.uid()));

DROP POLICY IF EXISTS email_events_select ON email_events;
CREATE POLICY email_events_select
ON email_events
FOR SELECT
TO authenticated
USING (fn_has_communications_module_access(auth.uid()));

DROP POLICY IF EXISTS email_events_insert ON email_events;
CREATE POLICY email_events_insert
ON email_events
FOR INSERT
TO authenticated
WITH CHECK (fn_has_communications_module_access(auth.uid()));

DROP POLICY IF EXISTS email_events_update ON email_events;
CREATE POLICY email_events_update
ON email_events
FOR UPDATE
TO authenticated
USING (fn_has_communications_module_access(auth.uid()))
WITH CHECK (fn_has_communications_module_access(auth.uid()));

DROP POLICY IF EXISTS email_events_delete ON email_events;
CREATE POLICY email_events_delete
ON email_events
FOR DELETE
TO authenticated
USING (fn_has_communications_module_access(auth.uid()));

DROP POLICY IF EXISTS email_sync_runs_select ON email_sync_runs;
CREATE POLICY email_sync_runs_select
ON email_sync_runs
FOR SELECT
TO authenticated
USING (fn_has_communications_module_access(auth.uid()));

DROP POLICY IF EXISTS email_sync_runs_insert ON email_sync_runs;
CREATE POLICY email_sync_runs_insert
ON email_sync_runs
FOR INSERT
TO authenticated
WITH CHECK (fn_has_communications_module_access(auth.uid()));

DROP POLICY IF EXISTS email_sync_runs_update ON email_sync_runs;
CREATE POLICY email_sync_runs_update
ON email_sync_runs
FOR UPDATE
TO authenticated
USING (fn_has_communications_module_access(auth.uid()))
WITH CHECK (fn_has_communications_module_access(auth.uid()));

INSERT INTO email_templates (
  name,
  key,
  description,
  is_system,
  content_json
)
SELECT
  'Base institucional AILE',
  'institutional-default',
  'Plantilla base para comunicaciones institucionales',
  true,
  jsonb_build_object(
    'title', 'Comunicado institucional',
    'body', 'Escribe aqui el contenido principal del correo.',
    'ctaLabel', null,
    'ctaUrl', null,
    'footerNote', 'Gracias por seguir formando parte de AILE.'
  )
WHERE NOT EXISTS (
  SELECT 1
  FROM email_templates
  WHERE key = 'institutional-default'
);

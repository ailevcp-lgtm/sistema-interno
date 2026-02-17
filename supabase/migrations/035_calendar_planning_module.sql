-- ============================================================
-- 035: Planificacion anual de actividades para calendario
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'calendario_estado_planificacion'
  ) THEN
    CREATE TYPE calendario_estado_planificacion AS ENUM (
      'tentativo',
      'definitivo'
    );
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS planificaciones_calendario (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  descripcion TEXT,
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL,
  estado calendario_estado_planificacion NOT NULL DEFAULT 'tentativo',
  created_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (fecha_fin >= fecha_inicio)
);

CREATE INDEX IF NOT EXISTS idx_planificaciones_calendario_fecha_inicio
  ON planificaciones_calendario (fecha_inicio ASC);

CREATE INDEX IF NOT EXISTS idx_planificaciones_calendario_fecha_fin
  ON planificaciones_calendario (fecha_fin ASC);

CREATE INDEX IF NOT EXISTS idx_planificaciones_calendario_estado
  ON planificaciones_calendario (estado);

CREATE OR REPLACE FUNCTION fn_planificaciones_calendario_biu()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.created_at IS NULL THEN
      NEW.created_at := now();
    END IF;

    IF NEW.created_by IS NULL THEN
      NEW.created_by := auth.uid();
    END IF;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_planificaciones_calendario_biu ON planificaciones_calendario;
CREATE TRIGGER trg_planificaciones_calendario_biu
  BEFORE INSERT OR UPDATE ON planificaciones_calendario
  FOR EACH ROW
  EXECUTE FUNCTION fn_planificaciones_calendario_biu();

CREATE OR REPLACE FUNCTION fn_calendar_can_manage_planning_action(
  p_usuario_id UUID DEFAULT auth.uid(),
  p_accion TEXT DEFAULT 'crear'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_user_id UUID := COALESCE(p_usuario_id, auth.uid());
  v_rol_sistema TEXT;
  v_rol_aile_definition_id UUID;
  v_rol_aile_normalizado TEXT;
BEGIN
  IF v_actor_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  IF p_accion NOT IN ('crear', 'editar', 'eliminar') THEN
    RETURN FALSE;
  END IF;

  SELECT
    s.rol::TEXT,
    s.rol_aile_id,
    lower(COALESCE(rad.nombre, s.rol_aile, ''))
  INTO
    v_rol_sistema,
    v_rol_aile_definition_id,
    v_rol_aile_normalizado
  FROM socios s
  LEFT JOIN rol_aile_definitions rad ON rad.id = s.rol_aile_id
  WHERE s.usuario_id = v_actor_user_id
    AND COALESCE(s.estado, 'activo') = 'activo'
  LIMIT 1;

  IF v_rol_sistema IS NULL THEN
    RETURN FALSE;
  END IF;

  IF v_rol_sistema IN ('admin', 'comision_directiva') THEN
    RETURN TRUE;
  END IF;

  IF v_rol_aile_normalizado IN (
    'presidente',
    'tesorero',
    'secretario general',
    'vocal titular'
  ) THEN
    RETURN TRUE;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM role_permission_overrides rpo
    WHERE rpo.recurso = 'calendario'
      AND rpo.accion = p_accion
      AND rpo.permitido = true
      AND (
        (v_rol_aile_definition_id IS NOT NULL AND rpo.rol_aile_definition_id = v_rol_aile_definition_id)
        OR (
          v_rol_aile_definition_id IS NULL
          AND EXISTS (
            SELECT 1
            FROM rol_aile_definitions rad2
            WHERE rad2.id = rpo.rol_aile_definition_id
              AND lower(rad2.nombre) = v_rol_aile_normalizado
          )
        )
      )
  );
END;
$$;

CREATE OR REPLACE FUNCTION fn_calendar_can_create_planning(p_usuario_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT fn_calendar_can_manage_planning_action(COALESCE(p_usuario_id, auth.uid()), 'crear');
$$;

CREATE OR REPLACE FUNCTION fn_calendar_can_edit_planning(p_usuario_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT fn_calendar_can_manage_planning_action(COALESCE(p_usuario_id, auth.uid()), 'editar');
$$;

CREATE OR REPLACE FUNCTION fn_calendar_can_delete_planning(p_usuario_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT fn_calendar_can_manage_planning_action(COALESCE(p_usuario_id, auth.uid()), 'eliminar');
$$;

ALTER TABLE planificaciones_calendario ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "calendar_planning_select" ON planificaciones_calendario;
CREATE POLICY "calendar_planning_select"
ON planificaciones_calendario
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "calendar_planning_insert" ON planificaciones_calendario;
CREATE POLICY "calendar_planning_insert"
ON planificaciones_calendario
FOR INSERT
TO authenticated
WITH CHECK (
  fn_calendar_can_create_planning(auth.uid())
);

DROP POLICY IF EXISTS "calendar_planning_update" ON planificaciones_calendario;
CREATE POLICY "calendar_planning_update"
ON planificaciones_calendario
FOR UPDATE
TO authenticated
USING (
  fn_calendar_can_edit_planning(auth.uid())
)
WITH CHECK (
  fn_calendar_can_edit_planning(auth.uid())
);

DROP POLICY IF EXISTS "calendar_planning_delete" ON planificaciones_calendario;
CREATE POLICY "calendar_planning_delete"
ON planificaciones_calendario
FOR DELETE
TO authenticated
USING (
  fn_calendar_can_delete_planning(auth.uid())
);

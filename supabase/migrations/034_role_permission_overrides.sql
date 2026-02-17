-- ============================================================
-- 034: Permisos configurables por rol AILE (fase 2)
-- ============================================================

CREATE TABLE IF NOT EXISTS role_permission_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rol_aile_definition_id UUID NOT NULL REFERENCES rol_aile_definitions(id) ON DELETE CASCADE,
  recurso TEXT NOT NULL,
  accion TEXT NOT NULL,
  permitido BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT role_permission_overrides_unique UNIQUE (rol_aile_definition_id, recurso, accion),
  CONSTRAINT role_permission_overrides_recurso_chk CHECK (
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
      'logs'
    )
  ),
  CONSTRAINT role_permission_overrides_accion_chk CHECK (
    accion IN ('ver', 'crear', 'editar', 'eliminar', 'aprobar')
  )
);

CREATE INDEX IF NOT EXISTS idx_role_permission_overrides_role
  ON role_permission_overrides (rol_aile_definition_id);

CREATE INDEX IF NOT EXISTS idx_role_permission_overrides_lookup
  ON role_permission_overrides (rol_aile_definition_id, recurso, accion);

CREATE OR REPLACE FUNCTION fn_role_permission_overrides_bu_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_role_permission_overrides_bu_set_updated_at ON role_permission_overrides;
CREATE TRIGGER trg_role_permission_overrides_bu_set_updated_at
BEFORE UPDATE ON role_permission_overrides
FOR EACH ROW
EXECUTE FUNCTION fn_role_permission_overrides_bu_set_updated_at();

CREATE OR REPLACE FUNCTION fn_is_global_manager_user(p_usuario_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM socios s
    LEFT JOIN rol_aile_definitions rad ON rad.id = s.rol_aile_id
    WHERE s.usuario_id = COALESCE(p_usuario_id, auth.uid())
      AND COALESCE(s.estado, 'activo') = 'activo'
      AND (
        s.rol = 'admin'
        OR s.rol = 'comision_directiva'
        OR lower(COALESCE(rad.nombre, s.rol_aile, '')) IN (
          'presidente',
          'tesorero',
          'secretario general',
          'vocal titular'
        )
      )
  );
$$;

ALTER TABLE role_permission_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS role_permission_overrides_select ON role_permission_overrides;
CREATE POLICY role_permission_overrides_select
ON role_permission_overrides
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS role_permission_overrides_insert ON role_permission_overrides;
CREATE POLICY role_permission_overrides_insert
ON role_permission_overrides
FOR INSERT
TO authenticated
WITH CHECK ((SELECT fn_is_global_manager_user(auth.uid())));

DROP POLICY IF EXISTS role_permission_overrides_update ON role_permission_overrides;
CREATE POLICY role_permission_overrides_update
ON role_permission_overrides
FOR UPDATE
TO authenticated
USING ((SELECT fn_is_global_manager_user(auth.uid())))
WITH CHECK ((SELECT fn_is_global_manager_user(auth.uid())));

DROP POLICY IF EXISTS role_permission_overrides_delete ON role_permission_overrides;
CREATE POLICY role_permission_overrides_delete
ON role_permission_overrides
FOR DELETE
TO authenticated
USING ((SELECT fn_is_global_manager_user(auth.uid())));

-- Defaults iniciales para roles especiales auditados
WITH target_roles AS (
  SELECT id, lower(nombre) AS nombre_normalizado
  FROM rol_aile_definitions
),
seed AS (
  SELECT r.id AS rol_id, s.recurso, s.accion, s.permitido
  FROM target_roles r
  JOIN (
    VALUES
      -- RRHH
      ('director de rrhh', 'socios', 'ver', true),
      ('director de rrhh', 'socios', 'editar', true),
      ('directora de rrhh', 'socios', 'ver', true),
      ('directora de rrhh', 'socios', 'editar', true),
      ('director de recursos humanos', 'socios', 'ver', true),
      ('director de recursos humanos', 'socios', 'editar', true),
      ('directora de recursos humanos', 'socios', 'ver', true),
      ('directora de recursos humanos', 'socios', 'editar', true),
      ('miembro de rrhh', 'socios', 'ver', true),
      ('miembro de rrhh', 'socios', 'editar', true),
      ('miembro de recursos humanos', 'socios', 'ver', true),
      ('miembro de recursos humanos', 'socios', 'editar', true),

      -- Finanzas
      ('director de finanzas', 'deudas', 'ver', true),
      ('director de finanzas', 'deudas', 'editar', true),
      ('director de finanzas', 'finanzas', 'ver', true),
      ('director de finanzas', 'tesoreria', 'ver', true),
      ('director de finanzas', 'reintegros', 'ver', true),
      ('director de finanzas', 'reintegros', 'crear', true),

      ('directora de finanzas', 'deudas', 'ver', true),
      ('directora de finanzas', 'deudas', 'editar', true),
      ('directora de finanzas', 'finanzas', 'ver', true),
      ('directora de finanzas', 'tesoreria', 'ver', true),
      ('directora de finanzas', 'reintegros', 'ver', true),
      ('directora de finanzas', 'reintegros', 'crear', true),

      ('miembro de finanzas', 'deudas', 'ver', true),
      ('miembro de finanzas', 'deudas', 'editar', true),
      ('miembro de finanzas', 'finanzas', 'ver', true),
      ('miembro de finanzas', 'tesoreria', 'ver', true),
      ('miembro de finanzas', 'reintegros', 'ver', true),
      ('miembro de finanzas', 'reintegros', 'crear', true),

      ('tesorero', 'deudas', 'ver', true),
      ('tesorero', 'deudas', 'editar', true),
      ('tesorero', 'finanzas', 'ver', true),
      ('tesorero', 'tesoreria', 'ver', true),
      ('tesorero', 'reintegros', 'ver', true),
      ('tesorero', 'reintegros', 'crear', true)
  ) AS s(rol_nombre, recurso, accion, permitido)
    ON s.rol_nombre = r.nombre_normalizado
)
INSERT INTO role_permission_overrides (
  rol_aile_definition_id,
  recurso,
  accion,
  permitido
)
SELECT rol_id, recurso, accion, permitido
FROM seed
ON CONFLICT (rol_aile_definition_id, recurso, accion)
DO UPDATE SET
  permitido = EXCLUDED.permitido,
  updated_at = now();

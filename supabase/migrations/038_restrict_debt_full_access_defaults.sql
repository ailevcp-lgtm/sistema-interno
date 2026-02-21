-- ============================================================
-- 038: Restringe el acceso completo de Deudas por defecto
-- ============================================================
--
-- Regla institucional:
-- - Acceso completo a Deudas: Comision Directiva, Revisor de Cuentas y Director/a de Finanzas.
-- - Miembro de Finanzas y Tesorero no deben tener acceso completo por defecto.
--
-- Nota: el control maestro sigue siendo Ajustes > Permisos del rol.
-- Esta migracion solo corrige los valores base/seed existentes.

WITH target_roles AS (
  SELECT
    id,
    lower(regexp_replace(trim(nombre), '\s+', ' ', 'g')) AS nombre_normalizado
  FROM rol_aile_definitions
),
roles_con_deuda_restringida AS (
  SELECT id
  FROM target_roles
  WHERE nombre_normalizado IN ('miembro de finanzas', 'tesorero')
),
roles_director_finanzas AS (
  SELECT id
  FROM target_roles
  WHERE nombre_normalizado IN ('director de finanzas', 'directora de finanzas')
),
deny_payload AS (
  SELECT
    r.id AS rol_id,
    'deudas'::text AS recurso,
    a.accion,
    false AS permitido
  FROM roles_con_deuda_restringida r
  CROSS JOIN (
    VALUES
      ('ver'::text),
      ('crear'::text),
      ('editar'::text),
      ('eliminar'::text),
      ('aprobar'::text)
  ) AS a(accion)
),
allow_payload AS (
  SELECT
    r.id AS rol_id,
    'deudas'::text AS recurso,
    a.accion,
    true AS permitido
  FROM roles_director_finanzas r
  CROSS JOIN (
    VALUES
      ('ver'::text),
      ('editar'::text)
  ) AS a(accion)
),
upsert_payload AS (
  SELECT rol_id, recurso, accion, permitido FROM deny_payload
  UNION ALL
  SELECT rol_id, recurso, accion, permitido FROM allow_payload
)
INSERT INTO role_permission_overrides (
  rol_aile_definition_id,
  recurso,
  accion,
  permitido
)
SELECT
  rol_id,
  recurso,
  accion,
  permitido
FROM upsert_payload
ON CONFLICT (rol_aile_definition_id, recurso, accion)
DO UPDATE SET
  permitido = EXCLUDED.permitido,
  updated_at = now();

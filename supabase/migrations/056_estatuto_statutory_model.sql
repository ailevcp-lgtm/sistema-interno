-- ============================================================
-- 056: Modelo estatutario AILE
-- ============================================================
--
-- Migracion aditiva y conservadora:
-- - no borra tablas;
-- - no elimina registros;
-- - no resetea datos existentes;
-- - agrega campos nuevos con defaults compatibles.

ALTER TABLE socios
ADD COLUMN IF NOT EXISTS categoria_socio TEXT NOT NULL DEFAULT 'pleno';

ALTER TABLE socios
ADD COLUMN IF NOT EXISTS fecha_nacimiento DATE;

ALTER TABLE socios
ADD COLUMN IF NOT EXISTS fecha_notificacion_morosidad TIMESTAMPTZ;

ALTER TABLE socios
ADD COLUMN IF NOT EXISTS medio_notificacion_morosidad TEXT;

ALTER TABLE socios
ADD COLUMN IF NOT EXISTS observaciones_estatutarias TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'socios_categoria_socio_chk'
  ) THEN
    ALTER TABLE socios
    ADD CONSTRAINT socios_categoria_socio_chk
    CHECK (categoria_socio IN ('pleno', 'honorario', 'adherente'));
  END IF;
END $$;

COMMENT ON COLUMN socios.categoria_socio IS
  'Categoria estatutaria: pleno, honorario o adherente.';

COMMENT ON COLUMN socios.fecha_nacimiento IS
  'Fecha usada para validar mayoria de edad en voto y elegibilidad estatutaria.';

COMMENT ON COLUMN socios.fecha_notificacion_morosidad IS
  'Fecha de notificacion fehaciente por morosidad estatutaria.';

COMMENT ON COLUMN socios.medio_notificacion_morosidad IS
  'Medio usado para notificar morosidad: email, telefono declarado, mensajeria u otro.';

COMMENT ON COLUMN socios.observaciones_estatutarias IS
  'Notas internas vinculadas a condicion estatutaria, sanciones, cesantia o regularizacion.';

INSERT INTO rol_aile_definitions (nombre) VALUES
('Secretario'),
('Secretaria'),
('Secretario General'),
('Secretaria General'),
('Directora de Finanzas'),
('Miembro de Finanzas'),
('Director de Recursos Humanos'),
('Directora de Recursos Humanos'),
('Miembro de Recursos Humanos'),
('Director de Comunicacion'),
('Directora de Comunicacion'),
('Miembro de Comunicacion'),
('Director de CEA'),
('Directora de CEA'),
('Miembro de CEA')
ON CONFLICT (nombre) DO NOTHING;

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
          'secretario',
          'secretaria',
          'secretario general',
          'secretaria general',
          'vocal titular'
        )
      )
  );
$$;

WITH target_roles AS (
  SELECT
    id,
    lower(regexp_replace(trim(nombre), '\s+', ' ', 'g')) AS nombre_normalizado
  FROM rol_aile_definitions
),
seed AS (
  SELECT r.id AS rol_id, s.recurso, s.accion, s.permitido
  FROM target_roles r
  JOIN (
    VALUES
      -- Secretaria: actas, registro, citaciones y documentacion institucional.
      ('secretario', 'socios', 'ver', true),
      ('secretario', 'socios', 'editar', true),
      ('secretario', 'calendario', 'ver', true),
      ('secretario', 'calendario', 'crear', true),
      ('secretario', 'calendario', 'editar', true),
      ('secretario', 'reuniones', 'ver', true),
      ('secretario', 'reuniones', 'crear', true),
      ('secretario', 'reuniones', 'editar', true),
      ('secretario', 'documentos', 'ver', true),
      ('secretario', 'documentos', 'crear', true),
      ('secretario', 'documentos', 'editar', true),
      ('secretario', 'estatuto', 'ver', true),
      ('secretario', 'resoluciones', 'ver', true),
      ('secretario', 'resoluciones', 'crear', true),
      ('secretario', 'resoluciones', 'editar', true),
      ('secretario', 'balances', 'ver', true),
      ('secretario', 'comunicaciones', 'ver', true),
      ('secretario', 'comunicaciones', 'crear', true),
      ('secretario', 'comunicaciones', 'editar', true),

      ('secretaria', 'socios', 'ver', true),
      ('secretaria', 'socios', 'editar', true),
      ('secretaria', 'calendario', 'ver', true),
      ('secretaria', 'calendario', 'crear', true),
      ('secretaria', 'calendario', 'editar', true),
      ('secretaria', 'reuniones', 'ver', true),
      ('secretaria', 'reuniones', 'crear', true),
      ('secretaria', 'reuniones', 'editar', true),
      ('secretaria', 'documentos', 'ver', true),
      ('secretaria', 'documentos', 'crear', true),
      ('secretaria', 'documentos', 'editar', true),
      ('secretaria', 'estatuto', 'ver', true),
      ('secretaria', 'resoluciones', 'ver', true),
      ('secretaria', 'resoluciones', 'crear', true),
      ('secretaria', 'resoluciones', 'editar', true),
      ('secretaria', 'balances', 'ver', true),
      ('secretaria', 'comunicaciones', 'ver', true),
      ('secretaria', 'comunicaciones', 'crear', true),
      ('secretaria', 'comunicaciones', 'editar', true),

      ('secretario general', 'socios', 'ver', true),
      ('secretario general', 'socios', 'editar', true),
      ('secretario general', 'calendario', 'ver', true),
      ('secretario general', 'calendario', 'crear', true),
      ('secretario general', 'calendario', 'editar', true),
      ('secretario general', 'reuniones', 'ver', true),
      ('secretario general', 'reuniones', 'crear', true),
      ('secretario general', 'reuniones', 'editar', true),
      ('secretario general', 'documentos', 'ver', true),
      ('secretario general', 'documentos', 'crear', true),
      ('secretario general', 'documentos', 'editar', true),
      ('secretario general', 'estatuto', 'ver', true),
      ('secretario general', 'resoluciones', 'ver', true),
      ('secretario general', 'resoluciones', 'crear', true),
      ('secretario general', 'resoluciones', 'editar', true),
      ('secretario general', 'balances', 'ver', true),
      ('secretario general', 'comunicaciones', 'ver', true),
      ('secretario general', 'comunicaciones', 'crear', true),
      ('secretario general', 'comunicaciones', 'editar', true),

      ('secretaria general', 'socios', 'ver', true),
      ('secretaria general', 'socios', 'editar', true),
      ('secretaria general', 'calendario', 'ver', true),
      ('secretaria general', 'calendario', 'crear', true),
      ('secretaria general', 'calendario', 'editar', true),
      ('secretaria general', 'reuniones', 'ver', true),
      ('secretaria general', 'reuniones', 'crear', true),
      ('secretaria general', 'reuniones', 'editar', true),
      ('secretaria general', 'documentos', 'ver', true),
      ('secretaria general', 'documentos', 'crear', true),
      ('secretaria general', 'documentos', 'editar', true),
      ('secretaria general', 'estatuto', 'ver', true),
      ('secretaria general', 'resoluciones', 'ver', true),
      ('secretaria general', 'resoluciones', 'crear', true),
      ('secretaria general', 'resoluciones', 'editar', true),
      ('secretaria general', 'balances', 'ver', true),
      ('secretaria general', 'comunicaciones', 'ver', true),
      ('secretaria general', 'comunicaciones', 'crear', true),
      ('secretaria general', 'comunicaciones', 'editar', true),

      -- Tesoreria: cuotas, cobros, contabilidad y balances.
      ('tesorero', 'deudas', 'ver', true),
      ('tesorero', 'deudas', 'editar', true),
      ('tesorero', 'movimientos', 'ver', true),
      ('tesorero', 'movimientos', 'crear', true),
      ('tesorero', 'movimientos', 'editar', true),
      ('tesorero', 'finanzas', 'ver', true),
      ('tesorero', 'finanzas', 'crear', true),
      ('tesorero', 'finanzas', 'editar', true),
      ('tesorero', 'tesoreria', 'ver', true),
      ('tesorero', 'tesoreria', 'crear', true),
      ('tesorero', 'tesoreria', 'editar', true),
      ('tesorero', 'reintegros', 'ver', true),
      ('tesorero', 'reintegros', 'crear', true),
      ('tesorero', 'reintegros', 'editar', true),
      ('tesorero', 'balances', 'ver', true),
      ('tesorero', 'balances', 'crear', true),
      ('tesorero', 'balances', 'editar', true),
      ('tesorero', 'socios', 'ver', true),
      ('tesorero', 'socios', 'editar', true),

      -- Revisora de Cuentas: fiscalizacion con lectura amplia.
      ('revisor de cuentas', 'socios', 'ver', true),
      ('revisor de cuentas', 'deudas', 'ver', true),
      ('revisor de cuentas', 'movimientos', 'ver', true),
      ('revisor de cuentas', 'finanzas', 'ver', true),
      ('revisor de cuentas', 'tesoreria', 'ver', true),
      ('revisor de cuentas', 'documentos', 'ver', true),
      ('revisor de cuentas', 'estatuto', 'ver', true),
      ('revisor de cuentas', 'resoluciones', 'ver', true),
      ('revisor de cuentas', 'balances', 'ver', true),
      ('revisor de cuentas', 'logs', 'ver', true),
      ('revisor de cuentas', 'reuniones', 'ver', true),

      ('revisor de cuentas titular', 'socios', 'ver', true),
      ('revisor de cuentas titular', 'deudas', 'ver', true),
      ('revisor de cuentas titular', 'movimientos', 'ver', true),
      ('revisor de cuentas titular', 'finanzas', 'ver', true),
      ('revisor de cuentas titular', 'tesoreria', 'ver', true),
      ('revisor de cuentas titular', 'documentos', 'ver', true),
      ('revisor de cuentas titular', 'estatuto', 'ver', true),
      ('revisor de cuentas titular', 'resoluciones', 'ver', true),
      ('revisor de cuentas titular', 'balances', 'ver', true),
      ('revisor de cuentas titular', 'logs', 'ver', true),
      ('revisor de cuentas titular', 'reuniones', 'ver', true),

      ('revisor de cuentas suplente', 'socios', 'ver', true),
      ('revisor de cuentas suplente', 'deudas', 'ver', true),
      ('revisor de cuentas suplente', 'movimientos', 'ver', true),
      ('revisor de cuentas suplente', 'finanzas', 'ver', true),
      ('revisor de cuentas suplente', 'tesoreria', 'ver', true),
      ('revisor de cuentas suplente', 'documentos', 'ver', true),
      ('revisor de cuentas suplente', 'estatuto', 'ver', true),
      ('revisor de cuentas suplente', 'resoluciones', 'ver', true),
      ('revisor de cuentas suplente', 'balances', 'ver', true),
      ('revisor de cuentas suplente', 'logs', 'ver', true),
      ('revisor de cuentas suplente', 'reuniones', 'ver', true)
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

CREATE OR REPLACE VIEW socios_estatutarios
WITH (security_invoker = true)
AS
WITH cuota_estado AS (
  SELECT
    socio_id,
    count(*) FILTER (
      WHERE estado <> 'pagada'
        AND GREATEST(COALESCE(monto_esperado, 0) - COALESCE(monto_pagado, 0), 0) > 0
    ) AS cuotas_impagas_count
  FROM cuotas
  GROUP BY socio_id
)
SELECT
  s.*,
  COALESCE(ce.cuotas_impagas_count, 0)::integer AS cuotas_impagas_count,
  (COALESCE(ce.cuotas_impagas_count, 0) = 0) AS esta_al_dia,
  (COALESCE(ce.cuotas_impagas_count, 0) >= 3) AS requiere_notificacion_morosidad,
  CASE
    WHEN s.fecha_nacimiento IS NULL THEN NULL
    ELSE date_part('year', age(current_date, s.fecha_nacimiento))::integer
  END AS edad,
  GREATEST(
    (
      date_part('year', age(current_date, s.fecha_ingreso))::integer * 12
      + date_part('month', age(current_date, s.fecha_ingreso))::integer
    ),
    0
  ) AS meses_antiguedad,
  (
    s.estado = 'activo'
    AND s.categoria_socio = 'pleno'
    AND s.fecha_nacimiento IS NOT NULL
    AND date_part('year', age(current_date, s.fecha_nacimiento)) >= 18
    AND (
      current_date <= date '2028-04-30'
      OR (
        date_part('year', age(current_date, s.fecha_ingreso))::integer * 12
        + date_part('month', age(current_date, s.fecha_ingreso))::integer
      ) >= 6
    )
    AND COALESCE(ce.cuotas_impagas_count, 0) = 0
  ) AS puede_votar,
  (
    s.estado = 'activo'
    AND s.categoria_socio = 'pleno'
    AND s.fecha_nacimiento IS NOT NULL
    AND date_part('year', age(current_date, s.fecha_nacimiento)) >= 18
    AND (
      current_date <= date '2028-04-30'
      OR (
        date_part('year', age(current_date, s.fecha_ingreso))::integer * 12
        + date_part('month', age(current_date, s.fecha_ingreso))::integer
      ) >= 6
    )
    AND COALESCE(ce.cuotas_impagas_count, 0) = 0
  ) AS puede_integrar_organos
FROM socios s
LEFT JOIN cuota_estado ce ON ce.socio_id = s.id;

COMMENT ON VIEW socios_estatutarios IS
  'Vista de lectura para padron y condicion estatutaria: categoria, cuotas, voto y elegibilidad.';

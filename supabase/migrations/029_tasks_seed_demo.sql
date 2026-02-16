-- ============================================================
-- 029: Seed demo for tasks / kanban + QA snapshot RPC
-- ============================================================
-- Objetivo:
-- - Insertar datos demo reproducibles para validar Kanban.
-- - Cubrir escenarios: socio asignado/no asignado, director dueño/ajeno,
--   handoff entre direcciones y aprobación CD.
-- - Exponer un snapshot RPC de seguridad para QA automatizado.
-- ============================================================

DO $$
DECLARE
  v_dir_cea UUID;
  v_dir_finanzas UUID;
  v_dir_rrhh UUID;
  v_dir_comunicacion UUID;

  v_admin_fausto UUID;
  v_cd_matias UUID;
  v_dir_cea_juan UUID;
  v_dir_comunicacion_emiliano UUID;
  v_dir_finanzas_ignacio UUID;
  v_socio_cea_valentin UUID;
  v_socio_com_hannah UUID;
  v_socio_com_nahir UUID;
  v_socio_finanzas_joaquin UUID;
  v_socio_no_asignado_gabriel UUID;
BEGIN
  IF to_regclass('public.proyectos_tareas') IS NULL THEN
    RAISE EXCEPTION 'Tabla proyectos_tareas no existe. Ejecutar primero migracion 027_tasks_core_schema.sql';
  END IF;

  SELECT id INTO v_dir_cea FROM direcciones WHERE codigo = 'cea';
  SELECT id INTO v_dir_finanzas FROM direcciones WHERE codigo = 'finanzas';
  SELECT id INTO v_dir_rrhh FROM direcciones WHERE codigo = 'recursos_humanos';
  SELECT id INTO v_dir_comunicacion FROM direcciones WHERE codigo = 'comunicacion';

  IF v_dir_cea IS NULL OR v_dir_finanzas IS NULL OR v_dir_rrhh IS NULL OR v_dir_comunicacion IS NULL THEN
    RAISE EXCEPTION 'Direcciones base incompletas. Verificar seed de direcciones en migracion 027';
  END IF;

  SELECT id INTO v_admin_fausto FROM socios WHERE lower(email) = 'faustolavezzari99@gmail.com' LIMIT 1;
  SELECT id INTO v_cd_matias FROM socios WHERE lower(email) = 'matimarchesinkossoy@gmail.com' LIMIT 1;
  SELECT id INTO v_dir_cea_juan FROM socios WHERE lower(email) = 'juanmaphilippeaux@gmail.com' LIMIT 1;
  SELECT id INTO v_dir_comunicacion_emiliano FROM socios WHERE lower(email) = 'emiagugames@gmail.com' LIMIT 1;
  SELECT id INTO v_dir_finanzas_ignacio FROM socios WHERE lower(email) = 'nachoalcedo@gmail.com' LIMIT 1;
  SELECT id INTO v_socio_cea_valentin FROM socios WHERE lower(email) = 'valentinpaz@live.com' LIMIT 1;
  SELECT id INTO v_socio_com_hannah FROM socios WHERE lower(email) = 'hannahaltamirano1@gmail.com' LIMIT 1;
  SELECT id INTO v_socio_com_nahir FROM socios WHERE lower(email) = 'naiiabatte@gmail.com' LIMIT 1;
  SELECT id INTO v_socio_finanzas_joaquin FROM socios WHERE lower(email) = 'joaquincarcano2@gmail.com' LIMIT 1;
  SELECT id INTO v_socio_no_asignado_gabriel FROM socios WHERE lower(email) = 'gabrielgarciaimportantes@gmail.com' LIMIT 1;

  IF v_admin_fausto IS NULL
    OR v_cd_matias IS NULL
    OR v_dir_cea_juan IS NULL
    OR v_dir_comunicacion_emiliano IS NULL
    OR v_dir_finanzas_ignacio IS NULL
    OR v_socio_cea_valentin IS NULL
    OR v_socio_com_hannah IS NULL
    OR v_socio_com_nahir IS NULL
    OR v_socio_finanzas_joaquin IS NULL
    OR v_socio_no_asignado_gabriel IS NULL THEN
    RAISE EXCEPTION 'Socios demo faltantes. Ejecutar primero migracion 006_seed_socios.sql';
  END IF;

  -- Membresias de direccion para escenarios RBAC.
  INSERT INTO socios_direcciones (
    socio_id,
    direccion_id,
    es_director,
    activo,
    fecha_desde,
    fecha_hasta
  )
  VALUES
    (v_dir_cea_juan, v_dir_cea, true, true, DATE '2024-01-01', NULL),
    (v_socio_cea_valentin, v_dir_cea, false, true, DATE '2024-01-01', NULL),
    (v_dir_comunicacion_emiliano, v_dir_comunicacion, true, true, DATE '2024-01-01', NULL),
    (v_socio_com_hannah, v_dir_comunicacion, false, true, DATE '2024-01-01', NULL),
    (v_socio_com_nahir, v_dir_comunicacion, false, true, DATE '2024-01-01', NULL),
    (v_dir_finanzas_ignacio, v_dir_finanzas, true, true, DATE '2024-01-01', NULL),
    (v_socio_finanzas_joaquin, v_dir_finanzas, false, true, DATE '2024-01-01', NULL)
  ON CONFLICT (socio_id, direccion_id) DO UPDATE
  SET
    es_director = EXCLUDED.es_director,
    activo = EXCLUDED.activo,
    fecha_desde = LEAST(socios_direcciones.fecha_desde, EXCLUDED.fecha_desde),
    fecha_hasta = NULL,
    updated_at = now();

  -- Proyectos demo requeridos.
  INSERT INTO proyectos_tareas (
    id,
    nombre,
    descripcion,
    tipo,
    direccion_id,
    creado_por_socio_id,
    responsable_socio_id,
    activo,
    fecha_inicio,
    fecha_fin_estimada,
    fecha_cierre
  )
  VALUES
    (
      '6c902c20-88d0-4ec1-8a0a-5b9e4a530101',
      'Modelo ONU - Carteles',
      'Proyecto institucional para diseñar y aprobar la carteleria del Modelo ONU.',
      'institucional',
      v_dir_cea,
      v_dir_cea_juan,
      v_socio_cea_valentin,
      true,
      DATE '2026-02-01',
      DATE '2026-03-10',
      NULL
    ),
    (
      '6c902c20-88d0-4ec1-8a0a-5b9e4a530102',
      'Planificación Redes',
      'Proyecto interno de Comunicación para ordenar calendario y aprobaciones de contenidos.',
      'interno_direccion',
      v_dir_comunicacion,
      v_dir_comunicacion_emiliano,
      v_dir_comunicacion_emiliano,
      true,
      DATE '2026-02-01',
      DATE '2026-03-31',
      NULL
    )
  ON CONFLICT (id) DO UPDATE
  SET
    nombre = EXCLUDED.nombre,
    descripcion = EXCLUDED.descripcion,
    tipo = EXCLUDED.tipo,
    direccion_id = EXCLUDED.direccion_id,
    creado_por_socio_id = EXCLUDED.creado_por_socio_id,
    responsable_socio_id = EXCLUDED.responsable_socio_id,
    activo = EXCLUDED.activo,
    fecha_inicio = EXCLUDED.fecha_inicio,
    fecha_fin_estimada = EXCLUDED.fecha_fin_estimada,
    fecha_cierre = EXCLUDED.fecha_cierre;

  INSERT INTO tareas (
    id,
    proyecto_id,
    titulo,
    descripcion,
    estado,
    prioridad,
    orden_en_columna,
    asignado_socio_id,
    creado_por_socio_id,
    updated_by_socio_id,
    fecha_vencimiento,
    fecha_inicio_real,
    fecha_cierre
  )
  VALUES
    (
      '6c902c20-88d0-4ec1-8a0a-5b9e4a530201',
      '6c902c20-88d0-4ec1-8a0a-5b9e4a530101',
      'Definir lineamientos visuales del evento',
      'Tarea sin asignar para validar acceso de socio no asignado.',
      'por_hacer',
      2,
      0,
      NULL,
      v_dir_cea_juan,
      v_dir_cea_juan,
      DATE '2026-02-20',
      NULL,
      NULL
    ),
    (
      '6c902c20-88d0-4ec1-8a0a-5b9e4a530202',
      '6c902c20-88d0-4ec1-8a0a-5b9e4a530101',
      'Diseñar set de carteles por comité',
      'Incluye pedido de handoff pendiente hacia Finanzas para validar presupuesto.',
      'pendiente_handoff',
      2,
      1,
      v_socio_com_hannah,
      v_dir_comunicacion_emiliano,
      v_dir_comunicacion_emiliano,
      DATE '2026-02-25',
      now() - interval '1 day',
      NULL
    ),
    (
      '6c902c20-88d0-4ec1-8a0a-5b9e4a530203',
      '6c902c20-88d0-4ec1-8a0a-5b9e4a530101',
      'Enviar arte final a Comisión Directiva',
      'Escenario de envio a CD pendiente de decision.',
      'pendiente_aprobacion_cd',
      1,
      0,
      v_dir_comunicacion_emiliano,
      v_dir_cea_juan,
      v_dir_comunicacion_emiliano,
      DATE '2026-02-27',
      now() - interval '12 hours',
      NULL
    ),
    (
      '6c902c20-88d0-4ec1-8a0a-5b9e4a530204',
      '6c902c20-88d0-4ec1-8a0a-5b9e4a530101',
      'Aplicar observaciones de CD',
      'Escenario con decision observada para validar reproceso.',
      'observada_cd',
      1,
      0,
      v_socio_com_hannah,
      v_cd_matias,
      v_socio_com_hannah,
      DATE '2026-03-02',
      now() - interval '2 days',
      NULL
    ),
    (
      '6c902c20-88d0-4ec1-8a0a-5b9e4a530205',
      '6c902c20-88d0-4ec1-8a0a-5b9e4a530102',
      'Armar calendario mensual de publicaciones',
      'Escenario de socio asignado (task + subtarea).',
      'por_hacer',
      3,
      0,
      v_socio_com_nahir,
      v_dir_comunicacion_emiliano,
      v_socio_com_nahir,
      DATE '2026-02-22',
      NULL,
      NULL
    ),
    (
      '6c902c20-88d0-4ec1-8a0a-5b9e4a530206',
      '6c902c20-88d0-4ec1-8a0a-5b9e4a530102',
      'Alinear pauta con Finanzas',
      'Escenario de handoff aceptado entre Comunicación y Finanzas.',
      'en_progreso',
      2,
      0,
      v_socio_finanzas_joaquin,
      v_dir_comunicacion_emiliano,
      v_dir_finanzas_ignacio,
      DATE '2026-02-24',
      now() - interval '18 hours',
      NULL
    ),
    (
      '6c902c20-88d0-4ec1-8a0a-5b9e4a530207',
      '6c902c20-88d0-4ec1-8a0a-5b9e4a530102',
      'Publicación final aprobada por CD',
      'Caso cerrado con aprobacion CD completa.',
      'aprobada_cd',
      1,
      0,
      v_socio_com_nahir,
      v_dir_comunicacion_emiliano,
      v_admin_fausto,
      DATE '2026-02-21',
      now() - interval '4 days',
      now() - interval '1 day'
    )
  ON CONFLICT (id) DO UPDATE
  SET
    proyecto_id = EXCLUDED.proyecto_id,
    titulo = EXCLUDED.titulo,
    descripcion = EXCLUDED.descripcion,
    estado = EXCLUDED.estado,
    prioridad = EXCLUDED.prioridad,
    orden_en_columna = EXCLUDED.orden_en_columna,
    asignado_socio_id = EXCLUDED.asignado_socio_id,
    creado_por_socio_id = EXCLUDED.creado_por_socio_id,
    updated_by_socio_id = EXCLUDED.updated_by_socio_id,
    fecha_vencimiento = EXCLUDED.fecha_vencimiento,
    fecha_inicio_real = EXCLUDED.fecha_inicio_real,
    fecha_cierre = EXCLUDED.fecha_cierre;

  INSERT INTO subtareas (
    id,
    tarea_id,
    titulo,
    descripcion,
    estado,
    orden_en_columna,
    asignado_socio_id,
    creado_por_socio_id,
    updated_by_socio_id,
    fecha_vencimiento
  )
  VALUES
    (
      '6c902c20-88d0-4ec1-8a0a-5b9e4a530301',
      '6c902c20-88d0-4ec1-8a0a-5b9e4a530205',
      'Definir grilla semanal',
      'Subtarea asignada a socio de Comunicación.',
      'por_hacer',
      0,
      v_socio_com_nahir,
      v_dir_comunicacion_emiliano,
      v_socio_com_nahir,
      DATE '2026-02-19'
    ),
    (
      '6c902c20-88d0-4ec1-8a0a-5b9e4a530302',
      '6c902c20-88d0-4ec1-8a0a-5b9e4a530205',
      'Definir copies base',
      'Subtarea sin asignar para pruebas de visibilidad.',
      'backlog',
      1,
      NULL,
      v_dir_comunicacion_emiliano,
      v_dir_comunicacion_emiliano,
      DATE '2026-02-20'
    ),
    (
      '6c902c20-88d0-4ec1-8a0a-5b9e4a530303',
      '6c902c20-88d0-4ec1-8a0a-5b9e4a530202',
      'Diseño de cartel para Consejo de Seguridad',
      'Subtarea asignada para test de edicion sobre asignacion.',
      'en_progreso',
      0,
      v_socio_com_hannah,
      v_dir_comunicacion_emiliano,
      v_socio_com_hannah,
      DATE '2026-02-23'
    ),
    (
      '6c902c20-88d0-4ec1-8a0a-5b9e4a530304',
      '6c902c20-88d0-4ec1-8a0a-5b9e4a530202',
      'Checklist de impresión',
      'Subtarea en revision de direccion.',
      'en_revision_direccion',
      1,
      v_dir_comunicacion_emiliano,
      v_dir_comunicacion_emiliano,
      v_dir_comunicacion_emiliano,
      DATE '2026-02-24'
    )
  ON CONFLICT (id) DO UPDATE
  SET
    tarea_id = EXCLUDED.tarea_id,
    titulo = EXCLUDED.titulo,
    descripcion = EXCLUDED.descripcion,
    estado = EXCLUDED.estado,
    orden_en_columna = EXCLUDED.orden_en_columna,
    asignado_socio_id = EXCLUDED.asignado_socio_id,
    creado_por_socio_id = EXCLUDED.creado_por_socio_id,
    updated_by_socio_id = EXCLUDED.updated_by_socio_id,
    fecha_vencimiento = EXCLUDED.fecha_vencimiento;

  INSERT INTO tareas_handoffs (
    id,
    tarea_id,
    de_socio_id,
    a_socio_id,
    solicitado_por_socio_id,
    resuelto_por_socio_id,
    estado,
    motivo,
    comentario_resolucion,
    metadata,
    resuelto_at
  )
  VALUES
    (
      '6c902c20-88d0-4ec1-8a0a-5b9e4a530401',
      '6c902c20-88d0-4ec1-8a0a-5b9e4a530206',
      v_socio_com_nahir,
      v_socio_finanzas_joaquin,
      v_dir_comunicacion_emiliano,
      v_dir_finanzas_ignacio,
      'aceptado',
      'Se requiere validacion presupuestaria por parte de Finanzas.',
      'Handoff aceptado por director de Finanzas.',
      jsonb_build_object(
        'de_direccion_codigo', 'comunicacion',
        'a_direccion_codigo', 'finanzas',
        'origen', 'seed_demo_029'
      ),
      now() - interval '15 hours'
    ),
    (
      '6c902c20-88d0-4ec1-8a0a-5b9e4a530402',
      '6c902c20-88d0-4ec1-8a0a-5b9e4a530202',
      v_socio_com_hannah,
      v_socio_finanzas_joaquin,
      v_dir_comunicacion_emiliano,
      NULL,
      'pendiente',
      'Necesita control de costos de impresión.',
      NULL,
      jsonb_build_object(
        'de_direccion_codigo', 'comunicacion',
        'a_direccion_codigo', 'finanzas',
        'origen', 'seed_demo_029'
      ),
      NULL
    )
  ON CONFLICT (id) DO UPDATE
  SET
    tarea_id = EXCLUDED.tarea_id,
    de_socio_id = EXCLUDED.de_socio_id,
    a_socio_id = EXCLUDED.a_socio_id,
    solicitado_por_socio_id = EXCLUDED.solicitado_por_socio_id,
    resuelto_por_socio_id = EXCLUDED.resuelto_por_socio_id,
    estado = EXCLUDED.estado,
    motivo = EXCLUDED.motivo,
    comentario_resolucion = EXCLUDED.comentario_resolucion,
    metadata = EXCLUDED.metadata,
    resuelto_at = EXCLUDED.resuelto_at;

  INSERT INTO tareas_aprobaciones_cd (
    id,
    tarea_id,
    socio_id,
    decision,
    observacion,
    metadata,
    aprobado_at
  )
  VALUES
    (
      '6c902c20-88d0-4ec1-8a0a-5b9e4a530501',
      '6c902c20-88d0-4ec1-8a0a-5b9e4a530203',
      v_cd_matias,
      'pendiente',
      NULL,
      jsonb_build_object('origen', 'seed_demo_029'),
      NULL
    ),
    (
      '6c902c20-88d0-4ec1-8a0a-5b9e4a530502',
      '6c902c20-88d0-4ec1-8a0a-5b9e4a530203',
      v_admin_fausto,
      'pendiente',
      NULL,
      jsonb_build_object('origen', 'seed_demo_029'),
      NULL
    ),
    (
      '6c902c20-88d0-4ec1-8a0a-5b9e4a530503',
      '6c902c20-88d0-4ec1-8a0a-5b9e4a530204',
      v_cd_matias,
      'observada',
      'Ajustar tipografia y contraste del bloque institucional.',
      jsonb_build_object('origen', 'seed_demo_029'),
      now() - interval '2 days'
    ),
    (
      '6c902c20-88d0-4ec1-8a0a-5b9e4a530504',
      '6c902c20-88d0-4ec1-8a0a-5b9e4a530204',
      v_admin_fausto,
      'aprobada',
      NULL,
      jsonb_build_object('origen', 'seed_demo_029'),
      now() - interval '2 days'
    ),
    (
      '6c902c20-88d0-4ec1-8a0a-5b9e4a530505',
      '6c902c20-88d0-4ec1-8a0a-5b9e4a530207',
      v_cd_matias,
      'aprobada',
      NULL,
      jsonb_build_object('origen', 'seed_demo_029'),
      now() - interval '1 day'
    ),
    (
      '6c902c20-88d0-4ec1-8a0a-5b9e4a530506',
      '6c902c20-88d0-4ec1-8a0a-5b9e4a530207',
      v_admin_fausto,
      'aprobada',
      NULL,
      jsonb_build_object('origen', 'seed_demo_029'),
      now() - interval '1 day'
    )
  ON CONFLICT (tarea_id, socio_id) DO UPDATE
  SET
    decision = EXCLUDED.decision,
    observacion = EXCLUDED.observacion,
    metadata = EXCLUDED.metadata,
    aprobado_at = EXCLUDED.aprobado_at;

  -- Historial demo (append-only): IDs fijos + DO NOTHING.
  INSERT INTO tareas_historial (
    id,
    proyecto_id,
    tarea_id,
    subtarea_id,
    actor_socio_id,
    accion,
    estado_anterior,
    estado_nuevo,
    payload
  )
  VALUES
    (
      '6c902c20-88d0-4ec1-8a0a-5b9e4a530601',
      '6c902c20-88d0-4ec1-8a0a-5b9e4a530102',
      NULL,
      NULL,
      v_dir_comunicacion_emiliano,
      'proyecto_creado',
      NULL,
      NULL,
      jsonb_build_object('nombre', 'Planificación Redes', 'origen', 'seed_demo_029')
    ),
    (
      '6c902c20-88d0-4ec1-8a0a-5b9e4a530602',
      '6c902c20-88d0-4ec1-8a0a-5b9e4a530102',
      '6c902c20-88d0-4ec1-8a0a-5b9e4a530206',
      NULL,
      v_dir_comunicacion_emiliano,
      'handoff_solicitado',
      'por_hacer',
      'pendiente_handoff',
      jsonb_build_object('de_direccion_codigo', 'comunicacion', 'a_direccion_codigo', 'finanzas')
    ),
    (
      '6c902c20-88d0-4ec1-8a0a-5b9e4a530603',
      '6c902c20-88d0-4ec1-8a0a-5b9e4a530102',
      '6c902c20-88d0-4ec1-8a0a-5b9e4a530206',
      NULL,
      v_dir_finanzas_ignacio,
      'handoff_aceptado',
      'pendiente_handoff',
      'en_progreso',
      jsonb_build_object('resuelto_por', 'finanzas')
    ),
    (
      '6c902c20-88d0-4ec1-8a0a-5b9e4a530604',
      '6c902c20-88d0-4ec1-8a0a-5b9e4a530101',
      '6c902c20-88d0-4ec1-8a0a-5b9e4a530203',
      NULL,
      v_dir_comunicacion_emiliano,
      'enviado_aprobacion_cd',
      'en_revision_direccion',
      'pendiente_aprobacion_cd',
      jsonb_build_object('origen', 'seed_demo_029')
    ),
    (
      '6c902c20-88d0-4ec1-8a0a-5b9e4a530605',
      '6c902c20-88d0-4ec1-8a0a-5b9e4a530101',
      '6c902c20-88d0-4ec1-8a0a-5b9e4a530204',
      NULL,
      v_cd_matias,
      'cd_observa_tarea',
      'pendiente_aprobacion_cd',
      'observada_cd',
      jsonb_build_object('observacion', 'Ajustar tipografia y contraste del bloque institucional.')
    ),
    (
      '6c902c20-88d0-4ec1-8a0a-5b9e4a530606',
      '6c902c20-88d0-4ec1-8a0a-5b9e4a530102',
      '6c902c20-88d0-4ec1-8a0a-5b9e4a530207',
      NULL,
      v_admin_fausto,
      'cd_aprueba_tarea',
      'pendiente_aprobacion_cd',
      'aprobada_cd',
      jsonb_build_object('origen', 'seed_demo_029')
    )
  ON CONFLICT (id) DO NOTHING;
END;
$$;

-- RPC de snapshot para QA de seguridad y datos demo.
CREATE OR REPLACE FUNCTION rpc_tareas_qc_snapshot()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_snapshot JSONB;
BEGIN
  WITH required_tables AS (
    SELECT unnest(
      ARRAY[
        'direcciones',
        'socios_direcciones',
        'proyectos_tareas',
        'tareas',
        'subtareas',
        'tareas_handoffs',
        'tareas_aprobaciones_cd',
        'tareas_historial'
      ]::TEXT[]
    ) AS table_name
  ),
  table_stats AS (
    SELECT
      rt.table_name,
      (c.oid IS NOT NULL) AS exists,
      COALESCE(c.relrowsecurity, false) AS rls_enabled,
      COUNT(p.policyname)::INT AS policy_count,
      COALESCE(
        jsonb_agg(DISTINCT p.cmd) FILTER (WHERE p.cmd IS NOT NULL),
        '[]'::jsonb
      ) AS policy_cmds
    FROM required_tables rt
    LEFT JOIN pg_namespace n
      ON n.nspname = 'public'
    LEFT JOIN pg_class c
      ON c.relname = rt.table_name
     AND c.relnamespace = n.oid
    LEFT JOIN pg_policies p
      ON p.schemaname = 'public'
     AND p.tablename = rt.table_name
    GROUP BY rt.table_name, c.oid, c.relrowsecurity
  )
  SELECT jsonb_build_object(
    'generated_at',
    now(),
    'table_security',
    (
      SELECT jsonb_object_agg(
        ts.table_name,
        jsonb_build_object(
          'exists', ts.exists,
          'rls_enabled', ts.rls_enabled,
          'policy_count', ts.policy_count,
          'policy_cmds', ts.policy_cmds
        )
      )
      FROM table_stats ts
    ),
    'rpc_tareas_functions',
    (
      SELECT COALESCE(
        jsonb_agg(p.proname ORDER BY p.proname),
        '[]'::jsonb
      )
      FROM pg_proc p
      JOIN pg_namespace n
        ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND (
          p.proname LIKE 'rpc_tareas_%'
          OR p.proname LIKE 'rpc_tasks_%'
        )
    ),
    'demo_projects',
    (
      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'id', pt.id,
            'nombre', pt.nombre,
            'tipo', pt.tipo,
            'direccion_codigo', d.codigo,
            'activo', pt.activo
          )
          ORDER BY pt.nombre
        ),
        '[]'::jsonb
      )
      FROM proyectos_tareas pt
      LEFT JOIN direcciones d
        ON d.id = pt.direccion_id
      WHERE pt.id IN (
        '6c902c20-88d0-4ec1-8a0a-5b9e4a530101'::UUID,
        '6c902c20-88d0-4ec1-8a0a-5b9e4a530102'::UUID
      )
    ),
    'demo_personas',
    (
      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'email', s.email,
            'rol', s.rol,
            'rol_aile', s.rol_aile
          )
          ORDER BY s.email
        ),
        '[]'::jsonb
      )
      FROM socios s
      WHERE lower(s.email) IN (
        'faustolavezzari99@gmail.com',
        'matimarchesinkossoy@gmail.com',
        'emiagugames@gmail.com',
        'nachoalcedo@gmail.com',
        'gabrielgarciaimportantes@gmail.com',
        'naiiabatte@gmail.com'
      )
    )
  )
  INTO v_snapshot;

  RETURN v_snapshot;
END;
$$;

REVOKE ALL ON FUNCTION rpc_tareas_qc_snapshot() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION rpc_tareas_qc_snapshot() TO authenticated;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_roles
    WHERE rolname = 'service_role'
  ) THEN
    GRANT EXECUTE ON FUNCTION rpc_tareas_qc_snapshot() TO service_role;
  END IF;
END;
$$;

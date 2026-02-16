-- ============================================================
-- 028: Tasks permissions + workflow RPC (Agent 2)
-- ============================================================

-- Dependencia: requiere la migracion 027_tasks_core_schema.sql
DO $$
BEGIN
  IF to_regclass('public.proyectos_tareas') IS NULL
     OR to_regclass('public.tareas') IS NULL
     OR to_regclass('public.subtareas') IS NULL
     OR to_regclass('public.tareas_handoffs') IS NULL
     OR to_regclass('public.tareas_aprobaciones_cd') IS NULL
     OR to_regclass('public.tareas_historial') IS NULL
     OR to_regclass('public.direcciones') IS NULL
     OR to_regclass('public.socios_direcciones') IS NULL THEN
    RAISE EXCEPTION 'La migracion 028 requiere el schema base creado en migracion 027';
  END IF;
END;
$$;

-- ------------------------------------------------------------
-- 1) Helpers de identidad y permisos (obligatorios + soporte)
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_tasks_normalize_text(p_text TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(
    btrim(
      regexp_replace(
        translate(
          COALESCE(p_text, ''),
          'ÁÀÂÄÃáàâäãÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÖÕóòôöõÚÙÛÜúùûüÑñÇç',
          'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuNnCc'
        ),
        '\\s+',
        ' ',
        'g'
      )
    )
  );
$$;

CREATE OR REPLACE FUNCTION fn_tasks_current_socio_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id
  FROM socios s
  WHERE s.usuario_id = auth.uid()
    AND COALESCE(s.estado, 'activo') = 'activo'
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION fn_tasks_is_cd_or_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM socios s
    WHERE s.usuario_id = auth.uid()
      AND COALESCE(s.estado, 'activo') = 'activo'
      AND s.rol IN ('comision_directiva', 'admin')
  );
$$;

CREATE OR REPLACE FUNCTION fn_tasks_is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM socios s
    WHERE s.usuario_id = auth.uid()
      AND COALESCE(s.estado, 'activo') = 'activo'
      AND s.rol = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION fn_tasks_direction_code_from_input(p_input TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_norm TEXT := fn_tasks_normalize_text(p_input);
BEGIN
  IF v_norm = '' THEN
    RETURN NULL;
  END IF;

  IF v_norm LIKE '%cea%' THEN
    RETURN 'cea';
  ELSIF v_norm LIKE '%finanza%' THEN
    RETURN 'finanzas';
  ELSIF v_norm LIKE '%rrhh%' OR (v_norm LIKE '%recurso%' AND v_norm LIKE '%human%') THEN
    RETURN 'recursos_humanos';
  ELSIF v_norm LIKE '%comunic%' THEN
    RETURN 'comunicacion';
  END IF;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION fn_tasks_resolve_direccion_id(p_direccion_ref TEXT)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH normalized AS (
    SELECT fn_tasks_direction_code_from_input(p_direccion_ref) AS code
  )
  SELECT d.id
  FROM direcciones d
  CROSS JOIN normalized n
  WHERE d.activo = true
    AND (
      fn_tasks_normalize_text(d.codigo) = fn_tasks_normalize_text(p_direccion_ref)
      OR fn_tasks_normalize_text(d.nombre) = fn_tasks_normalize_text(p_direccion_ref)
      OR (n.code IS NOT NULL AND d.codigo = n.code)
    )
  ORDER BY d.created_at ASC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION fn_tasks_is_director_in_direction(p_direccion_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM socios_direcciones sd
    WHERE sd.socio_id = fn_tasks_current_socio_id()
      AND sd.direccion_id = p_direccion_id
      AND sd.activo = true
      AND sd.es_director = true
      AND (sd.fecha_hasta IS NULL OR sd.fecha_hasta >= CURRENT_DATE)
  );
$$;

CREATE OR REPLACE FUNCTION fn_tasks_is_project_director(p_proyecto_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_socio_id UUID := fn_tasks_current_socio_id();
BEGIN
  IF p_proyecto_id IS NULL OR v_socio_id IS NULL THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM proyectos_tareas p
    WHERE p.id = p_proyecto_id
      AND p.responsable_socio_id = v_socio_id
  ) THEN
    RETURN true;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM proyectos_tareas p
    JOIN socios_direcciones sd
      ON sd.direccion_id = p.direccion_id
     AND sd.socio_id = v_socio_id
     AND sd.activo = true
     AND sd.es_director = true
     AND (sd.fecha_hasta IS NULL OR sd.fecha_hasta >= CURRENT_DATE)
    WHERE p.id = p_proyecto_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION fn_tasks_is_task_assignee(p_tarea_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM tareas t
    WHERE t.id = p_tarea_id
      AND t.asignado_socio_id = fn_tasks_current_socio_id()
  );
$$;

CREATE OR REPLACE FUNCTION fn_tasks_can_manage_project(p_proyecto_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT fn_tasks_is_cd_or_admin() OR fn_tasks_is_project_director(p_proyecto_id);
$$;

CREATE OR REPLACE FUNCTION fn_tasks_can_manage_task(p_tarea_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_proyecto_id UUID;
BEGIN
  IF p_tarea_id IS NULL THEN
    RETURN false;
  END IF;

  IF fn_tasks_is_cd_or_admin() THEN
    RETURN true;
  END IF;

  SELECT t.proyecto_id
  INTO v_proyecto_id
  FROM tareas t
  WHERE t.id = p_tarea_id;

  IF v_proyecto_id IS NULL THEN
    RETURN false;
  END IF;

  RETURN fn_tasks_is_project_director(v_proyecto_id);
END;
$$;

CREATE OR REPLACE FUNCTION fn_tasks_can_edit_task(p_tarea_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT fn_tasks_can_manage_task(p_tarea_id) OR fn_tasks_is_task_assignee(p_tarea_id);
$$;

CREATE OR REPLACE FUNCTION fn_tasks_is_subtask_assignee(p_subtarea_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM subtareas st
    WHERE st.id = p_subtarea_id
      AND st.asignado_socio_id = fn_tasks_current_socio_id()
  );
$$;

CREATE OR REPLACE FUNCTION fn_tasks_can_manage_subtask(p_subtarea_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT fn_tasks_can_manage_task(st.tarea_id)
    FROM subtareas st
    WHERE st.id = p_subtarea_id
  ), false);
$$;

CREATE OR REPLACE FUNCTION fn_tasks_can_edit_subtask(p_subtarea_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT fn_tasks_can_manage_subtask(p_subtarea_id) OR fn_tasks_is_subtask_assignee(p_subtarea_id);
$$;

CREATE OR REPLACE FUNCTION fn_tasks_require_active_socio(
  p_socio_id UUID,
  p_field_name TEXT DEFAULT 'socio_id'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_socio_id IS NULL THEN
    RAISE EXCEPTION '% es obligatorio', p_field_name;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM socios s
    WHERE s.id = p_socio_id
      AND COALESCE(s.estado, 'activo') = 'activo'
  ) THEN
    RAISE EXCEPTION '% no corresponde a un socio activo', p_field_name;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION fn_tasks_usuario_id_from_socio(p_socio_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.usuario_id
  FROM socios s
  WHERE s.id = p_socio_id
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION fn_tasks_notify_user(
  p_usuario_id UUID,
  p_titulo TEXT,
  p_mensaje TEXT,
  p_tipo tipo_notificacion DEFAULT 'info',
  p_link TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_usuario_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO notificaciones (usuario_id, titulo, mensaje, tipo, link)
  VALUES (
    p_usuario_id,
    COALESCE(NULLIF(btrim(p_titulo), ''), 'Notificacion de tareas'),
    COALESCE(NULLIF(btrim(p_mensaje), ''), 'Hay una novedad en el modulo de tareas.'),
    COALESCE(p_tipo, 'info'),
    p_link
  );
END;
$$;

CREATE OR REPLACE FUNCTION fn_tasks_notify_socio(
  p_socio_id UUID,
  p_titulo TEXT,
  p_mensaje TEXT,
  p_tipo tipo_notificacion DEFAULT 'info',
  p_link TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usuario_id UUID;
BEGIN
  v_usuario_id := fn_tasks_usuario_id_from_socio(p_socio_id);

  PERFORM fn_tasks_notify_user(
    p_usuario_id => v_usuario_id,
    p_titulo => p_titulo,
    p_mensaje => p_mensaje,
    p_tipo => p_tipo,
    p_link => p_link
  );
END;
$$;

CREATE OR REPLACE FUNCTION fn_tasks_notify_cd_admin(
  p_titulo TEXT,
  p_mensaje TEXT,
  p_link TEXT DEFAULT NULL,
  p_exclude_user_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO notificaciones (usuario_id, titulo, mensaje, tipo, link)
  SELECT DISTINCT
    s.usuario_id,
    COALESCE(NULLIF(btrim(p_titulo), ''), 'Notificacion de tareas'),
    COALESCE(NULLIF(btrim(p_mensaje), ''), 'Hay una novedad en el modulo de tareas.'),
    'info'::tipo_notificacion,
    p_link
  FROM socios s
  WHERE s.usuario_id IS NOT NULL
    AND COALESCE(s.estado, 'activo') = 'activo'
    AND s.rol IN ('comision_directiva', 'admin')
    AND (p_exclude_user_id IS NULL OR s.usuario_id <> p_exclude_user_id);
END;
$$;

CREATE OR REPLACE FUNCTION fn_tasks_notify_task_stakeholders(
  p_tarea_id UUID,
  p_titulo TEXT,
  p_mensaje TEXT,
  p_tipo tipo_notificacion DEFAULT 'info',
  p_link TEXT DEFAULT NULL,
  p_exclude_user_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO notificaciones (usuario_id, titulo, mensaje, tipo, link)
  SELECT DISTINCT
    s.usuario_id,
    COALESCE(NULLIF(btrim(p_titulo), ''), 'Notificacion de tareas'),
    COALESCE(NULLIF(btrim(p_mensaje), ''), 'Hay una novedad en el modulo de tareas.'),
    COALESCE(p_tipo, 'info'),
    p_link
  FROM (
    SELECT t.asignado_socio_id AS socio_id
    FROM tareas t
    WHERE t.id = p_tarea_id

    UNION

    SELECT t.creado_por_socio_id AS socio_id
    FROM tareas t
    WHERE t.id = p_tarea_id

    UNION

    SELECT p.responsable_socio_id AS socio_id
    FROM tareas t
    JOIN proyectos_tareas p ON p.id = t.proyecto_id
    WHERE t.id = p_tarea_id
  ) targets
  JOIN socios s
    ON s.id = targets.socio_id
  WHERE targets.socio_id IS NOT NULL
    AND s.usuario_id IS NOT NULL
    AND COALESCE(s.estado, 'activo') = 'activo'
    AND (p_exclude_user_id IS NULL OR s.usuario_id <> p_exclude_user_id);
END;
$$;

CREATE OR REPLACE FUNCTION fn_tasks_append_historial(
  p_accion TEXT,
  p_proyecto_id UUID DEFAULT NULL,
  p_tarea_id UUID DEFAULT NULL,
  p_subtarea_id UUID DEFAULT NULL,
  p_estado_anterior estado_tarea DEFAULT NULL,
  p_estado_nuevo estado_tarea DEFAULT NULL,
  p_payload JSONB DEFAULT '{}'::JSONB,
  p_actor_socio_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_socio_id UUID := COALESCE(p_actor_socio_id, fn_tasks_current_socio_id());
BEGIN
  INSERT INTO tareas_historial (
    proyecto_id,
    tarea_id,
    subtarea_id,
    actor_socio_id,
    accion,
    estado_anterior,
    estado_nuevo,
    payload,
    created_at
  )
  VALUES (
    p_proyecto_id,
    p_tarea_id,
    p_subtarea_id,
    v_actor_socio_id,
    COALESCE(NULLIF(btrim(p_accion), ''), 'accion_no_especificada'),
    p_estado_anterior,
    p_estado_nuevo,
    COALESCE(p_payload, '{}'::JSONB),
    now()
  );
END;
$$;

-- ------------------------------------------------------------
-- 2) RPC obligatorias del modulo
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION rpc_tasks_create_project(p_payload JSONB)
RETURNS proyectos_tareas
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_socio_id UUID := fn_tasks_current_socio_id();
  v_nombre TEXT := btrim(COALESCE(p_payload ->> 'nombre', ''));
  v_descripcion TEXT := NULLIF(btrim(COALESCE(p_payload ->> 'descripcion', '')), '');
  v_tipo tipo_proyecto_tarea := COALESCE(NULLIF(btrim(COALESCE(p_payload ->> 'tipo', '')), ''), 'interno_direccion')::tipo_proyecto_tarea;
  v_direccion_ref TEXT := COALESCE(
    NULLIF(btrim(COALESCE(p_payload ->> 'direccion_codigo', '')), ''),
    NULLIF(btrim(COALESCE(p_payload ->> 'direccion', '')), '')
  );
  v_direccion_id UUID := fn_tasks_resolve_direccion_id(v_direccion_ref);
  v_responsable_socio_id UUID := NULLIF(btrim(COALESCE(p_payload ->> 'responsable_socio_id', '')), '')::UUID;
  v_fecha_inicio DATE := NULLIF(btrim(COALESCE(p_payload ->> 'fecha_inicio', '')), '')::DATE;
  v_fecha_fin_estimada DATE := NULLIF(btrim(COALESCE(p_payload ->> 'fecha_fin_estimada', '')), '')::DATE;
  v_result proyectos_tareas;
BEGIN
  IF auth.uid() IS NULL OR v_actor_socio_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

  IF v_nombre = '' THEN
    RAISE EXCEPTION 'nombre es obligatorio';
  END IF;

  IF v_direccion_id IS NULL THEN
    RAISE EXCEPTION 'direccion invalida. Valores permitidos: CEA, Finanzas, Recursos Humanos, Comunicacion';
  END IF;

  IF NOT fn_tasks_is_cd_or_admin() AND NOT fn_tasks_is_director_in_direction(v_direccion_id) THEN
    RAISE EXCEPTION 'No autorizado para crear proyectos en la direccion indicada';
  END IF;

  IF v_responsable_socio_id IS NOT NULL THEN
    PERFORM fn_tasks_require_active_socio(v_responsable_socio_id, 'responsable_socio_id');
  END IF;

  INSERT INTO proyectos_tareas (
    nombre,
    descripcion,
    tipo,
    direccion_id,
    creado_por_socio_id,
    responsable_socio_id,
    fecha_inicio,
    fecha_fin_estimada,
    activo,
    created_at,
    updated_at
  )
  VALUES (
    v_nombre,
    v_descripcion,
    v_tipo,
    v_direccion_id,
    v_actor_socio_id,
    v_responsable_socio_id,
    v_fecha_inicio,
    v_fecha_fin_estimada,
    true,
    now(),
    now()
  )
  RETURNING * INTO v_result;

  PERFORM fn_tasks_append_historial(
    p_accion => 'crear_proyecto',
    p_proyecto_id => v_result.id,
    p_payload => jsonb_build_object(
      'nombre', v_result.nombre,
      'tipo', v_result.tipo,
      'direccion_id', v_result.direccion_id,
      'responsable_socio_id', v_result.responsable_socio_id
    ),
    p_actor_socio_id => v_actor_socio_id
  );

  IF v_result.responsable_socio_id IS NOT NULL AND v_result.responsable_socio_id <> v_actor_socio_id THEN
    PERFORM fn_tasks_notify_socio(
      p_socio_id => v_result.responsable_socio_id,
      p_titulo => 'Nuevo proyecto asignado',
      p_mensaje => format('Se te asigno la responsabilidad del proyecto "%s".', v_result.nombre),
      p_tipo => 'info',
      p_link => format('/tareas?project=%s', v_result.id)
    );
  END IF;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION rpc_tasks_update_project(
  p_proyecto_id UUID,
  p_payload JSONB
)
RETURNS proyectos_tareas
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_socio_id UUID := fn_tasks_current_socio_id();
  v_actual proyectos_tareas%ROWTYPE;
  v_result proyectos_tareas;
  v_nombre TEXT;
  v_descripcion TEXT;
  v_tipo tipo_proyecto_tarea;
  v_direccion_id UUID;
  v_responsable_socio_id UUID;
  v_fecha_inicio DATE;
  v_fecha_fin_estimada DATE;
  v_activo BOOLEAN;
BEGIN
  IF auth.uid() IS NULL OR v_actor_socio_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

  SELECT *
  INTO v_actual
  FROM proyectos_tareas p
  WHERE p.id = p_proyecto_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Proyecto no encontrado';
  END IF;

  IF NOT fn_tasks_can_manage_project(p_proyecto_id) THEN
    RAISE EXCEPTION 'No autorizado para actualizar este proyecto';
  END IF;

  IF p_payload ? 'nombre' THEN
    v_nombre := btrim(COALESCE(p_payload ->> 'nombre', ''));
    IF v_nombre = '' THEN
      RAISE EXCEPTION 'nombre no puede quedar vacio';
    END IF;
  ELSE
    v_nombre := v_actual.nombre;
  END IF;

  v_descripcion := CASE
    WHEN p_payload ? 'descripcion' THEN NULLIF(btrim(COALESCE(p_payload ->> 'descripcion', '')), '')
    ELSE v_actual.descripcion
  END;

  v_tipo := CASE
    WHEN p_payload ? 'tipo' THEN NULLIF(btrim(COALESCE(p_payload ->> 'tipo', '')), '')::tipo_proyecto_tarea
    ELSE v_actual.tipo
  END;

  IF p_payload ? 'direccion' OR p_payload ? 'direccion_codigo' THEN
    v_direccion_id := fn_tasks_resolve_direccion_id(
      COALESCE(
        NULLIF(btrim(COALESCE(p_payload ->> 'direccion_codigo', '')), ''),
        NULLIF(btrim(COALESCE(p_payload ->> 'direccion', '')), '')
      )
    );

    IF v_direccion_id IS NULL THEN
      RAISE EXCEPTION 'direccion invalida. Valores permitidos: CEA, Finanzas, Recursos Humanos, Comunicacion';
    END IF;

    IF NOT fn_tasks_is_cd_or_admin() AND NOT fn_tasks_is_director_in_direction(v_direccion_id) THEN
      RAISE EXCEPTION 'No autorizado para mover el proyecto a la direccion indicada';
    END IF;
  ELSE
    v_direccion_id := v_actual.direccion_id;
  END IF;

  IF p_payload ? 'responsable_socio_id' THEN
    v_responsable_socio_id := NULLIF(btrim(COALESCE(p_payload ->> 'responsable_socio_id', '')), '')::UUID;
    IF v_responsable_socio_id IS NOT NULL THEN
      PERFORM fn_tasks_require_active_socio(v_responsable_socio_id, 'responsable_socio_id');
    END IF;
  ELSE
    v_responsable_socio_id := v_actual.responsable_socio_id;
  END IF;

  v_fecha_inicio := CASE
    WHEN p_payload ? 'fecha_inicio' THEN NULLIF(btrim(COALESCE(p_payload ->> 'fecha_inicio', '')), '')::DATE
    ELSE v_actual.fecha_inicio
  END;

  v_fecha_fin_estimada := CASE
    WHEN p_payload ? 'fecha_fin_estimada' THEN NULLIF(btrim(COALESCE(p_payload ->> 'fecha_fin_estimada', '')), '')::DATE
    ELSE v_actual.fecha_fin_estimada
  END;

  v_activo := CASE
    WHEN p_payload ? 'activo' THEN COALESCE((p_payload ->> 'activo')::BOOLEAN, v_actual.activo)
    ELSE v_actual.activo
  END;

  UPDATE proyectos_tareas
  SET
    nombre = v_nombre,
    descripcion = v_descripcion,
    tipo = v_tipo,
    direccion_id = v_direccion_id,
    responsable_socio_id = v_responsable_socio_id,
    fecha_inicio = v_fecha_inicio,
    fecha_fin_estimada = v_fecha_fin_estimada,
    activo = v_activo,
    updated_at = now()
  WHERE id = p_proyecto_id
  RETURNING * INTO v_result;

  PERFORM fn_tasks_append_historial(
    p_accion => 'actualizar_proyecto',
    p_proyecto_id => v_result.id,
    p_payload => jsonb_build_object(
      'antes', jsonb_build_object(
        'nombre', v_actual.nombre,
        'tipo', v_actual.tipo,
        'direccion_id', v_actual.direccion_id,
        'responsable_socio_id', v_actual.responsable_socio_id,
        'activo', v_actual.activo
      ),
      'despues', jsonb_build_object(
        'nombre', v_result.nombre,
        'tipo', v_result.tipo,
        'direccion_id', v_result.direccion_id,
        'responsable_socio_id', v_result.responsable_socio_id,
        'activo', v_result.activo
      )
    ),
    p_actor_socio_id => v_actor_socio_id
  );

  IF v_actual.responsable_socio_id IS DISTINCT FROM v_result.responsable_socio_id
     AND v_result.responsable_socio_id IS NOT NULL
     AND v_result.responsable_socio_id <> v_actor_socio_id THEN
    PERFORM fn_tasks_notify_socio(
      p_socio_id => v_result.responsable_socio_id,
      p_titulo => 'Responsabilidad de proyecto actualizada',
      p_mensaje => format('Ahora sos responsable del proyecto "%s".', v_result.nombre),
      p_tipo => 'info',
      p_link => format('/tareas?project=%s', v_result.id)
    );
  END IF;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION rpc_tasks_create_task(p_payload JSONB)
RETURNS tareas
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_socio_id UUID := fn_tasks_current_socio_id();
  v_proyecto_id UUID := NULLIF(btrim(COALESCE(p_payload ->> 'proyecto_id', '')), '')::UUID;
  v_titulo TEXT := btrim(COALESCE(p_payload ->> 'titulo', ''));
  v_descripcion TEXT := NULLIF(btrim(COALESCE(p_payload ->> 'descripcion', '')), '');
  v_estado estado_tarea := COALESCE(NULLIF(btrim(COALESCE(p_payload ->> 'estado', '')), ''), 'backlog')::estado_tarea;
  v_prioridad SMALLINT := COALESCE(NULLIF(btrim(COALESCE(p_payload ->> 'prioridad', '')), '')::SMALLINT, 3);
  v_orden_en_columna INTEGER := COALESCE(NULLIF(btrim(COALESCE(p_payload ->> 'orden_en_columna', '')), '')::INTEGER, 0);
  v_asignado_socio_id UUID := NULLIF(btrim(COALESCE(p_payload ->> 'asignado_socio_id', '')), '')::UUID;
  v_fecha_vencimiento DATE := NULLIF(btrim(COALESCE(p_payload ->> 'fecha_vencimiento', '')), '')::DATE;
  v_result tareas;
BEGIN
  IF auth.uid() IS NULL OR v_actor_socio_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

  IF v_proyecto_id IS NULL THEN
    RAISE EXCEPTION 'proyecto_id es obligatorio';
  END IF;

  IF v_titulo = '' THEN
    RAISE EXCEPTION 'titulo es obligatorio';
  END IF;

  IF NOT fn_tasks_can_manage_project(v_proyecto_id) THEN
    RAISE EXCEPTION 'No autorizado para crear tareas en este proyecto';
  END IF;

  IF v_asignado_socio_id IS NOT NULL THEN
    PERFORM fn_tasks_require_active_socio(v_asignado_socio_id, 'asignado_socio_id');
  END IF;

  INSERT INTO tareas (
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
    created_at,
    updated_at
  )
  VALUES (
    v_proyecto_id,
    v_titulo,
    v_descripcion,
    v_estado,
    v_prioridad,
    v_orden_en_columna,
    v_asignado_socio_id,
    v_actor_socio_id,
    v_actor_socio_id,
    v_fecha_vencimiento,
    now(),
    now()
  )
  RETURNING * INTO v_result;

  PERFORM fn_tasks_append_historial(
    p_accion => 'crear_tarea',
    p_proyecto_id => v_result.proyecto_id,
    p_tarea_id => v_result.id,
    p_estado_anterior => NULL,
    p_estado_nuevo => v_result.estado,
    p_payload => jsonb_build_object(
      'titulo', v_result.titulo,
      'prioridad', v_result.prioridad,
      'asignado_socio_id', v_result.asignado_socio_id
    ),
    p_actor_socio_id => v_actor_socio_id
  );

  IF v_result.asignado_socio_id IS NOT NULL THEN
    PERFORM fn_tasks_notify_socio(
      p_socio_id => v_result.asignado_socio_id,
      p_titulo => 'Nueva tarea asignada',
      p_mensaje => format('Se te asigno la tarea "%s".', v_result.titulo),
      p_tipo => 'info',
      p_link => format('/tareas?task=%s', v_result.id)
    );
  END IF;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION rpc_tasks_update_task_editable(
  p_tarea_id UUID,
  p_payload JSONB
)
RETURNS tareas
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_socio_id UUID := fn_tasks_current_socio_id();
  v_actual tareas%ROWTYPE;
  v_result tareas;
  v_can_manage BOOLEAN;
  v_can_edit BOOLEAN;
  v_new_titulo TEXT;
  v_new_descripcion TEXT;
  v_new_estado estado_tarea;
  v_new_prioridad SMALLINT;
  v_new_orden INTEGER;
  v_new_fecha_vencimiento DATE;
  v_new_fecha_inicio_real TIMESTAMPTZ;
  v_new_fecha_cierre TIMESTAMPTZ;
BEGIN
  IF auth.uid() IS NULL OR v_actor_socio_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

  SELECT *
  INTO v_actual
  FROM tareas t
  WHERE t.id = p_tarea_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tarea no encontrada';
  END IF;

  v_can_manage := fn_tasks_can_manage_task(p_tarea_id);
  v_can_edit := v_can_manage OR fn_tasks_is_task_assignee(p_tarea_id);

  IF NOT v_can_edit THEN
    RAISE EXCEPTION 'No autorizado para editar esta tarea';
  END IF;

  IF p_payload ? 'asignado_socio_id' THEN
    RAISE EXCEPTION 'La asignacion/reasignacion debe hacerse via rpc_tasks_assign_task';
  END IF;

  IF NOT v_can_manage AND (
      p_payload ? 'titulo'
      OR p_payload ? 'prioridad'
      OR p_payload ? 'proyecto_id'
      OR p_payload ? 'creado_por_socio_id'
    ) THEN
    RAISE EXCEPTION 'La persona asignada solo puede editar campos operativos de su tarea';
  END IF;

  IF p_payload ? 'titulo' THEN
    v_new_titulo := btrim(COALESCE(p_payload ->> 'titulo', ''));
    IF v_new_titulo = '' THEN
      RAISE EXCEPTION 'titulo no puede quedar vacio';
    END IF;
  ELSE
    v_new_titulo := v_actual.titulo;
  END IF;

  v_new_descripcion := CASE
    WHEN p_payload ? 'descripcion' THEN NULLIF(btrim(COALESCE(p_payload ->> 'descripcion', '')), '')
    ELSE v_actual.descripcion
  END;

  v_new_estado := CASE
    WHEN p_payload ? 'estado' THEN NULLIF(btrim(COALESCE(p_payload ->> 'estado', '')), '')::estado_tarea
    ELSE v_actual.estado
  END;

  v_new_prioridad := CASE
    WHEN p_payload ? 'prioridad' AND v_can_manage THEN NULLIF(btrim(COALESCE(p_payload ->> 'prioridad', '')), '')::SMALLINT
    ELSE v_actual.prioridad
  END;

  v_new_orden := CASE
    WHEN p_payload ? 'orden_en_columna' THEN NULLIF(btrim(COALESCE(p_payload ->> 'orden_en_columna', '')), '')::INTEGER
    ELSE v_actual.orden_en_columna
  END;

  v_new_fecha_vencimiento := CASE
    WHEN p_payload ? 'fecha_vencimiento' THEN NULLIF(btrim(COALESCE(p_payload ->> 'fecha_vencimiento', '')), '')::DATE
    ELSE v_actual.fecha_vencimiento
  END;

  v_new_fecha_inicio_real := v_actual.fecha_inicio_real;
  v_new_fecha_cierre := v_actual.fecha_cierre;

  IF v_new_estado = 'en_progreso' AND v_actual.fecha_inicio_real IS NULL THEN
    v_new_fecha_inicio_real := now();
  END IF;

  IF v_new_estado = 'cerrada' THEN
    v_new_fecha_cierre := now();
  ELSIF v_actual.estado = 'cerrada' AND v_new_estado <> 'cerrada' THEN
    v_new_fecha_cierre := NULL;
  END IF;

  UPDATE tareas
  SET
    titulo = CASE WHEN v_can_manage THEN v_new_titulo ELSE tareas.titulo END,
    descripcion = v_new_descripcion,
    estado = v_new_estado,
    prioridad = CASE WHEN v_can_manage THEN v_new_prioridad ELSE tareas.prioridad END,
    orden_en_columna = v_new_orden,
    fecha_vencimiento = v_new_fecha_vencimiento,
    fecha_inicio_real = v_new_fecha_inicio_real,
    fecha_cierre = v_new_fecha_cierre,
    updated_by_socio_id = v_actor_socio_id,
    updated_at = now()
  WHERE id = p_tarea_id
  RETURNING * INTO v_result;

  PERFORM fn_tasks_append_historial(
    p_accion => 'editar_tarea',
    p_proyecto_id => v_result.proyecto_id,
    p_tarea_id => v_result.id,
    p_estado_anterior => v_actual.estado,
    p_estado_nuevo => v_result.estado,
    p_payload => jsonb_build_object(
      'antes', jsonb_build_object(
        'titulo', v_actual.titulo,
        'descripcion', v_actual.descripcion,
        'estado', v_actual.estado,
        'prioridad', v_actual.prioridad,
        'orden_en_columna', v_actual.orden_en_columna,
        'fecha_vencimiento', v_actual.fecha_vencimiento
      ),
      'despues', jsonb_build_object(
        'titulo', v_result.titulo,
        'descripcion', v_result.descripcion,
        'estado', v_result.estado,
        'prioridad', v_result.prioridad,
        'orden_en_columna', v_result.orden_en_columna,
        'fecha_vencimiento', v_result.fecha_vencimiento
      )
    ),
    p_actor_socio_id => v_actor_socio_id
  );

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION rpc_tasks_assign_task(
  p_tarea_id UUID,
  p_asignado_socio_id UUID,
  p_motivo TEXT DEFAULT NULL
)
RETURNS tareas
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_socio_id UUID := fn_tasks_current_socio_id();
  v_actual tareas%ROWTYPE;
  v_result tareas;
  v_motivo TEXT := NULLIF(btrim(COALESCE(p_motivo, '')), '');
BEGIN
  IF auth.uid() IS NULL OR v_actor_socio_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

  PERFORM fn_tasks_require_active_socio(p_asignado_socio_id, 'p_asignado_socio_id');

  SELECT *
  INTO v_actual
  FROM tareas t
  WHERE t.id = p_tarea_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tarea no encontrada';
  END IF;

  IF NOT fn_tasks_can_manage_task(p_tarea_id) THEN
    RAISE EXCEPTION 'No autorizado para asignar/reasignar esta tarea';
  END IF;

  IF v_actual.asignado_socio_id = p_asignado_socio_id THEN
    RETURN v_actual;
  END IF;

  UPDATE tareas
  SET
    asignado_socio_id = p_asignado_socio_id,
    updated_by_socio_id = v_actor_socio_id,
    updated_at = now()
  WHERE id = p_tarea_id
  RETURNING * INTO v_result;

  INSERT INTO tareas_handoffs (
    tarea_id,
    de_socio_id,
    a_socio_id,
    solicitado_por_socio_id,
    resuelto_por_socio_id,
    estado,
    motivo,
    comentario_resolucion,
    metadata,
    resuelto_at,
    created_at,
    updated_at
  )
  VALUES (
    v_result.id,
    v_actual.asignado_socio_id,
    p_asignado_socio_id,
    v_actor_socio_id,
    v_actor_socio_id,
    'aceptado',
    v_motivo,
    'Asignacion directa',
    jsonb_build_object('tipo', 'asignacion_directa'),
    now(),
    now(),
    now()
  );

  PERFORM fn_tasks_append_historial(
    p_accion => 'asignar_tarea',
    p_proyecto_id => v_result.proyecto_id,
    p_tarea_id => v_result.id,
    p_estado_anterior => v_actual.estado,
    p_estado_nuevo => v_result.estado,
    p_payload => jsonb_build_object(
      'desde_socio_id', v_actual.asignado_socio_id,
      'hacia_socio_id', p_asignado_socio_id,
      'motivo', v_motivo
    ),
    p_actor_socio_id => v_actor_socio_id
  );

  PERFORM fn_tasks_notify_socio(
    p_socio_id => p_asignado_socio_id,
    p_titulo => 'Tarea asignada',
    p_mensaje => format('Se te asigno la tarea "%s".', v_result.titulo),
    p_tipo => 'info',
    p_link => format('/tareas?task=%s', v_result.id)
  );

  IF v_actual.asignado_socio_id IS NOT NULL
     AND v_actual.asignado_socio_id <> p_asignado_socio_id THEN
    PERFORM fn_tasks_notify_socio(
      p_socio_id => v_actual.asignado_socio_id,
      p_titulo => 'Tarea reasignada',
      p_mensaje => format('La tarea "%s" fue reasignada a otra persona.', v_result.titulo),
      p_tipo => 'alerta',
      p_link => format('/tareas?task=%s', v_result.id)
    );
  END IF;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION rpc_tasks_create_subtask(p_payload JSONB)
RETURNS subtareas
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_socio_id UUID := fn_tasks_current_socio_id();
  v_tarea_id UUID := NULLIF(btrim(COALESCE(p_payload ->> 'tarea_id', '')), '')::UUID;
  v_titulo TEXT := btrim(COALESCE(p_payload ->> 'titulo', ''));
  v_descripcion TEXT := NULLIF(btrim(COALESCE(p_payload ->> 'descripcion', '')), '');
  v_estado estado_tarea := COALESCE(NULLIF(btrim(COALESCE(p_payload ->> 'estado', '')), ''), 'backlog')::estado_tarea;
  v_orden_en_columna INTEGER := COALESCE(NULLIF(btrim(COALESCE(p_payload ->> 'orden_en_columna', '')), '')::INTEGER, 0);
  v_asignado_socio_id UUID := NULLIF(btrim(COALESCE(p_payload ->> 'asignado_socio_id', '')), '')::UUID;
  v_fecha_vencimiento DATE := NULLIF(btrim(COALESCE(p_payload ->> 'fecha_vencimiento', '')), '')::DATE;
  v_result subtareas;
  v_proyecto_id UUID;
BEGIN
  IF auth.uid() IS NULL OR v_actor_socio_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

  IF v_tarea_id IS NULL THEN
    RAISE EXCEPTION 'tarea_id es obligatorio';
  END IF;

  IF v_titulo = '' THEN
    RAISE EXCEPTION 'titulo es obligatorio';
  END IF;

  IF NOT fn_tasks_can_manage_task(v_tarea_id) THEN
    RAISE EXCEPTION 'No autorizado para crear subtareas en esta tarea';
  END IF;

  IF v_asignado_socio_id IS NOT NULL THEN
    PERFORM fn_tasks_require_active_socio(v_asignado_socio_id, 'asignado_socio_id');
  END IF;

  INSERT INTO subtareas (
    tarea_id,
    titulo,
    descripcion,
    estado,
    orden_en_columna,
    asignado_socio_id,
    creado_por_socio_id,
    updated_by_socio_id,
    fecha_vencimiento,
    created_at,
    updated_at
  )
  VALUES (
    v_tarea_id,
    v_titulo,
    v_descripcion,
    v_estado,
    v_orden_en_columna,
    v_asignado_socio_id,
    v_actor_socio_id,
    v_actor_socio_id,
    v_fecha_vencimiento,
    now(),
    now()
  )
  RETURNING * INTO v_result;

  SELECT t.proyecto_id
  INTO v_proyecto_id
  FROM tareas t
  WHERE t.id = v_tarea_id;

  PERFORM fn_tasks_append_historial(
    p_accion => 'crear_subtarea',
    p_proyecto_id => v_proyecto_id,
    p_tarea_id => v_tarea_id,
    p_subtarea_id => v_result.id,
    p_estado_nuevo => v_result.estado,
    p_payload => jsonb_build_object(
      'titulo', v_result.titulo,
      'asignado_socio_id', v_result.asignado_socio_id
    ),
    p_actor_socio_id => v_actor_socio_id
  );

  IF v_result.asignado_socio_id IS NOT NULL THEN
    PERFORM fn_tasks_notify_socio(
      p_socio_id => v_result.asignado_socio_id,
      p_titulo => 'Nueva subtarea asignada',
      p_mensaje => format('Se te asigno la subtarea "%s".', v_result.titulo),
      p_tipo => 'info',
      p_link => format('/tareas?task=%s', v_result.tarea_id)
    );
  END IF;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION rpc_tasks_update_subtask_editable(
  p_subtarea_id UUID,
  p_payload JSONB
)
RETURNS subtareas
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_socio_id UUID := fn_tasks_current_socio_id();
  v_actual subtareas%ROWTYPE;
  v_result subtareas;
  v_can_manage BOOLEAN;
  v_can_edit BOOLEAN;
  v_new_titulo TEXT;
  v_new_descripcion TEXT;
  v_new_estado estado_tarea;
  v_new_orden INTEGER;
  v_new_asignado_socio_id UUID;
  v_new_fecha_vencimiento DATE;
  v_proyecto_id UUID;
BEGIN
  IF auth.uid() IS NULL OR v_actor_socio_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

  SELECT *
  INTO v_actual
  FROM subtareas st
  WHERE st.id = p_subtarea_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Subtarea no encontrada';
  END IF;

  v_can_manage := fn_tasks_can_manage_subtask(p_subtarea_id);
  v_can_edit := v_can_manage OR fn_tasks_is_subtask_assignee(p_subtarea_id);

  IF NOT v_can_edit THEN
    RAISE EXCEPTION 'No autorizado para editar esta subtarea';
  END IF;

  IF NOT v_can_manage AND (
      p_payload ? 'titulo'
      OR p_payload ? 'asignado_socio_id'
      OR p_payload ? 'tarea_id'
    ) THEN
    RAISE EXCEPTION 'La persona asignada solo puede editar campos operativos de su subtarea';
  END IF;

  IF p_payload ? 'titulo' THEN
    v_new_titulo := btrim(COALESCE(p_payload ->> 'titulo', ''));
    IF v_new_titulo = '' THEN
      RAISE EXCEPTION 'titulo no puede quedar vacio';
    END IF;
  ELSE
    v_new_titulo := v_actual.titulo;
  END IF;

  v_new_descripcion := CASE
    WHEN p_payload ? 'descripcion' THEN NULLIF(btrim(COALESCE(p_payload ->> 'descripcion', '')), '')
    ELSE v_actual.descripcion
  END;

  v_new_estado := CASE
    WHEN p_payload ? 'estado' THEN NULLIF(btrim(COALESCE(p_payload ->> 'estado', '')), '')::estado_tarea
    ELSE v_actual.estado
  END;

  v_new_orden := CASE
    WHEN p_payload ? 'orden_en_columna' THEN NULLIF(btrim(COALESCE(p_payload ->> 'orden_en_columna', '')), '')::INTEGER
    ELSE v_actual.orden_en_columna
  END;

  IF p_payload ? 'asignado_socio_id' THEN
    v_new_asignado_socio_id := NULLIF(btrim(COALESCE(p_payload ->> 'asignado_socio_id', '')), '')::UUID;
    IF v_new_asignado_socio_id IS NOT NULL THEN
      PERFORM fn_tasks_require_active_socio(v_new_asignado_socio_id, 'asignado_socio_id');
    END IF;
  ELSE
    v_new_asignado_socio_id := v_actual.asignado_socio_id;
  END IF;

  v_new_fecha_vencimiento := CASE
    WHEN p_payload ? 'fecha_vencimiento' THEN NULLIF(btrim(COALESCE(p_payload ->> 'fecha_vencimiento', '')), '')::DATE
    ELSE v_actual.fecha_vencimiento
  END;

  UPDATE subtareas
  SET
    titulo = CASE WHEN v_can_manage THEN v_new_titulo ELSE subtareas.titulo END,
    descripcion = v_new_descripcion,
    estado = v_new_estado,
    orden_en_columna = v_new_orden,
    asignado_socio_id = CASE WHEN v_can_manage THEN v_new_asignado_socio_id ELSE subtareas.asignado_socio_id END,
    fecha_vencimiento = v_new_fecha_vencimiento,
    updated_by_socio_id = v_actor_socio_id,
    updated_at = now()
  WHERE id = p_subtarea_id
  RETURNING * INTO v_result;

  SELECT t.proyecto_id
  INTO v_proyecto_id
  FROM tareas t
  WHERE t.id = v_result.tarea_id;

  PERFORM fn_tasks_append_historial(
    p_accion => 'editar_subtarea',
    p_proyecto_id => v_proyecto_id,
    p_tarea_id => v_result.tarea_id,
    p_subtarea_id => v_result.id,
    p_estado_anterior => v_actual.estado,
    p_estado_nuevo => v_result.estado,
    p_payload => jsonb_build_object(
      'antes', jsonb_build_object(
        'titulo', v_actual.titulo,
        'descripcion', v_actual.descripcion,
        'estado', v_actual.estado,
        'orden_en_columna', v_actual.orden_en_columna,
        'asignado_socio_id', v_actual.asignado_socio_id
      ),
      'despues', jsonb_build_object(
        'titulo', v_result.titulo,
        'descripcion', v_result.descripcion,
        'estado', v_result.estado,
        'orden_en_columna', v_result.orden_en_columna,
        'asignado_socio_id', v_result.asignado_socio_id
      )
    ),
    p_actor_socio_id => v_actor_socio_id
  );

  IF v_actual.asignado_socio_id IS DISTINCT FROM v_result.asignado_socio_id
     AND v_result.asignado_socio_id IS NOT NULL THEN
    PERFORM fn_tasks_notify_socio(
      p_socio_id => v_result.asignado_socio_id,
      p_titulo => 'Subtarea asignada',
      p_mensaje => format('Se te asigno la subtarea "%s".', v_result.titulo),
      p_tipo => 'info',
      p_link => format('/tareas?task=%s', v_result.tarea_id)
    );
  END IF;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION rpc_tasks_handoff_task(
  p_tarea_id UUID,
  p_hacia_socio_id UUID,
  p_motivo TEXT DEFAULT NULL
)
RETURNS tareas
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_socio_id UUID := fn_tasks_current_socio_id();
  v_actual tareas%ROWTYPE;
  v_result tareas;
  v_motivo TEXT := NULLIF(btrim(COALESCE(p_motivo, '')), '');
BEGIN
  IF auth.uid() IS NULL OR v_actor_socio_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

  PERFORM fn_tasks_require_active_socio(p_hacia_socio_id, 'p_hacia_socio_id');

  SELECT *
  INTO v_actual
  FROM tareas t
  WHERE t.id = p_tarea_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tarea no encontrada';
  END IF;

  IF NOT fn_tasks_can_manage_task(p_tarea_id) THEN
    RAISE EXCEPTION 'No autorizado para hacer handoff de esta tarea';
  END IF;

  IF v_actual.asignado_socio_id = p_hacia_socio_id THEN
    RAISE EXCEPTION 'La tarea ya esta asignada al socio destino';
  END IF;

  INSERT INTO tareas_handoffs (
    tarea_id,
    de_socio_id,
    a_socio_id,
    solicitado_por_socio_id,
    resuelto_por_socio_id,
    estado,
    motivo,
    comentario_resolucion,
    metadata,
    resuelto_at,
    created_at,
    updated_at
  )
  VALUES (
    p_tarea_id,
    v_actual.asignado_socio_id,
    p_hacia_socio_id,
    v_actor_socio_id,
    v_actor_socio_id,
    'aceptado',
    v_motivo,
    'Handoff directo resuelto por gestion',
    jsonb_build_object('tipo', 'handoff_directo'),
    now(),
    now(),
    now()
  );

  UPDATE tareas
  SET
    asignado_socio_id = p_hacia_socio_id,
    estado = CASE WHEN estado = 'cerrada' THEN estado ELSE 'pendiente_handoff'::estado_tarea END,
    updated_by_socio_id = v_actor_socio_id,
    updated_at = now()
  WHERE id = p_tarea_id
  RETURNING * INTO v_result;

  PERFORM fn_tasks_append_historial(
    p_accion => 'handoff_tarea',
    p_proyecto_id => v_result.proyecto_id,
    p_tarea_id => v_result.id,
    p_estado_anterior => v_actual.estado,
    p_estado_nuevo => v_result.estado,
    p_payload => jsonb_build_object(
      'desde_socio_id', v_actual.asignado_socio_id,
      'hacia_socio_id', p_hacia_socio_id,
      'motivo', v_motivo
    ),
    p_actor_socio_id => v_actor_socio_id
  );

  PERFORM fn_tasks_notify_socio(
    p_socio_id => p_hacia_socio_id,
    p_titulo => 'Recibiste un handoff',
    p_mensaje => format('Se te transfirio la tarea "%s".', v_result.titulo),
    p_tipo => 'info',
    p_link => format('/tareas?task=%s', v_result.id)
  );

  IF v_actual.asignado_socio_id IS NOT NULL THEN
    PERFORM fn_tasks_notify_socio(
      p_socio_id => v_actual.asignado_socio_id,
      p_titulo => 'Handoff completado',
      p_mensaje => format('La tarea "%s" fue transferida a otra persona.', v_result.titulo),
      p_tipo => 'info',
      p_link => format('/tareas?task=%s', v_result.id)
    );
  END IF;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION rpc_tasks_send_to_cd(
  p_tarea_id UUID,
  p_comentario TEXT DEFAULT NULL
)
RETURNS tareas
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_socio_id UUID := fn_tasks_current_socio_id();
  v_tarea tareas%ROWTYPE;
  v_result tareas;
  v_comentario TEXT := NULLIF(btrim(COALESCE(p_comentario, '')), '');
  v_cd_count INTEGER;
BEGIN
  IF auth.uid() IS NULL OR v_actor_socio_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

  SELECT *
  INTO v_tarea
  FROM tareas t
  WHERE t.id = p_tarea_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tarea no encontrada';
  END IF;

  IF NOT fn_tasks_can_manage_task(p_tarea_id) THEN
    RAISE EXCEPTION 'No autorizado para enviar esta tarea a CD';
  END IF;

  IF v_tarea.estado = 'cerrada' THEN
    RAISE EXCEPTION 'No se puede enviar una tarea cerrada a CD';
  END IF;

  SELECT COUNT(*)
  INTO v_cd_count
  FROM socios s
  WHERE COALESCE(s.estado, 'activo') = 'activo'
    AND s.rol IN ('comision_directiva', 'admin');

  IF v_cd_count = 0 THEN
    RAISE EXCEPTION 'No hay integrantes de Comision Directiva/Admin para resolver';
  END IF;

  INSERT INTO tareas_aprobaciones_cd (
    tarea_id,
    socio_id,
    decision,
    observacion,
    metadata,
    aprobado_at,
    created_at,
    updated_at
  )
  SELECT
    p_tarea_id,
    s.id,
    'pendiente',
    NULL,
    jsonb_build_object(
      'comentario_envio', v_comentario,
      'enviado_por_socio_id', v_actor_socio_id,
      'enviado_at', now()
    ),
    NULL,
    now(),
    now()
  FROM socios s
  WHERE COALESCE(s.estado, 'activo') = 'activo'
    AND s.rol IN ('comision_directiva', 'admin')
  ON CONFLICT (tarea_id, socio_id)
  DO UPDATE SET
    decision = 'pendiente',
    observacion = NULL,
    metadata = tareas_aprobaciones_cd.metadata || EXCLUDED.metadata,
    aprobado_at = NULL,
    updated_at = now();

  UPDATE tareas
  SET
    estado = 'pendiente_aprobacion_cd',
    updated_by_socio_id = v_actor_socio_id,
    updated_at = now()
  WHERE id = p_tarea_id
  RETURNING * INTO v_result;

  PERFORM fn_tasks_append_historial(
    p_accion => 'enviar_a_cd',
    p_proyecto_id => v_result.proyecto_id,
    p_tarea_id => v_result.id,
    p_estado_anterior => v_tarea.estado,
    p_estado_nuevo => v_result.estado,
    p_payload => jsonb_build_object(
      'comentario', v_comentario,
      'cantidad_aprobadores', v_cd_count
    ),
    p_actor_socio_id => v_actor_socio_id
  );

  PERFORM fn_tasks_notify_cd_admin(
    p_titulo => 'Nueva tarea para aprobacion CD',
    p_mensaje => format('La tarea "%s" requiere aprobacion de Comision Directiva.', v_tarea.titulo),
    p_link => format('/tareas?task=%s', v_tarea.id),
    p_exclude_user_id => auth.uid()
  );

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION rpc_tasks_cd_resolve(
  p_aprobacion_id UUID,
  p_aprobar BOOLEAN,
  p_comentario TEXT DEFAULT NULL
)
RETURNS tareas_aprobaciones_cd
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_socio_id UUID := fn_tasks_current_socio_id();
  v_aprobacion tareas_aprobaciones_cd%ROWTYPE;
  v_result tareas_aprobaciones_cd;
  v_tarea tareas%ROWTYPE;
  v_decision TEXT := CASE WHEN COALESCE(p_aprobar, false) THEN 'aprobada' ELSE 'rechazada' END;
  v_comentario TEXT := NULLIF(btrim(COALESCE(p_comentario, '')), '');
  v_pending_count INTEGER;
  v_negative_count INTEGER;
  v_total_count INTEGER;
  v_new_state estado_tarea;
BEGIN
  IF auth.uid() IS NULL OR v_actor_socio_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

  IF NOT fn_tasks_is_cd_or_admin() THEN
    RAISE EXCEPTION 'Solo Comision Directiva/Admin puede resolver aprobaciones';
  END IF;

  SELECT *
  INTO v_aprobacion
  FROM tareas_aprobaciones_cd a
  WHERE a.id = p_aprobacion_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Aprobacion no encontrada';
  END IF;

  IF NOT fn_tasks_is_admin() AND v_aprobacion.socio_id <> v_actor_socio_id THEN
    RAISE EXCEPTION 'Solo la persona aprobadora asignada (o admin) puede resolver esta aprobacion';
  END IF;

  IF v_aprobacion.decision <> 'pendiente' THEN
    RAISE EXCEPTION 'La aprobacion ya fue resuelta anteriormente';
  END IF;

  IF v_decision = 'rechazada' AND v_comentario IS NULL THEN
    RAISE EXCEPTION 'Debes indicar comentario para rechazar';
  END IF;

  UPDATE tareas_aprobaciones_cd
  SET
    decision = v_decision,
    observacion = CASE WHEN v_decision = 'rechazada' THEN v_comentario ELSE NULL END,
    metadata = tareas_aprobaciones_cd.metadata || jsonb_build_object('resuelto_por_socio_id', v_actor_socio_id, 'resuelto_at', now()),
    aprobado_at = now(),
    updated_at = now()
  WHERE id = p_aprobacion_id
  RETURNING * INTO v_result;

  SELECT *
  INTO v_tarea
  FROM tareas t
  WHERE t.id = v_result.tarea_id
  FOR UPDATE;

  SELECT
    COUNT(*) FILTER (WHERE decision = 'pendiente'),
    COUNT(*) FILTER (WHERE decision IN ('rechazada', 'observada')),
    COUNT(*)
  INTO v_pending_count, v_negative_count, v_total_count
  FROM tareas_aprobaciones_cd a
  WHERE a.tarea_id = v_result.tarea_id;

  IF v_negative_count > 0 THEN
    v_new_state := 'observada_cd';
  ELSIF v_pending_count = 0 AND v_total_count > 0 THEN
    v_new_state := 'aprobada_cd';
  ELSE
    v_new_state := 'pendiente_aprobacion_cd';
  END IF;

  UPDATE tareas
  SET
    estado = v_new_state,
    updated_by_socio_id = v_actor_socio_id,
    updated_at = now()
  WHERE id = v_result.tarea_id;

  PERFORM fn_tasks_append_historial(
    p_accion => CASE WHEN v_decision = 'aprobada' THEN 'cd_aprobar' ELSE 'cd_rechazar' END,
    p_proyecto_id => v_tarea.proyecto_id,
    p_tarea_id => v_tarea.id,
    p_estado_anterior => v_tarea.estado,
    p_estado_nuevo => v_new_state,
    p_payload => jsonb_build_object(
      'aprobacion_id', v_result.id,
      'socio_aprobador_id', v_result.socio_id,
      'decision', v_result.decision,
      'observacion', v_result.observacion,
      'pendientes', v_pending_count,
      'negativas', v_negative_count
    ),
    p_actor_socio_id => v_actor_socio_id
  );

  PERFORM fn_tasks_notify_task_stakeholders(
    p_tarea_id => v_tarea.id,
    p_titulo => 'Resolucion de Comision Directiva',
    p_mensaje => format('La tarea "%s" recibio decision: %s. Estado actual: %s.', v_tarea.titulo, v_result.decision, v_new_state),
    p_tipo => CASE WHEN v_new_state = 'aprobada_cd' THEN 'exito' ELSE 'alerta' END,
    p_link => format('/tareas?task=%s', v_tarea.id),
    p_exclude_user_id => auth.uid()
  );

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION rpc_tasks_delete_task(p_tarea_id UUID)
RETURNS tareas
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_socio_id UUID := fn_tasks_current_socio_id();
  v_actual tareas%ROWTYPE;
  v_result tareas;
BEGIN
  IF auth.uid() IS NULL OR v_actor_socio_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

  SELECT *
  INTO v_actual
  FROM tareas t
  WHERE t.id = p_tarea_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tarea no encontrada';
  END IF;

  IF NOT fn_tasks_can_manage_task(p_tarea_id) THEN
    RAISE EXCEPTION 'No autorizado para eliminar/cerrar esta tarea';
  END IF;

  IF v_actual.estado = 'cerrada' THEN
    RETURN v_actual;
  END IF;

  UPDATE tareas
  SET
    estado = 'cerrada',
    fecha_cierre = COALESCE(fecha_cierre, now()),
    updated_by_socio_id = v_actor_socio_id,
    updated_at = now()
  WHERE id = p_tarea_id
  RETURNING * INTO v_result;

  PERFORM fn_tasks_append_historial(
    p_accion => 'cerrar_tarea_gestion',
    p_proyecto_id => v_result.proyecto_id,
    p_tarea_id => v_result.id,
    p_estado_anterior => v_actual.estado,
    p_estado_nuevo => v_result.estado,
    p_payload => jsonb_build_object(
      'motivo', 'cerrada_por_gestion',
      'actor_socio_id', v_actor_socio_id
    ),
    p_actor_socio_id => v_actor_socio_id
  );

  IF v_result.asignado_socio_id IS NOT NULL
     AND v_result.asignado_socio_id <> v_actor_socio_id THEN
    PERFORM fn_tasks_notify_socio(
      p_socio_id => v_result.asignado_socio_id,
      p_titulo => 'Tarea cerrada por gestion',
      p_mensaje => format('La tarea "%s" fue cerrada por la direccion/comision.', v_result.titulo),
      p_tipo => 'info',
      p_link => format('/tareas?task=%s', v_result.id)
    );
  END IF;

  RETURN v_result;
END;
$$;

-- ------------------------------------------------------------
-- 2.1) Wrappers de compatibilidad (rpc_tareas_*)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION rpc_tareas_crear_proyecto(p_payload JSONB)
RETURNS proyectos_tareas
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT rpc_tasks_create_project(p_payload);
$$;

CREATE OR REPLACE FUNCTION rpc_tareas_actualizar_proyecto(p_proyecto_id UUID, p_payload JSONB)
RETURNS proyectos_tareas
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT rpc_tasks_update_project(p_proyecto_id, p_payload);
$$;

CREATE OR REPLACE FUNCTION rpc_tareas_crear_tarea(p_payload JSONB)
RETURNS tareas
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT rpc_tasks_create_task(p_payload);
$$;

CREATE OR REPLACE FUNCTION rpc_tareas_actualizar_tarea_asignada(p_tarea_id UUID, p_payload JSONB)
RETURNS tareas
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT rpc_tasks_update_task_editable(p_tarea_id, p_payload);
$$;

CREATE OR REPLACE FUNCTION rpc_tareas_asignar_tarea(
  p_tarea_id UUID,
  p_socio_id UUID,
  p_motivo TEXT DEFAULT NULL
)
RETURNS tareas
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT rpc_tasks_assign_task(p_tarea_id, p_socio_id, p_motivo);
$$;

CREATE OR REPLACE FUNCTION rpc_tareas_crear_subtarea(p_payload JSONB)
RETURNS subtareas
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT rpc_tasks_create_subtask(p_payload);
$$;

CREATE OR REPLACE FUNCTION rpc_tareas_actualizar_subtarea_asignada(p_subtarea_id UUID, p_payload JSONB)
RETURNS subtareas
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT rpc_tasks_update_subtask_editable(p_subtarea_id, p_payload);
$$;

CREATE OR REPLACE FUNCTION rpc_tareas_handoff_tarea(
  p_tarea_id UUID,
  p_hacia_socio_id UUID,
  p_motivo TEXT DEFAULT NULL
)
RETURNS tareas
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT rpc_tasks_handoff_task(p_tarea_id, p_hacia_socio_id, p_motivo);
$$;

CREATE OR REPLACE FUNCTION rpc_tareas_send_to_cd(
  p_tarea_id UUID,
  p_comentario TEXT DEFAULT NULL
)
RETURNS tareas
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT rpc_tasks_send_to_cd(p_tarea_id, p_comentario);
$$;

CREATE OR REPLACE FUNCTION rpc_tareas_cd_resolve(
  p_aprobacion_id UUID,
  p_aprobar BOOLEAN,
  p_comentario TEXT DEFAULT NULL
)
RETURNS tareas_aprobaciones_cd
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT rpc_tasks_cd_resolve(p_aprobacion_id, p_aprobar, p_comentario);
$$;

CREATE OR REPLACE FUNCTION rpc_tareas_delete_task(p_tarea_id UUID)
RETURNS tareas
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT rpc_tasks_delete_task(p_tarea_id);
$$;

-- ------------------------------------------------------------
-- 3) Grants de ejecucion RPC para authenticated
-- ------------------------------------------------------------

GRANT EXECUTE ON FUNCTION rpc_tasks_create_project(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION rpc_tasks_update_project(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION rpc_tasks_create_task(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION rpc_tasks_update_task_editable(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION rpc_tasks_assign_task(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION rpc_tasks_create_subtask(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION rpc_tasks_update_subtask_editable(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION rpc_tasks_handoff_task(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION rpc_tasks_send_to_cd(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION rpc_tasks_cd_resolve(UUID, BOOLEAN, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION rpc_tasks_delete_task(UUID) TO authenticated;

GRANT EXECUTE ON FUNCTION rpc_tareas_crear_proyecto(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION rpc_tareas_actualizar_proyecto(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION rpc_tareas_crear_tarea(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION rpc_tareas_actualizar_tarea_asignada(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION rpc_tareas_asignar_tarea(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION rpc_tareas_crear_subtarea(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION rpc_tareas_actualizar_subtarea_asignada(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION rpc_tareas_handoff_tarea(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION rpc_tareas_send_to_cd(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION rpc_tareas_cd_resolve(UUID, BOOLEAN, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION rpc_tareas_delete_task(UUID) TO authenticated;

-- ------------------------------------------------------------
-- 4) RLS: SELECT universal + bloqueo de mutaciones directas
-- ------------------------------------------------------------

ALTER TABLE proyectos_tareas ENABLE ROW LEVEL SECURITY;
ALTER TABLE tareas ENABLE ROW LEVEL SECURITY;
ALTER TABLE subtareas ENABLE ROW LEVEL SECURITY;
ALTER TABLE tareas_handoffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE tareas_aprobaciones_cd ENABLE ROW LEVEL SECURITY;
ALTER TABLE tareas_historial ENABLE ROW LEVEL SECURITY;
ALTER TABLE direcciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE socios_direcciones ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  v_policy RECORD;
BEGIN
  FOR v_policy IN
    SELECT p.schemaname, p.tablename, p.policyname
    FROM pg_policies p
    WHERE p.schemaname = 'public'
      AND p.tablename IN (
        'proyectos_tareas',
        'tareas',
        'subtareas',
        'tareas_handoffs',
        'tareas_aprobaciones_cd',
        'tareas_historial',
        'direcciones',
        'socios_direcciones'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', v_policy.policyname, v_policy.schemaname, v_policy.tablename);
  END LOOP;
END;
$$;

-- 4.1 SELECT: visible para cualquier authenticated
CREATE POLICY proyectos_tareas_select ON proyectos_tareas
  FOR SELECT TO authenticated USING (true);

CREATE POLICY tareas_select ON tareas
  FOR SELECT TO authenticated USING (true);

CREATE POLICY subtareas_select ON subtareas
  FOR SELECT TO authenticated USING (true);

CREATE POLICY tareas_handoffs_select ON tareas_handoffs
  FOR SELECT TO authenticated USING (true);

CREATE POLICY tareas_aprobaciones_cd_select ON tareas_aprobaciones_cd
  FOR SELECT TO authenticated USING (true);

CREATE POLICY tareas_historial_select ON tareas_historial
  FOR SELECT TO authenticated USING (true);

CREATE POLICY direcciones_select ON direcciones
  FOR SELECT TO authenticated USING (true);

CREATE POLICY socios_direcciones_select ON socios_direcciones
  FOR SELECT TO authenticated USING (true);

-- 4.2 DML directo bloqueado (obligatorio usar RPC SECURITY DEFINER)
CREATE POLICY proyectos_tareas_insert_block ON proyectos_tareas
  FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY proyectos_tareas_update_block ON proyectos_tareas
  FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY proyectos_tareas_delete_block ON proyectos_tareas
  FOR DELETE TO authenticated USING (false);

CREATE POLICY tareas_insert_block ON tareas
  FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY tareas_update_block ON tareas
  FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY tareas_delete_block ON tareas
  FOR DELETE TO authenticated USING (false);

CREATE POLICY subtareas_insert_block ON subtareas
  FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY subtareas_update_block ON subtareas
  FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY subtareas_delete_block ON subtareas
  FOR DELETE TO authenticated USING (false);

CREATE POLICY tareas_handoffs_insert_block ON tareas_handoffs
  FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY tareas_handoffs_update_block ON tareas_handoffs
  FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY tareas_handoffs_delete_block ON tareas_handoffs
  FOR DELETE TO authenticated USING (false);

CREATE POLICY tareas_aprobaciones_cd_insert_block ON tareas_aprobaciones_cd
  FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY tareas_aprobaciones_cd_update_block ON tareas_aprobaciones_cd
  FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY tareas_aprobaciones_cd_delete_block ON tareas_aprobaciones_cd
  FOR DELETE TO authenticated USING (false);

CREATE POLICY tareas_historial_insert_block ON tareas_historial
  FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY tareas_historial_update_block ON tareas_historial
  FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY tareas_historial_delete_block ON tareas_historial
  FOR DELETE TO authenticated USING (false);

CREATE POLICY direcciones_insert_block ON direcciones
  FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY direcciones_update_block ON direcciones
  FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY direcciones_delete_block ON direcciones
  FOR DELETE TO authenticated USING (false);

CREATE POLICY socios_direcciones_insert_block ON socios_direcciones
  FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY socios_direcciones_update_block ON socios_direcciones
  FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY socios_direcciones_delete_block ON socios_direcciones
  FOR DELETE TO authenticated USING (false);

-- Defensa adicional de privilegios SQL directos
REVOKE INSERT, UPDATE, DELETE ON proyectos_tareas FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON tareas FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON subtareas FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON tareas_handoffs FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON tareas_aprobaciones_cd FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON tareas_historial FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON direcciones FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON socios_direcciones FROM authenticated, anon;

-- ============================================================
-- 030: Institutional parent projects + direction task routing
-- ============================================================

DO $$
BEGIN
  IF to_regclass('public.proyectos_tareas') IS NULL
     OR to_regclass('public.tareas') IS NULL
     OR to_regclass('public.direcciones') IS NULL THEN
    RAISE EXCEPTION 'La migracion 030 requiere esquema de tareas previo (027/028)';
  END IF;
END;
$$;

-- ------------------------------------------------------------
-- 1) Schema: proyecto institucional global + direccion por tarea
-- ------------------------------------------------------------

ALTER TABLE proyectos_tareas
  ALTER COLUMN direccion_id DROP NOT NULL;

ALTER TABLE tareas
  ADD COLUMN IF NOT EXISTS direccion_responsable_id UUID
  REFERENCES direcciones(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tareas_direccion_responsable_id
  ON tareas (direccion_responsable_id);

CREATE INDEX IF NOT EXISTS idx_tareas_direccion_responsable_estado_created
  ON tareas (direccion_responsable_id, estado, created_at DESC);

-- Backfill: preservar direccion operativa de tareas existentes
UPDATE tareas t
SET direccion_responsable_id = p.direccion_id
FROM proyectos_tareas p
WHERE p.id = t.proyecto_id
  AND t.direccion_responsable_id IS NULL
  AND p.direccion_id IS NOT NULL;

-- Institucional = proyecto madre global (sin direccion fija)
UPDATE proyectos_tareas
SET
  direccion_id = NULL,
  updated_at = now()
WHERE tipo = 'institucional'
  AND direccion_id IS NOT NULL;

ALTER TABLE proyectos_tareas
  DROP CONSTRAINT IF EXISTS proyectos_tareas_tipo_direccion_consistency_chk;

ALTER TABLE proyectos_tareas
  ADD CONSTRAINT proyectos_tareas_tipo_direccion_consistency_chk
  CHECK (
    (tipo = 'institucional' AND direccion_id IS NULL)
    OR (tipo = 'interno_direccion' AND direccion_id IS NOT NULL)
  );

-- ------------------------------------------------------------
-- 2) Permisos: gestion de tarea tambien por direccion responsable
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_tasks_can_manage_task(p_tarea_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_proyecto_id UUID;
  v_direccion_responsable_id UUID;
BEGIN
  IF p_tarea_id IS NULL THEN
    RETURN false;
  END IF;

  IF fn_tasks_is_cd_or_admin() THEN
    RETURN true;
  END IF;

  SELECT t.proyecto_id, t.direccion_responsable_id
  INTO v_proyecto_id, v_direccion_responsable_id
  FROM tareas t
  WHERE t.id = p_tarea_id;

  IF v_proyecto_id IS NULL THEN
    RETURN false;
  END IF;

  IF fn_tasks_is_project_director(v_proyecto_id) THEN
    RETURN true;
  END IF;

  IF v_direccion_responsable_id IS NOT NULL
     AND fn_tasks_is_director_in_direction(v_direccion_responsable_id) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- ------------------------------------------------------------
-- 3) RPC: proyectos madre + direccion responsable por tarea
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
  v_direccion_id UUID;
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

  IF v_tipo = 'institucional' THEN
    v_direccion_id := NULL;
    IF NOT fn_tasks_is_cd_or_admin() THEN
      RAISE EXCEPTION 'Solo Comision Directiva/Admin puede crear proyectos institucionales globales';
    END IF;
  ELSE
    v_direccion_id := fn_tasks_resolve_direccion_id(v_direccion_ref);
    IF v_direccion_id IS NULL THEN
      RAISE EXCEPTION 'direccion invalida. Valores permitidos: CEA, Finanzas, Recursos Humanos, Comunicacion';
    END IF;

    IF NOT fn_tasks_is_cd_or_admin() AND NOT fn_tasks_is_director_in_direction(v_direccion_id) THEN
      RAISE EXCEPTION 'No autorizado para crear proyectos en la direccion indicada';
    END IF;
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

  IF v_tipo = 'institucional' THEN
    IF v_actual.tipo <> 'institucional' AND NOT fn_tasks_is_cd_or_admin() THEN
      RAISE EXCEPTION 'Solo Comision Directiva/Admin puede convertir un proyecto en institucional global';
    END IF;
    v_direccion_id := NULL;
  ELSE
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
    ELSE
      v_direccion_id := v_actual.direccion_id;
    END IF;

    IF v_direccion_id IS NULL THEN
      RAISE EXCEPTION 'direccion es obligatoria para proyectos internos de direccion';
    END IF;

    IF NOT fn_tasks_is_cd_or_admin() AND NOT fn_tasks_is_director_in_direction(v_direccion_id) THEN
      RAISE EXCEPTION 'No autorizado para mover el proyecto a la direccion indicada';
    END IF;
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
    fecha_cierre = CASE
      WHEN v_activo THEN NULL
      ELSE COALESCE(fecha_cierre, now())
    END,
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
  v_direccion_responsable_ref TEXT := COALESCE(
    NULLIF(btrim(COALESCE(p_payload ->> 'direccion_responsable_codigo', '')), ''),
    NULLIF(btrim(COALESCE(p_payload ->> 'direccion_responsable', '')), ''),
    NULLIF(btrim(COALESCE(p_payload ->> 'direccion_codigo', '')), ''),
    NULLIF(btrim(COALESCE(p_payload ->> 'direccion', '')), '')
  );
  v_direccion_responsable_id UUID;
  v_project proyectos_tareas%ROWTYPE;
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

  SELECT *
  INTO v_project
  FROM proyectos_tareas p
  WHERE p.id = v_proyecto_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Proyecto no encontrado';
  END IF;

  IF NOT fn_tasks_can_manage_project(v_proyecto_id) THEN
    RAISE EXCEPTION 'No autorizado para crear tareas en este proyecto';
  END IF;

  IF v_asignado_socio_id IS NOT NULL THEN
    PERFORM fn_tasks_require_active_socio(v_asignado_socio_id, 'asignado_socio_id');
  END IF;

  IF v_direccion_responsable_ref IS NOT NULL THEN
    v_direccion_responsable_id := fn_tasks_resolve_direccion_id(v_direccion_responsable_ref);
    IF v_direccion_responsable_id IS NULL THEN
      RAISE EXCEPTION 'direccion_responsable invalida. Valores permitidos: CEA, Finanzas, Recursos Humanos, Comunicacion';
    END IF;
  ELSE
    v_direccion_responsable_id := NULL;
  END IF;

  IF v_direccion_responsable_id IS NULL AND v_project.tipo = 'interno_direccion' THEN
    v_direccion_responsable_id := v_project.direccion_id;
  END IF;

  INSERT INTO tareas (
    proyecto_id,
    titulo,
    descripcion,
    estado,
    prioridad,
    orden_en_columna,
    asignado_socio_id,
    direccion_responsable_id,
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
    v_direccion_responsable_id,
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
      'asignado_socio_id', v_result.asignado_socio_id,
      'direccion_responsable_id', v_result.direccion_responsable_id
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
  v_new_direccion_responsable_id UUID;
  v_direccion_ref TEXT;
  v_project_type tipo_proyecto_tarea;
  v_project_direction_id UUID;
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
      OR p_payload ? 'direccion_responsable'
      OR p_payload ? 'direccion_responsable_codigo'
      OR p_payload ? 'direccion_responsable_id'
    ) THEN
    RAISE EXCEPTION 'La persona asignada solo puede editar campos operativos de su tarea';
  END IF;

  SELECT p.tipo, p.direccion_id
  INTO v_project_type, v_project_direction_id
  FROM proyectos_tareas p
  WHERE p.id = v_actual.proyecto_id;

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

  IF p_payload ? 'estado' THEN
    v_new_estado := NULLIF(btrim(COALESCE(p_payload ->> 'estado', '')), '')::estado_tarea;
  ELSE
    v_new_estado := v_actual.estado;
  END IF;

  v_new_prioridad := CASE
    WHEN p_payload ? 'prioridad' THEN COALESCE(NULLIF(btrim(COALESCE(p_payload ->> 'prioridad', '')), '')::SMALLINT, v_actual.prioridad)
    ELSE v_actual.prioridad
  END;

  v_new_orden := CASE
    WHEN p_payload ? 'orden_en_columna' THEN COALESCE(NULLIF(btrim(COALESCE(p_payload ->> 'orden_en_columna', '')), '')::INTEGER, v_actual.orden_en_columna)
    ELSE v_actual.orden_en_columna
  END;

  v_new_fecha_vencimiento := CASE
    WHEN p_payload ? 'fecha_vencimiento' THEN NULLIF(btrim(COALESCE(p_payload ->> 'fecha_vencimiento', '')), '')::DATE
    ELSE v_actual.fecha_vencimiento
  END;

  v_new_fecha_inicio_real := v_actual.fecha_inicio_real;
  v_new_fecha_cierre := v_actual.fecha_cierre;

  IF p_payload ? 'fecha_inicio_real' AND v_can_manage THEN
    v_new_fecha_inicio_real := NULLIF(btrim(COALESCE(p_payload ->> 'fecha_inicio_real', '')), '')::TIMESTAMPTZ;
  END IF;

  IF p_payload ? 'fecha_cierre' AND v_can_manage THEN
    v_new_fecha_cierre := NULLIF(btrim(COALESCE(p_payload ->> 'fecha_cierre', '')), '')::TIMESTAMPTZ;
  END IF;

  IF v_new_estado = 'en_progreso' AND v_actual.fecha_inicio_real IS NULL THEN
    v_new_fecha_inicio_real := now();
  END IF;

  IF v_new_estado = 'cerrada' THEN
    v_new_fecha_cierre := now();
  ELSIF v_actual.estado = 'cerrada' AND v_new_estado <> 'cerrada' THEN
    v_new_fecha_cierre := NULL;
  END IF;

  v_new_direccion_responsable_id := v_actual.direccion_responsable_id;

  IF p_payload ? 'direccion_responsable_id' THEN
    v_new_direccion_responsable_id := NULLIF(btrim(COALESCE(p_payload ->> 'direccion_responsable_id', '')), '')::UUID;

    IF v_new_direccion_responsable_id IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM direcciones d
         WHERE d.id = v_new_direccion_responsable_id
           AND d.activo = true
       ) THEN
      RAISE EXCEPTION 'direccion_responsable_id invalido';
    END IF;
  ELSIF p_payload ? 'direccion_responsable' OR p_payload ? 'direccion_responsable_codigo' THEN
    v_direccion_ref := COALESCE(
      NULLIF(btrim(COALESCE(p_payload ->> 'direccion_responsable_codigo', '')), ''),
      NULLIF(btrim(COALESCE(p_payload ->> 'direccion_responsable', '')), '')
    );

    IF v_direccion_ref IS NULL THEN
      v_new_direccion_responsable_id := NULL;
    ELSE
      v_new_direccion_responsable_id := fn_tasks_resolve_direccion_id(v_direccion_ref);
      IF v_new_direccion_responsable_id IS NULL THEN
        RAISE EXCEPTION 'direccion_responsable invalida. Valores permitidos: CEA, Finanzas, Recursos Humanos, Comunicacion';
      END IF;
    END IF;
  END IF;

  IF v_project_type = 'interno_direccion' AND v_new_direccion_responsable_id IS NULL THEN
    v_new_direccion_responsable_id := v_project_direction_id;
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
    direccion_responsable_id = CASE
      WHEN v_can_manage THEN v_new_direccion_responsable_id
      ELSE tareas.direccion_responsable_id
    END,
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
        'fecha_vencimiento', v_actual.fecha_vencimiento,
        'direccion_responsable_id', v_actual.direccion_responsable_id
      ),
      'despues', jsonb_build_object(
        'titulo', v_result.titulo,
        'descripcion', v_result.descripcion,
        'estado', v_result.estado,
        'prioridad', v_result.prioridad,
        'orden_en_columna', v_result.orden_en_columna,
        'fecha_vencimiento', v_result.fecha_vencimiento,
        'direccion_responsable_id', v_result.direccion_responsable_id
      )
    ),
    p_actor_socio_id => v_actor_socio_id
  );

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION rpc_tasks_delete_project(p_proyecto_id UUID)
RETURNS proyectos_tareas
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_socio_id UUID := fn_tasks_current_socio_id();
  v_actual proyectos_tareas%ROWTYPE;
  v_result proyectos_tareas;
  v_closed_tasks_count INTEGER := 0;
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
    RAISE EXCEPTION 'No autorizado para eliminar/archivar este proyecto';
  END IF;

  IF NOT v_actual.activo AND v_actual.fecha_cierre IS NOT NULL THEN
    RETURN v_actual;
  END IF;

  UPDATE proyectos_tareas
  SET
    activo = false,
    fecha_cierre = COALESCE(fecha_cierre, now()),
    updated_at = now()
  WHERE id = p_proyecto_id
  RETURNING * INTO v_result;

  UPDATE tareas
  SET
    estado = 'cerrada',
    fecha_cierre = COALESCE(fecha_cierre, now()),
    updated_by_socio_id = v_actor_socio_id,
    updated_at = now()
  WHERE proyecto_id = p_proyecto_id
    AND estado <> 'cerrada';

  GET DIAGNOSTICS v_closed_tasks_count = ROW_COUNT;

  PERFORM fn_tasks_append_historial(
    p_accion => 'archivar_proyecto',
    p_proyecto_id => v_result.id,
    p_payload => jsonb_build_object(
      'motivo', 'cerrado_por_gestion',
      'tareas_cerradas', v_closed_tasks_count
    ),
    p_actor_socio_id => v_actor_socio_id
  );

  IF v_result.responsable_socio_id IS NOT NULL
     AND v_result.responsable_socio_id <> v_actor_socio_id THEN
    PERFORM fn_tasks_notify_socio(
      p_socio_id => v_result.responsable_socio_id,
      p_titulo => 'Proyecto archivado por gestion',
      p_mensaje => format('El proyecto "%s" fue archivado por la gestión.', v_result.nombre),
      p_tipo => 'info',
      p_link => '/tareas'
    );
  END IF;

  RETURN v_result;
END;
$$;

-- Wrappers compatibilidad rpc_tareas_*
CREATE OR REPLACE FUNCTION rpc_tareas_delete_project(p_proyecto_id UUID)
RETURNS proyectos_tareas
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT rpc_tasks_delete_project(p_proyecto_id);
$$;

-- Grants para nuevas RPC
GRANT EXECUTE ON FUNCTION rpc_tasks_delete_project(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION rpc_tareas_delete_project(UUID) TO authenticated;

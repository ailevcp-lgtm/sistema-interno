-- ============================================================
-- 039: Tareas scope controls managed from Ajustes
-- ============================================================

CREATE TABLE IF NOT EXISTS role_task_scope_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rol_aile_definition_id UUID NOT NULL REFERENCES rol_aile_definitions(id) ON DELETE CASCADE,
  scope_mode TEXT NOT NULL DEFAULT 'own_direction',
  allow_assigned_cross_direction BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT role_task_scope_overrides_unique UNIQUE (rol_aile_definition_id),
  CONSTRAINT role_task_scope_overrides_scope_mode_chk CHECK (
    scope_mode IN ('own_direction', 'all_directions')
  )
);

CREATE INDEX IF NOT EXISTS idx_role_task_scope_overrides_role
  ON role_task_scope_overrides (rol_aile_definition_id);

CREATE OR REPLACE FUNCTION fn_role_task_scope_overrides_bu_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_role_task_scope_overrides_bu_set_updated_at ON role_task_scope_overrides;
CREATE TRIGGER trg_role_task_scope_overrides_bu_set_updated_at
BEFORE UPDATE ON role_task_scope_overrides
FOR EACH ROW
EXECUTE FUNCTION fn_role_task_scope_overrides_bu_set_updated_at();

ALTER TABLE role_task_scope_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS role_task_scope_overrides_select ON role_task_scope_overrides;
CREATE POLICY role_task_scope_overrides_select
ON role_task_scope_overrides
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS role_task_scope_overrides_insert ON role_task_scope_overrides;
CREATE POLICY role_task_scope_overrides_insert
ON role_task_scope_overrides
FOR INSERT
TO authenticated
WITH CHECK ((SELECT fn_is_global_manager_user(auth.uid())));

DROP POLICY IF EXISTS role_task_scope_overrides_update ON role_task_scope_overrides;
CREATE POLICY role_task_scope_overrides_update
ON role_task_scope_overrides
FOR UPDATE
TO authenticated
USING ((SELECT fn_is_global_manager_user(auth.uid())))
WITH CHECK ((SELECT fn_is_global_manager_user(auth.uid())));

DROP POLICY IF EXISTS role_task_scope_overrides_delete ON role_task_scope_overrides;
CREATE POLICY role_task_scope_overrides_delete
ON role_task_scope_overrides
FOR DELETE
TO authenticated
USING ((SELECT fn_is_global_manager_user(auth.uid())));

CREATE OR REPLACE FUNCTION fn_tasks_current_role_context()
RETURNS TABLE (
  rol_aile_definition_id UUID,
  rol_aile_normalized TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.rol_aile_id,
    fn_tasks_normalize_text(COALESCE(rad.nombre, s.rol_aile, ''))
  FROM socios s
  LEFT JOIN rol_aile_definitions rad ON rad.id = s.rol_aile_id
  WHERE s.usuario_id = auth.uid()
    AND COALESCE(s.estado, 'activo') = 'activo'
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION fn_tasks_has_role_action(p_accion TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role_id UUID;
  v_role_name TEXT;
  v_override BOOLEAN;
BEGIN
  IF p_accion NOT IN ('crear', 'editar', 'eliminar', 'aprobar', 'ver') THEN
    RETURN false;
  END IF;

  IF fn_tasks_is_cd_or_admin() THEN
    RETURN true;
  END IF;

  SELECT ctx.rol_aile_definition_id, ctx.rol_aile_normalized
  INTO v_role_id, v_role_name
  FROM fn_tasks_current_role_context() ctx
  LIMIT 1;

  IF COALESCE(v_role_name, '') = '' AND v_role_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT rpo.permitido
  INTO v_override
  FROM role_permission_overrides rpo
  WHERE rpo.recurso = 'tareas'
    AND rpo.accion = p_accion
    AND (
      (v_role_id IS NOT NULL AND rpo.rol_aile_definition_id = v_role_id)
      OR (
        v_role_id IS NULL
        AND EXISTS (
          SELECT 1
          FROM rol_aile_definitions rad
          WHERE rad.id = rpo.rol_aile_definition_id
            AND fn_tasks_normalize_text(rad.nombre) = v_role_name
        )
      )
    )
  ORDER BY CASE WHEN v_role_id IS NOT NULL AND rpo.rol_aile_definition_id = v_role_id THEN 0 ELSE 1 END
  LIMIT 1;

  RETURN COALESCE(v_override, false);
END;
$$;

CREATE OR REPLACE FUNCTION fn_tasks_role_can_manage_module()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    fn_tasks_is_cd_or_admin()
    OR fn_tasks_has_role_action('crear')
    OR fn_tasks_has_role_action('editar')
    OR fn_tasks_has_role_action('eliminar')
  );
$$;

CREATE OR REPLACE FUNCTION fn_tasks_scope_mode()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role_id UUID;
  v_role_name TEXT;
  v_scope_mode TEXT;
BEGIN
  IF fn_tasks_is_cd_or_admin() THEN
    RETURN 'all_directions';
  END IF;

  SELECT ctx.rol_aile_definition_id, ctx.rol_aile_normalized
  INTO v_role_id, v_role_name
  FROM fn_tasks_current_role_context() ctx
  LIMIT 1;

  IF COALESCE(v_role_name, '') = '' AND v_role_id IS NULL THEN
    RETURN 'own_direction';
  END IF;

  SELECT rso.scope_mode
  INTO v_scope_mode
  FROM role_task_scope_overrides rso
  WHERE (
    (v_role_id IS NOT NULL AND rso.rol_aile_definition_id = v_role_id)
    OR (
      v_role_id IS NULL
      AND EXISTS (
        SELECT 1
        FROM rol_aile_definitions rad
        WHERE rad.id = rso.rol_aile_definition_id
          AND fn_tasks_normalize_text(rad.nombre) = v_role_name
      )
    )
  )
  ORDER BY CASE WHEN v_role_id IS NOT NULL AND rso.rol_aile_definition_id = v_role_id THEN 0 ELSE 1 END
  LIMIT 1;

  RETURN COALESCE(v_scope_mode, 'own_direction');
END;
$$;

CREATE OR REPLACE FUNCTION fn_tasks_allow_assigned_cross_direction_edit()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role_id UUID;
  v_role_name TEXT;
  v_allow BOOLEAN;
BEGIN
  IF fn_tasks_is_cd_or_admin() THEN
    RETURN true;
  END IF;

  SELECT ctx.rol_aile_definition_id, ctx.rol_aile_normalized
  INTO v_role_id, v_role_name
  FROM fn_tasks_current_role_context() ctx
  LIMIT 1;

  IF COALESCE(v_role_name, '') = '' AND v_role_id IS NULL THEN
    RETURN true;
  END IF;

  SELECT rso.allow_assigned_cross_direction
  INTO v_allow
  FROM role_task_scope_overrides rso
  WHERE (
    (v_role_id IS NOT NULL AND rso.rol_aile_definition_id = v_role_id)
    OR (
      v_role_id IS NULL
      AND EXISTS (
        SELECT 1
        FROM rol_aile_definitions rad
        WHERE rad.id = rso.rol_aile_definition_id
          AND fn_tasks_normalize_text(rad.nombre) = v_role_name
      )
    )
  )
  ORDER BY CASE WHEN v_role_id IS NOT NULL AND rso.rol_aile_definition_id = v_role_id THEN 0 ELSE 1 END
  LIMIT 1;

  RETURN COALESCE(v_allow, true);
END;
$$;

CREATE OR REPLACE FUNCTION fn_tasks_infer_role_direction_code()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role_name TEXT;
BEGIN
  SELECT ctx.rol_aile_normalized
  INTO v_role_name
  FROM fn_tasks_current_role_context() ctx
  LIMIT 1;

  IF v_role_name IS NULL OR v_role_name = '' THEN
    RETURN NULL;
  END IF;

  IF v_role_name LIKE '%comunic%' THEN
    RETURN 'comunicacion';
  END IF;

  IF v_role_name LIKE '%finanza%' THEN
    RETURN 'finanzas';
  END IF;

  IF v_role_name LIKE '%rrhh%'
     OR (v_role_name LIKE '%recurso%' AND v_role_name LIKE '%human%') THEN
    RETURN 'recursos_humanos';
  END IF;

  IF v_role_name LIKE '%cea%' THEN
    RETURN 'cea';
  END IF;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION fn_tasks_is_director_in_direction(p_direccion_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inferred_code TEXT;
BEGIN
  IF p_direccion_id IS NULL THEN
    RETURN false;
  END IF;

  IF fn_tasks_is_cd_or_admin() THEN
    RETURN true;
  END IF;

  IF NOT fn_tasks_role_can_manage_module() THEN
    RETURN false;
  END IF;

  IF fn_tasks_scope_mode() = 'all_directions' THEN
    RETURN EXISTS (
      SELECT 1
      FROM direcciones d
      WHERE d.id = p_direccion_id
        AND d.activo = true
    );
  END IF;

  IF EXISTS (
    SELECT 1
    FROM socios_direcciones sd
    WHERE sd.socio_id = fn_tasks_current_socio_id()
      AND sd.direccion_id = p_direccion_id
      AND sd.activo = true
      AND sd.es_director = true
      AND (sd.fecha_hasta IS NULL OR sd.fecha_hasta >= CURRENT_DATE)
  ) THEN
    RETURN true;
  END IF;

  v_inferred_code := fn_tasks_infer_role_direction_code();
  IF v_inferred_code IS NULL THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM direcciones d
    WHERE d.id = p_direccion_id
      AND d.activo = true
      AND fn_tasks_normalize_text(d.codigo) = fn_tasks_normalize_text(v_inferred_code)
  );
END;
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
  v_direccion_id UUID;
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

  SELECT p.direccion_id
  INTO v_direccion_id
  FROM proyectos_tareas p
  WHERE p.id = p_proyecto_id;

  IF v_direccion_id IS NULL THEN
    RETURN false;
  END IF;

  RETURN fn_tasks_is_director_in_direction(v_direccion_id);
END;
$$;

CREATE OR REPLACE FUNCTION fn_tasks_can_manage_project(p_proyecto_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_proyecto_id IS NULL THEN
    RETURN false;
  END IF;

  IF fn_tasks_is_cd_or_admin() THEN
    RETURN true;
  END IF;

  IF NOT fn_tasks_role_can_manage_module() THEN
    RETURN false;
  END IF;

  IF fn_tasks_scope_mode() = 'all_directions' THEN
    RETURN true;
  END IF;

  RETURN fn_tasks_is_project_director(p_proyecto_id);
END;
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
  v_direccion_responsable_id UUID;
BEGIN
  IF p_tarea_id IS NULL THEN
    RETURN false;
  END IF;

  IF fn_tasks_is_cd_or_admin() THEN
    RETURN true;
  END IF;

  IF NOT fn_tasks_role_can_manage_module() THEN
    RETURN false;
  END IF;

  IF fn_tasks_scope_mode() = 'all_directions' THEN
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

CREATE OR REPLACE FUNCTION fn_tasks_is_task_assignee(p_tarea_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_socio_id UUID := fn_tasks_current_socio_id();
  v_proyecto_id UUID;
  v_direccion_responsable_id UUID;
BEGIN
  IF p_tarea_id IS NULL OR v_current_socio_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT t.proyecto_id, t.direccion_responsable_id
  INTO v_proyecto_id, v_direccion_responsable_id
  FROM tareas t
  WHERE t.id = p_tarea_id
    AND t.asignado_socio_id = v_current_socio_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF fn_tasks_allow_assigned_cross_direction_edit() THEN
    RETURN true;
  END IF;

  IF fn_tasks_scope_mode() = 'all_directions' THEN
    RETURN true;
  END IF;

  IF v_direccion_responsable_id IS NOT NULL
     AND fn_tasks_is_director_in_direction(v_direccion_responsable_id) THEN
    RETURN true;
  END IF;

  IF v_proyecto_id IS NOT NULL AND fn_tasks_is_project_director(v_proyecto_id) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION fn_tasks_is_subtask_assignee(p_subtarea_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_socio_id UUID := fn_tasks_current_socio_id();
  v_proyecto_id UUID;
  v_direccion_responsable_id UUID;
BEGIN
  IF p_subtarea_id IS NULL OR v_current_socio_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT t.proyecto_id, t.direccion_responsable_id
  INTO v_proyecto_id, v_direccion_responsable_id
  FROM subtareas st
  JOIN tareas t ON t.id = st.tarea_id
  WHERE st.id = p_subtarea_id
    AND st.asignado_socio_id = v_current_socio_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF fn_tasks_allow_assigned_cross_direction_edit() THEN
    RETURN true;
  END IF;

  IF fn_tasks_scope_mode() = 'all_directions' THEN
    RETURN true;
  END IF;

  IF v_direccion_responsable_id IS NOT NULL
     AND fn_tasks_is_director_in_direction(v_direccion_responsable_id) THEN
    RETURN true;
  END IF;

  IF v_proyecto_id IS NOT NULL AND fn_tasks_is_project_director(v_proyecto_id) THEN
    RETURN true;
  END IF;

  RETURN false;
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

CREATE OR REPLACE FUNCTION fn_tasks_can_edit_subtask(p_subtarea_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT fn_tasks_can_manage_subtask(p_subtarea_id) OR fn_tasks_is_subtask_assignee(p_subtarea_id);
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

  IF NOT fn_tasks_can_manage_project(v_proyecto_id) THEN
    IF v_project.tipo = 'institucional' THEN
      IF v_direccion_responsable_id IS NULL THEN
        RAISE EXCEPTION 'Las tareas institucionales requieren direccion_responsable';
      END IF;

      IF NOT fn_tasks_role_can_manage_module() THEN
        RAISE EXCEPTION 'No autorizado para crear tareas en este proyecto';
      END IF;

      IF fn_tasks_scope_mode() <> 'all_directions'
         AND NOT fn_tasks_is_director_in_direction(v_direccion_responsable_id) THEN
        RAISE EXCEPTION 'No autorizado para crear tareas en la direccion indicada';
      END IF;
    ELSE
      RAISE EXCEPTION 'No autorizado para crear tareas en este proyecto';
    END IF;
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

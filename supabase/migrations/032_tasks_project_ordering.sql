-- ============================================================
-- 032: Persisted project ordering (shared across all users)
-- ============================================================

DO $$
BEGIN
  IF to_regclass('public.proyectos_tareas') IS NULL THEN
    RAISE EXCEPTION 'La migracion 032 requiere tabla proyectos_tareas (027/028/030)';
  END IF;
END;
$$;

ALTER TABLE proyectos_tareas
  ADD COLUMN IF NOT EXISTS orden_tablero INTEGER;

WITH base AS (
  SELECT COALESCE(MAX(p.orden_tablero), -1) AS base_order
  FROM proyectos_tareas p
  WHERE p.orden_tablero IS NOT NULL
), ranked AS (
  SELECT
    p.id,
    base.base_order + ROW_NUMBER() OVER (
      ORDER BY COALESCE(p.updated_at, p.created_at) DESC, p.created_at DESC, p.id
    ) AS new_order
  FROM proyectos_tareas p
  CROSS JOIN base
  WHERE p.orden_tablero IS NULL
)
UPDATE proyectos_tareas p
SET orden_tablero = ranked.new_order
FROM ranked
WHERE p.id = ranked.id;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'proyectos_tareas_orden_tablero_chk'
  ) THEN
    ALTER TABLE proyectos_tareas
      ADD CONSTRAINT proyectos_tareas_orden_tablero_chk
      CHECK (orden_tablero >= 0);
  END IF;
END;
$$;

ALTER TABLE proyectos_tareas
  ALTER COLUMN orden_tablero SET NOT NULL;

CREATE SEQUENCE IF NOT EXISTS proyectos_tareas_orden_tablero_seq
  AS BIGINT
  START WITH 0
  INCREMENT BY 1
  MINVALUE 0
  NO MAXVALUE
  CACHE 1;

DO $$
DECLARE
  v_max_order INTEGER;
BEGIN
  SELECT MAX(orden_tablero) INTO v_max_order
  FROM proyectos_tareas;

  IF v_max_order IS NULL THEN
    PERFORM setval('proyectos_tareas_orden_tablero_seq', 0, false);
  ELSE
    PERFORM setval('proyectos_tareas_orden_tablero_seq', v_max_order, true);
  END IF;
END;
$$;

ALTER TABLE proyectos_tareas
  ALTER COLUMN orden_tablero SET DEFAULT nextval('proyectos_tareas_orden_tablero_seq');

CREATE INDEX IF NOT EXISTS idx_proyectos_tareas_orden_tablero
  ON proyectos_tareas (orden_tablero ASC, created_at ASC);

CREATE OR REPLACE FUNCTION rpc_tasks_reorder_projects(p_payload JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_socio_id UUID := fn_tasks_current_socio_id();
  v_item JSONB;
  v_proyecto_id UUID;
  v_new_order INTEGER;
  v_old_order INTEGER;
BEGIN
  IF auth.uid() IS NULL OR v_actor_socio_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'array' THEN
    RAISE EXCEPTION 'p_payload debe ser un array JSON con {proyecto_id, orden_tablero}';
  END IF;

  FOR v_item IN
    SELECT value
    FROM jsonb_array_elements(p_payload)
  LOOP
    v_proyecto_id := NULLIF(btrim(COALESCE(v_item ->> 'proyecto_id', '')), '')::UUID;
    v_new_order := NULLIF(btrim(COALESCE(v_item ->> 'orden_tablero', '')), '')::INTEGER;

    IF v_proyecto_id IS NULL THEN
      RAISE EXCEPTION 'proyecto_id es obligatorio para reordenar';
    END IF;

    IF v_new_order IS NULL OR v_new_order < 0 THEN
      RAISE EXCEPTION 'orden_tablero debe ser un entero >= 0';
    END IF;

    SELECT p.orden_tablero
    INTO v_old_order
    FROM proyectos_tareas p
    WHERE p.id = v_proyecto_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Proyecto no encontrado: %', v_proyecto_id;
    END IF;

    IF NOT fn_tasks_can_manage_project(v_proyecto_id) THEN
      RAISE EXCEPTION 'No autorizado para reordenar este proyecto';
    END IF;

    IF v_old_order IS DISTINCT FROM v_new_order THEN
      UPDATE proyectos_tareas
      SET
        orden_tablero = v_new_order,
        updated_at = now()
      WHERE id = v_proyecto_id;

      PERFORM fn_tasks_append_historial(
        p_accion => 'reordenar_proyecto',
        p_proyecto_id => v_proyecto_id,
        p_payload => jsonb_build_object(
          'orden_tablero_anterior', v_old_order,
          'orden_tablero_nuevo', v_new_order
        ),
        p_actor_socio_id => v_actor_socio_id
      );
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION rpc_tareas_reordenar_proyectos(p_payload JSONB)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT rpc_tasks_reorder_projects(p_payload);
$$;

GRANT EXECUTE ON FUNCTION rpc_tasks_reorder_projects(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION rpc_tareas_reordenar_proyectos(JSONB) TO authenticated;

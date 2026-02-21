-- ============================================================
-- 036: Tareas - borrado fisico de tarea desde RPC de gestion
-- ============================================================

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
    RAISE EXCEPTION 'No autorizado para eliminar esta tarea';
  END IF;

  DELETE FROM tareas
  WHERE id = p_tarea_id
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

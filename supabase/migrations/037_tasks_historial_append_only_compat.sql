-- ============================================================
-- 037: Compatibilidad append-only para tareas_historial
-- ============================================================
-- Si tareas_historial es append-only, no puede recibir UPDATE/DELETE.
-- Por eso removemos FKs que propagan borrado desde tareas/subtareas.

ALTER TABLE public.tareas_historial
  DROP CONSTRAINT IF EXISTS tareas_historial_tarea_id_fkey;

ALTER TABLE public.tareas_historial
  DROP CONSTRAINT IF EXISTS tareas_historial_subtarea_id_fkey;


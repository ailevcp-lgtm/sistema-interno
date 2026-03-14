-- 042: Normaliza prioridades de tareas a P1..P4

UPDATE public.tareas
SET prioridad = 4
WHERE prioridad > 4;

ALTER TABLE public.tareas
  DROP CONSTRAINT IF EXISTS tareas_prioridad_chk;

ALTER TABLE public.tareas
  ADD CONSTRAINT tareas_prioridad_chk
  CHECK (prioridad BETWEEN 1 AND 4);

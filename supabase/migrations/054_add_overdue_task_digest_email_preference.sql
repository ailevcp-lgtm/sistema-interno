-- ============================================================
-- 054: Preferencia para resumen diario de tareas vencidas
-- ============================================================

ALTER TABLE email_preferences
  ADD COLUMN IF NOT EXISTS tareas_vencidas_resumen BOOLEAN NOT NULL DEFAULT TRUE;

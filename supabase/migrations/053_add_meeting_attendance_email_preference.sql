-- ============================================================
-- 053: Preferencia de email para recordatorios de asistencia pendiente
-- ============================================================

ALTER TABLE email_preferences
ADD COLUMN IF NOT EXISTS reunion_asistencia_pendiente_recordatorio BOOLEAN NOT NULL DEFAULT TRUE;

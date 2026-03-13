-- ============================================================
-- 041: Email Notifications — preferences & log tables
-- ============================================================

-- Preferencias de notificación por email (por socio)
CREATE TABLE IF NOT EXISTS email_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  socio_id UUID NOT NULL REFERENCES socios(id) ON DELETE CASCADE,
  -- Tareas
  tarea_asignada BOOLEAN NOT NULL DEFAULT TRUE,
  tarea_estado_cambio BOOLEAN NOT NULL DEFAULT TRUE,
  tarea_vencimiento_proximo BOOLEAN NOT NULL DEFAULT TRUE,
  subtarea_creada BOOLEAN NOT NULL DEFAULT TRUE,
  -- Handoffs
  handoff_solicitado BOOLEAN NOT NULL DEFAULT TRUE,
  handoff_resuelto BOOLEAN NOT NULL DEFAULT TRUE,
  -- Aprobaciones CD
  aprobacion_cd_pendiente BOOLEAN NOT NULL DEFAULT TRUE,
  aprobacion_cd_resuelta BOOLEAN NOT NULL DEFAULT TRUE,
  -- Calendario
  calendario_reunion_nueva BOOLEAN NOT NULL DEFAULT TRUE,
  calendario_reunion_modificada BOOLEAN NOT NULL DEFAULT TRUE,
  calendario_reunion_cancelada BOOLEAN NOT NULL DEFAULT TRUE,
  calendario_planificacion_definitiva BOOLEAN NOT NULL DEFAULT TRUE,
  -- Resoluciones y Decretos
  resolucion_nueva BOOLEAN NOT NULL DEFAULT TRUE,
  decreto_nuevo BOOLEAN NOT NULL DEFAULT TRUE,
  -- Configuración de antelación (días antes para recordatorios)
  dias_antelacion_recordatorio INTEGER NOT NULL DEFAULT 2,
  -- Global kill switch
  emails_habilitados BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(socio_id)
);

-- Registro de emails enviados
CREATE TABLE IF NOT EXISTS email_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  socio_id UUID REFERENCES socios(id) ON DELETE SET NULL,
  email_to TEXT NOT NULL,
  tipo TEXT NOT NULL,
  subject TEXT NOT NULL,
  resend_id TEXT,
  estado TEXT NOT NULL DEFAULT 'enviado',
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_email_preferences_socio ON email_preferences(socio_id);
CREATE INDEX IF NOT EXISTS idx_email_log_socio ON email_log(socio_id);
CREATE INDEX IF NOT EXISTS idx_email_log_tipo ON email_log(tipo);
CREATE INDEX IF NOT EXISTS idx_email_log_created ON email_log(created_at DESC);

-- RLS
ALTER TABLE email_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_log ENABLE ROW LEVEL SECURITY;

-- Cada socio puede ver/editar sus propias preferencias
CREATE POLICY email_preferences_own_select ON email_preferences
  FOR SELECT USING (
    socio_id IN (
      SELECT id FROM socios WHERE usuario_id = auth.uid()
    )
  );

CREATE POLICY email_preferences_own_insert ON email_preferences
  FOR INSERT WITH CHECK (
    socio_id IN (
      SELECT id FROM socios WHERE usuario_id = auth.uid()
    )
  );

CREATE POLICY email_preferences_own_update ON email_preferences
  FOR UPDATE USING (
    socio_id IN (
      SELECT id FROM socios WHERE usuario_id = auth.uid()
    )
  );

-- Admin puede ver el log de emails
CREATE POLICY email_log_admin_select ON email_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM socios
      WHERE usuario_id = auth.uid()
        AND rol IN ('admin')
    )
  );

-- Insertar log desde el servidor (service role)
CREATE POLICY email_log_service_insert ON email_log
  FOR INSERT WITH CHECK (TRUE);

-- Trigger para updated_at en email_preferences
CREATE OR REPLACE FUNCTION update_email_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_email_preferences_updated_at
  BEFORE UPDATE ON email_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_email_preferences_updated_at();

-- ============================================================
-- 044_reuniones_direccion.sql
-- Módulo de Reuniones por Dirección
-- Permite a los directores agendar reuniones, registrar
-- asistencia y que la CD controle la frecuencia de reuniones.
-- ============================================================

-- Tabla principal
CREATE TABLE IF NOT EXISTS reuniones_direccion (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo                 text        NOT NULL,
  descripcion            text,
  direccion              text        NOT NULL
                         CHECK (direccion IN ('CEA', 'Finanzas', 'Recursos Humanos', 'Comunicación')),
  fecha_inicio           timestamptz NOT NULL,
  fecha_fin              timestamptz NOT NULL,
  lugar                  text,
  creado_por_socio_id    uuid        REFERENCES socios(id) ON DELETE SET NULL,
  estado                 text        NOT NULL DEFAULT 'programada'
                         CHECK (estado IN ('programada', 'finalizada', 'cancelada')),
  asistencia_registrada  boolean     NOT NULL DEFAULT false,
  calendario_reunion_id  uuid        REFERENCES reuniones_calendario(id) ON DELETE SET NULL,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

-- Tabla de asistentes
CREATE TABLE IF NOT EXISTS reunion_direccion_asistentes (
  id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  reunion_id               uuid        NOT NULL REFERENCES reuniones_direccion(id) ON DELETE CASCADE,
  socio_id                 uuid        NOT NULL REFERENCES socios(id) ON DELETE CASCADE,
  registrado_por_socio_id  uuid        REFERENCES socios(id) ON DELETE SET NULL,
  created_at               timestamptz NOT NULL DEFAULT now(),
  UNIQUE(reunion_id, socio_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_reuniones_direccion_direccion
  ON reuniones_direccion(direccion);
CREATE INDEX IF NOT EXISTS idx_reuniones_direccion_fecha_inicio
  ON reuniones_direccion(fecha_inicio DESC);
CREATE INDEX IF NOT EXISTS idx_reuniones_direccion_estado
  ON reuniones_direccion(estado);
CREATE INDEX IF NOT EXISTS idx_reunion_asistentes_reunion_id
  ON reunion_direccion_asistentes(reunion_id);

-- RLS
ALTER TABLE reuniones_direccion ENABLE ROW LEVEL SECURITY;
ALTER TABLE reunion_direccion_asistentes ENABLE ROW LEVEL SECURITY;

-- Políticas reuniones_direccion
CREATE POLICY "rd_select" ON reuniones_direccion
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "rd_insert" ON reuniones_direccion
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "rd_update" ON reuniones_direccion
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "rd_delete" ON reuniones_direccion
  FOR DELETE TO authenticated USING (true);

-- Políticas reunion_direccion_asistentes
CREATE POLICY "rda_select" ON reunion_direccion_asistentes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "rda_insert" ON reunion_direccion_asistentes
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "rda_delete" ON reunion_direccion_asistentes
  FOR DELETE TO authenticated USING (true);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION fn_reuniones_direccion_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_reuniones_direccion_updated_at
  BEFORE UPDATE ON reuniones_direccion
  FOR EACH ROW EXECUTE FUNCTION fn_reuniones_direccion_updated_at();

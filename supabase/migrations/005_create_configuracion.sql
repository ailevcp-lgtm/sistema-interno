-- ============================================================
-- 005: Crear tabla de configuracion del sistema
-- ============================================================
-- Almacena pares clave/valor para configuraciones globales
-- como el monto de cuota mensual, dia de vencimiento, etc.
-- ============================================================

CREATE TABLE IF NOT EXISTS configuracion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clave TEXT UNIQUE NOT NULL,
  valor TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE configuracion ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_select" ON configuracion FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert" ON configuracion FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update" ON configuracion FOR UPDATE TO authenticated USING (true);

-- Valores iniciales
INSERT INTO configuracion (clave, valor) VALUES
  ('monto_cuota', '5000'),
  ('dia_vencimiento', '10');

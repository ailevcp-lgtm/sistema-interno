-- ══════════════════════════════════════════════════════════
-- 010: Tabla de arqueos de caja
-- ══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS arqueos (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  fecha         TIMESTAMPTZ DEFAULT now(),
  cuenta_id     UUID REFERENCES cuentas(id) NOT NULL,
  saldo_sistema NUMERIC NOT NULL,
  saldo_real    NUMERIC NOT NULL,
  diferencia    NUMERIC GENERATED ALWAYS AS (saldo_real - saldo_sistema) STORED,
  observaciones TEXT,
  realizado_por UUID REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE arqueos ENABLE ROW LEVEL SECURITY;

-- Políticas de seguridad
CREATE POLICY "auth_select" ON arqueos FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert" ON arqueos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update" ON arqueos FOR UPDATE TO authenticated USING (true);

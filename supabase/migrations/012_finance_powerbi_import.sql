-- ══════════════════════════════════════════════════════════
-- 012: Preparar esquema para importación de datos Power BI
-- ══════════════════════════════════════════════════════════
-- Ejecutar ANTES del script load_finance_data.py

-- ── 1. Quitar constraint monto > 0 ─────────────────────
--    Necesario para contra-asientos con montos negativos
DO $$
DECLARE
    cname TEXT;
BEGIN
    SELECT con.conname INTO cname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE rel.relname = 'movimientos'
      AND nsp.nspname = 'public'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) LIKE '%monto%';
    IF cname IS NOT NULL THEN
        EXECUTE format('ALTER TABLE movimientos DROP CONSTRAINT %I', cname);
        RAISE NOTICE 'Dropped constraint: %', cname;
    ELSE
        RAISE NOTICE 'No monto check constraint found (already dropped or never existed)';
    END IF;
END $$;

-- ── 2. Hacer descripcion nullable ──────────────────────
--    Algunos movimientos históricos no tienen descripción
ALTER TABLE movimientos ALTER COLUMN descripcion DROP NOT NULL;

-- ── 3. Agregar columnas para datos 2026 ─────────────────
ALTER TABLE movimientos
  ADD COLUMN IF NOT EXISTS month_fees_quantity INT,
  ADD COLUMN IF NOT EXISTS running_balance     NUMERIC,
  ADD COLUMN IF NOT EXISTS net_signed          NUMERIC,
  ADD COLUMN IF NOT EXISTS data_source         TEXT DEFAULT '2024-2025';

-- ── 4. Tabla de estado de cuotas (fee tracking) ─────────
--    NO son transacciones — es el estado mensual de cada socio
CREATE TABLE IF NOT EXISTS fee_status (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    socio_id    UUID NOT NULL REFERENCES socios(id),
    year        INT NOT NULL,
    month       TEXT NOT NULL,
    status      TEXT NOT NULL CHECK (status IN ('Pago', 'Pend.', 'Inac.')),
    condicion   TEXT,
    estado      TEXT,
    ultimo_aviso        DATE,
    total_deuda_cuotas  NUMERIC DEFAULT 0,
    deuda_2025          NUMERIC DEFAULT 0,
    deuda_2026          NUMERIC DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT now(),
    UNIQUE (socio_id, year, month)
);

CREATE INDEX IF NOT EXISTS idx_fee_status_period ON fee_status(year, month);
CREATE INDEX IF NOT EXISTS idx_fee_status_status ON fee_status(status);

-- ── 5. RLS para fee_status ──────────────────────────────
ALTER TABLE fee_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_select" ON fee_status FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert" ON fee_status FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update" ON fee_status FOR UPDATE TO authenticated USING (true);
CREATE POLICY "auth_delete" ON fee_status FOR DELETE TO authenticated USING (true);

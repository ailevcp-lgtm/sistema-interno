-- ══════════════════════════════════════════════════════════
-- 007: Evolución del esquema financiero para migración Power BI
-- ══════════════════════════════════════════════════════════

-- ── 1. Tabla de eventos ──────────────────────────────────
CREATE TABLE IF NOT EXISTS eventos (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre        TEXT NOT NULL UNIQUE,
  anio          SMALLINT,
  activo        BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ── 2. Tabla de subcategorías ────────────────────────────
CREATE TABLE IF NOT EXISTS subcategorias_financieras (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  categoria_id  UUID NOT NULL REFERENCES categorias_financieras(id),
  nombre        TEXT NOT NULL,
  activa        BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(categoria_id, nombre)
);

-- ── 3. Tabla de cuentas/medios de pago ───────────────────
CREATE TABLE IF NOT EXISTS cuentas (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre        TEXT NOT NULL UNIQUE,
  tipo          TEXT CHECK (tipo IN ('efectivo','digital','banco')),
  activa        BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ── 4. Tabla de lotes de importación ─────────────────────
CREATE TABLE IF NOT EXISTS import_batches (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  archivo_origen TEXT NOT NULL,
  hoja_origen   TEXT,
  filas_totales INT DEFAULT 0,
  filas_insertadas INT DEFAULT 0,
  filas_duplicadas INT DEFAULT 0,
  filas_error   INT DEFAULT 0,
  importado_por UUID,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ── 5. Evolución de movimientos ──────────────────────────
ALTER TABLE movimientos
  ADD COLUMN IF NOT EXISTS evento_id       UUID REFERENCES eventos(id),
  ADD COLUMN IF NOT EXISTS subcategoria_id UUID REFERENCES subcategorias_financieras(id),
  ADD COLUMN IF NOT EXISTS cuenta_id       UUID REFERENCES cuentas(id),
  ADD COLUMN IF NOT EXISTS voluntario_nombre TEXT,
  ADD COLUMN IF NOT EXISTS moneda          TEXT DEFAULT 'ARS',
  ADD COLUMN IF NOT EXISTS import_batch_id UUID REFERENCES import_batches(id),
  ADD COLUMN IF NOT EXISTS external_id     TEXT,
  ADD COLUMN IF NOT EXISTS row_hash        TEXT;

-- Índice para deduplicación
CREATE UNIQUE INDEX IF NOT EXISTS idx_movimientos_row_hash
  ON movimientos(row_hash) WHERE row_hash IS NOT NULL;

-- Índices de performance para queries del dashboard
CREATE INDEX IF NOT EXISTS idx_movimientos_periodo ON movimientos(periodo);
CREATE INDEX IF NOT EXISTS idx_movimientos_tipo ON movimientos(tipo);
CREATE INDEX IF NOT EXISTS idx_movimientos_fecha ON movimientos(fecha);
CREATE INDEX IF NOT EXISTS idx_movimientos_categoria ON movimientos(categoria_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_evento ON movimientos(evento_id);

-- ── 6. RLS para tablas nuevas ────────────────────────────
ALTER TABLE eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE subcategorias_financieras ENABLE ROW LEVEL SECURITY;
ALTER TABLE cuentas ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_select" ON eventos FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert" ON eventos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update" ON eventos FOR UPDATE TO authenticated USING (true);

CREATE POLICY "auth_select" ON subcategorias_financieras FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert" ON subcategorias_financieras FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "auth_select" ON cuentas FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert" ON cuentas FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "auth_select" ON import_batches FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert" ON import_batches FOR INSERT TO authenticated WITH CHECK (true);

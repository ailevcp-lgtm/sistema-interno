-- 022_optimize_movimientos_active_queries.sql
-- Mejora rendimiento de consultas frecuentes sobre movimientos no anulados.

-- Normalizar valores legacy para aprovechar índices por igualdad.
UPDATE movimientos
SET anulado = false
WHERE anulado IS NULL;

ALTER TABLE movimientos
  ALTER COLUMN anulado SET DEFAULT false,
  ALTER COLUMN anulado SET NOT NULL;

-- Índice principal para listados cronológicos recientes.
CREATE INDEX IF NOT EXISTS idx_movimientos_active_fecha_created
  ON movimientos (fecha DESC, created_at DESC)
  WHERE anulado = false;

-- Índices para filtros y agregaciones del dashboard financiero.
CREATE INDEX IF NOT EXISTS idx_movimientos_active_periodo
  ON movimientos (periodo)
  WHERE anulado = false;

CREATE INDEX IF NOT EXISTS idx_movimientos_active_categoria_fecha
  ON movimientos (categoria_id, fecha DESC)
  WHERE anulado = false;

CREATE INDEX IF NOT EXISTS idx_movimientos_active_evento_fecha
  ON movimientos (evento_id, fecha DESC)
  WHERE anulado = false;

CREATE INDEX IF NOT EXISTS idx_movimientos_active_cuenta_tipo
  ON movimientos (cuenta_id, tipo)
  WHERE anulado = false;

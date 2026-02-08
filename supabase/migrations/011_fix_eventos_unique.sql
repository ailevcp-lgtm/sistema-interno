-- ══════════════════════════════════════════════════════════
-- 011: Fix eventos UNIQUE constraint and seed correct events
-- ══════════════════════════════════════════════════════════
-- Problem: nombre was UNIQUE, preventing same event name across years
-- (e.g., "MINU 2024" and "MINU 2025"). Also, event names in DB
-- didn't match Excel event names, so import couldn't link movements.

-- 1. Drop old unique constraint on nombre
ALTER TABLE eventos DROP CONSTRAINT IF EXISTS eventos_nombre_key;

-- 2. Add new unique constraint on (nombre, anio) — idempotent
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'eventos_nombre_anio_key'
  ) THEN
    ALTER TABLE eventos ADD CONSTRAINT eventos_nombre_anio_key UNIQUE (nombre, anio);
  END IF;
END
$$;

-- 3. Delete old seeded events that have no movements linked
--    (they couldn't match because names were wrong)
DELETE FROM eventos WHERE id NOT IN (SELECT DISTINCT evento_id FROM movimientos WHERE evento_id IS NOT NULL);

-- 4. Insert events matching Excel names exactly
INSERT INTO eventos (nombre, anio, activo) VALUES
  ('Por siempre, Malvinas - 2024', 2024, true),
  ('Capacitación Siglo XXI 2024', 2024, true),
  ('Histórico 2024', 2024, true),
  ('Histórico 2025', 2025, true),
  ('Capacitación Siglo XXI 2025', 2025, true),
  ('MINU 2025', 2025, true),
  ('MINU 2024', 2024, true),
  ('C40 2024', 2024, true),
  ('Asamblea', 2024, true),
  ('Día del Voluntariado', 2024, true),
  ('Campamento', 2025, true)
ON CONFLICT (nombre, anio) DO NOTHING;

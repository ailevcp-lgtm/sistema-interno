-- ══════════════════════════════════════════════════════════
-- 009: Seed de categorías unificadas (2024-2025 + 2026)
-- ══════════════════════════════════════════════════════════

-- Categorías de ingreso nuevas (no duplicar las existentes de 003)
INSERT INTO categorias_financieras (nombre, tipo, activa) VALUES
  ('Buffet', 'ingreso', true),
  ('Vasos', 'ingreso', true),
  ('Rendimientos', 'ingreso', true),
  ('Indumentaria', 'ingreso', true),
  ('Campamento', 'ingreso', true),
  ('Aportes Internos', 'ingreso', true),
  ('Donaciones Externas', 'ingreso', true),
  ('Pines', 'ingreso', true),
  ('Almuerzo', 'ingreso', true)
ON CONFLICT DO NOTHING;

-- Renombrar "Merchandising" egreso existente si existe, y agregar como ingreso también
INSERT INTO categorias_financieras (nombre, tipo, activa) VALUES
  ('Merchandising', 'ingreso', true)
ON CONFLICT DO NOTHING;

-- Categorías de egreso nuevas
INSERT INTO categorias_financieras (nombre, tipo, activa) VALUES
  ('Comunicación', 'egreso', true),
  ('Papelería', 'egreso', true),
  ('Gastos Operativos', 'egreso', true),
  ('Mesa Dulce', 'egreso', true),
  ('Decoración', 'egreso', true),
  ('Gastos Internos', 'egreso', true),
  ('Suscripciones', 'egreso', true),
  ('Dulce', 'egreso', true),
  ('Movimientos de Cuentas', 'egreso', true),
  ('Varios', 'egreso', true)
ON CONFLICT DO NOTHING;

-- Seed de eventos conocidos (2024-2025)
INSERT INTO eventos (nombre, anio, activo) VALUES
  ('MINU', 2024, true),
  ('C40', 2024, true),
  ('Malvinas', 2024, true),
  ('Día del Voluntariado', 2024, true),
  ('Asamblea', 2024, true),
  ('MINU', 2025, true),
  ('C40', 2025, true),
  ('Campamento', 2025, true)
ON CONFLICT (nombre) DO NOTHING;

-- Seed de cuentas/medios de pago
INSERT INTO cuentas (nombre, tipo, activa) VALUES
  ('Transferencia', 'digital', true),
  ('Efectivo', 'efectivo', true),
  ('NaranjaX', 'digital', true)
ON CONFLICT (nombre) DO NOTHING;

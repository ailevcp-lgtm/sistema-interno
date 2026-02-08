-- ══════════════════════════════════════════════════════════
-- 008: Vistas SQL para el dashboard financiero
-- ══════════════════════════════════════════════════════════

-- Vista: Detalle mensual
CREATE OR REPLACE VIEW v_monthly_detail AS
SELECT
  periodo,
  SUBSTRING(periodo FROM 6 FOR 2)::int as mes_num,
  SUBSTRING(periodo FROM 1 FOR 4)::int as anio,
  SUM(CASE WHEN tipo = 'ingreso' THEN monto ELSE 0 END) as ingresos,
  SUM(CASE WHEN tipo = 'egreso' THEN monto ELSE 0 END) as egresos,
  SUM(CASE WHEN tipo = 'ingreso' THEN monto ELSE 0 END)
    - SUM(CASE WHEN tipo = 'egreso' THEN monto ELSE 0 END) as saldo
FROM movimientos
GROUP BY periodo
ORDER BY periodo;

-- Vista: Aporte por categoría
CREATE OR REPLACE VIEW v_category_contribution AS
SELECT
  cf.id as categoria_id,
  cf.nombre as categoria,
  cf.tipo,
  SUM(CASE WHEN m.tipo = 'ingreso' THEN m.monto ELSE 0 END) as ingresos,
  SUM(CASE WHEN m.tipo = 'egreso' THEN m.monto ELSE 0 END) as egresos,
  SUM(CASE WHEN m.tipo = 'ingreso' THEN m.monto ELSE -m.monto END) as balance
FROM movimientos m
JOIN categorias_financieras cf ON cf.id = m.categoria_id
GROUP BY cf.id, cf.nombre, cf.tipo
ORDER BY balance DESC;

-- Vista: Resumen por evento
CREATE OR REPLACE VIEW v_event_summary AS
SELECT
  e.id as evento_id,
  e.nombre as evento,
  e.anio,
  SUM(CASE WHEN m.tipo = 'ingreso' THEN m.monto ELSE 0 END) as ingresos,
  SUM(CASE WHEN m.tipo = 'egreso' THEN m.monto ELSE 0 END) as egresos,
  SUM(CASE WHEN m.tipo = 'ingreso' THEN m.monto ELSE -m.monto END) as saldo
FROM movimientos m
JOIN eventos e ON e.id = m.evento_id
GROUP BY e.id, e.nombre, e.anio
ORDER BY saldo DESC;

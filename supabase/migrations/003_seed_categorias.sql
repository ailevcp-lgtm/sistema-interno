-- ============================================================
-- 003: Datos iniciales - Categorias financieras
-- ============================================================
-- Carga las categorias de ingresos y egresos que usa el
-- modulo de finanzas. Solo insertar si la tabla esta vacia.
-- ============================================================

INSERT INTO categorias_financieras (nombre, tipo, activa)
SELECT nombre, tipo, activa
FROM (VALUES
  ('Cuotas',                   'ingreso', true),
  ('Inscripciones a modelos',  'ingreso', true),
  ('Donaciones',               'ingreso', true),
  ('Sponsors',                 'ingreso', true),
  ('Otros ingresos',           'ingreso', true),
  ('Logistica',                'egreso',  true),
  ('Catering',                 'egreso',  true),
  ('Papeleria e impresiones',  'egreso',  true),
  ('Alquiler de espacios',     'egreso',  true),
  ('Honorarios',               'egreso',  true),
  ('Merchandising',            'egreso',  true),
  ('Otros egresos',            'egreso',  true)
) AS v(nombre, tipo, activa)
WHERE NOT EXISTS (SELECT 1 FROM categorias_financieras LIMIT 1);

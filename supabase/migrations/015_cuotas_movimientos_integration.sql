-- 015_cuotas_movimientos_integration.sql
-- Integración Cuotas ↔ Movimientos: cada pago de cuota genera un movimiento (ingreso)
-- vinculado a las cuotas mediante cuota_aplicaciones, con triggers de recálculo automático.

-- ═══════════════════════════════════════════════════════════════
-- 1.1 Categoría "Cuotas" en configuracion
-- ═══════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_cat_id UUID;
BEGIN
  -- Buscar la categoría "Cuotas" existente
  SELECT id INTO v_cat_id
  FROM categorias_financieras
  WHERE nombre = 'Cuotas' AND tipo = 'ingreso'
  LIMIT 1;

  -- Si no existe, crearla
  IF v_cat_id IS NULL THEN
    INSERT INTO categorias_financieras (nombre, tipo, activa)
    VALUES ('Cuotas', 'ingreso', true)
    RETURNING id INTO v_cat_id;
  END IF;

  -- Guardar en configuracion
  INSERT INTO configuracion (clave, valor)
  VALUES ('cuotas_categoria_id', v_cat_id::TEXT)
  ON CONFLICT (clave) DO UPDATE SET valor = v_cat_id::TEXT, updated_at = now();
END $$;

-- ═══════════════════════════════════════════════════════════════
-- 1.2 Columna socio_id en movimientos
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE movimientos ADD COLUMN IF NOT EXISTS socio_id UUID REFERENCES socios(id) ON DELETE SET NULL;

-- ═══════════════════════════════════════════════════════════════
-- 1.3 Columnas de anulación en movimientos
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE movimientos ADD COLUMN IF NOT EXISTS anulado BOOLEAN DEFAULT false;
ALTER TABLE movimientos ADD COLUMN IF NOT EXISTS anulado_at TIMESTAMPTZ;
ALTER TABLE movimientos ADD COLUMN IF NOT EXISTS anulado_por UUID REFERENCES auth.users(id);
ALTER TABLE movimientos ADD COLUMN IF NOT EXISTS anulado_motivo TEXT;

-- ═══════════════════════════════════════════════════════════════
-- 1.4 Columna vencimiento en cuotas
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE cuotas ADD COLUMN IF NOT EXISTS vencimiento DATE;

-- ═══════════════════════════════════════════════════════════════
-- 1.5 Tabla cuota_aplicaciones
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS cuota_aplicaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  movimiento_id UUID NOT NULL REFERENCES movimientos(id) ON DELETE CASCADE,
  cuota_id UUID NOT NULL REFERENCES cuotas(id) ON DELETE CASCADE,
  monto_aplicado NUMERIC NOT NULL CHECK (monto_aplicado >= 0),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(movimiento_id, cuota_id)
);

-- ═══════════════════════════════════════════════════════════════
-- 1.6 Tabla promociones_cuotas
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS promociones_cuotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  descripcion TEXT,
  tipo TEXT NOT NULL CHECK (tipo IN ('percent', 'fixed')),
  valor NUMERIC NOT NULL,
  meses_min INT,
  meses_max INT,
  activa BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════
-- 1.7 Tabla movimiento_promocion_cuotas
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS movimiento_promocion_cuotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  movimiento_id UUID NOT NULL REFERENCES movimientos(id) ON DELETE CASCADE,
  promocion_id UUID REFERENCES promociones_cuotas(id),
  descuento_monto NUMERIC NOT NULL DEFAULT 0,
  snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════
-- 1.8 Trigger: recalcular cuota al cambiar cuota_aplicaciones
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_recalc_cuota()
RETURNS TRIGGER AS $$
DECLARE
  v_cuota_id UUID;
  v_total_pagado NUMERIC;
  v_monto_esperado NUMERIC;
  v_nuevo_estado TEXT;
  v_fecha_pago DATE;
  v_vencimiento DATE;
BEGIN
  -- Determinar cuota afectada
  IF TG_OP = 'DELETE' THEN
    v_cuota_id := OLD.cuota_id;
  ELSE
    v_cuota_id := NEW.cuota_id;
  END IF;

  -- Calcular monto pagado (solo de movimientos NO anulados)
  SELECT COALESCE(SUM(ca.monto_aplicado), 0) INTO v_total_pagado
  FROM cuota_aplicaciones ca
  JOIN movimientos m ON m.id = ca.movimiento_id
  WHERE ca.cuota_id = v_cuota_id
    AND (m.anulado IS NULL OR m.anulado = false);

  -- Obtener monto esperado y vencimiento
  SELECT monto_esperado, vencimiento INTO v_monto_esperado, v_vencimiento
  FROM cuotas WHERE id = v_cuota_id;

  -- Determinar estado
  IF v_total_pagado >= v_monto_esperado THEN
    v_nuevo_estado := 'pagada';
  ELSIF v_total_pagado > 0 THEN
    v_nuevo_estado := 'parcial';
  ELSIF v_vencimiento IS NOT NULL AND v_vencimiento < CURRENT_DATE THEN
    v_nuevo_estado := 'vencida';
  ELSE
    v_nuevo_estado := 'pendiente';
  END IF;

  -- Obtener fecha del movimiento más reciente si está pagada
  IF v_nuevo_estado = 'pagada' THEN
    SELECT m.fecha INTO v_fecha_pago
    FROM cuota_aplicaciones ca
    JOIN movimientos m ON m.id = ca.movimiento_id
    WHERE ca.cuota_id = v_cuota_id
      AND (m.anulado IS NULL OR m.anulado = false)
    ORDER BY m.fecha DESC
    LIMIT 1;
  ELSE
    v_fecha_pago := NULL;
  END IF;

  -- Actualizar cuota
  UPDATE cuotas
  SET monto_pagado = v_total_pagado,
      estado = v_nuevo_estado,
      fecha_pago = v_fecha_pago
  WHERE id = v_cuota_id;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cuota_aplicaciones_recalc ON cuota_aplicaciones;
CREATE TRIGGER trg_cuota_aplicaciones_recalc
  AFTER INSERT OR UPDATE OR DELETE ON cuota_aplicaciones
  FOR EACH ROW EXECUTE FUNCTION fn_recalc_cuota();

-- ═══════════════════════════════════════════════════════════════
-- 1.9 Trigger: al anular movimiento, recalcular cuotas vinculadas
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_movimiento_anulado()
RETURNS TRIGGER AS $$
DECLARE
  v_cuota_id UUID;
  v_total_pagado NUMERIC;
  v_monto_esperado NUMERIC;
  v_nuevo_estado TEXT;
  v_fecha_pago DATE;
  v_vencimiento DATE;
BEGIN
  IF NEW.anulado = true AND (OLD.anulado IS NULL OR OLD.anulado = false) THEN
    -- Recalcular cada cuota vinculada a este movimiento
    FOR v_cuota_id IN
      SELECT cuota_id FROM cuota_aplicaciones WHERE movimiento_id = NEW.id
    LOOP
      -- Recalcular monto pagado (excluyendo movimientos anulados)
      SELECT COALESCE(SUM(ca.monto_aplicado), 0) INTO v_total_pagado
      FROM cuota_aplicaciones ca
      JOIN movimientos m ON m.id = ca.movimiento_id
      WHERE ca.cuota_id = v_cuota_id
        AND (m.anulado IS NULL OR m.anulado = false);

      SELECT monto_esperado, vencimiento INTO v_monto_esperado, v_vencimiento
      FROM cuotas WHERE id = v_cuota_id;

      IF v_total_pagado >= v_monto_esperado THEN
        v_nuevo_estado := 'pagada';
      ELSIF v_total_pagado > 0 THEN
        v_nuevo_estado := 'parcial';
      ELSIF v_vencimiento IS NOT NULL AND v_vencimiento < CURRENT_DATE THEN
        v_nuevo_estado := 'vencida';
      ELSE
        v_nuevo_estado := 'pendiente';
      END IF;

      IF v_nuevo_estado = 'pagada' THEN
        SELECT m.fecha INTO v_fecha_pago
        FROM cuota_aplicaciones ca
        JOIN movimientos m ON m.id = ca.movimiento_id
        WHERE ca.cuota_id = v_cuota_id
          AND (m.anulado IS NULL OR m.anulado = false)
        ORDER BY m.fecha DESC
        LIMIT 1;
      ELSE
        v_fecha_pago := NULL;
      END IF;

      UPDATE cuotas
      SET monto_pagado = v_total_pagado,
          estado = v_nuevo_estado,
          fecha_pago = v_fecha_pago
      WHERE id = v_cuota_id;
    END LOOP;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_movimiento_anulado ON movimientos;
CREATE TRIGGER trg_movimiento_anulado
  AFTER UPDATE OF anulado ON movimientos
  FOR EACH ROW EXECUTE FUNCTION fn_movimiento_anulado();

-- ═══════════════════════════════════════════════════════════════
-- 1.10 Views
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW v_cuotas_resumen AS
SELECT
  c.id,
  c.socio_id,
  s.nombre AS socio_nombre,
  s.apellido AS socio_apellido,
  c.periodo,
  c.monto_esperado,
  COALESCE(
    (SELECT SUM(ca.monto_aplicado)
     FROM cuota_aplicaciones ca
     JOIN movimientos m ON m.id = ca.movimiento_id
     WHERE ca.cuota_id = c.id
       AND (m.anulado IS NULL OR m.anulado = false)),
    0
  ) AS monto_pagado,
  c.monto_esperado - COALESCE(
    (SELECT SUM(ca.monto_aplicado)
     FROM cuota_aplicaciones ca
     JOIN movimientos m ON m.id = ca.movimiento_id
     WHERE ca.cuota_id = c.id
       AND (m.anulado IS NULL OR m.anulado = false)),
    0
  ) AS saldo,
  c.estado,
  c.vencimiento,
  (SELECT MAX(m.fecha)
   FROM cuota_aplicaciones ca
   JOIN movimientos m ON m.id = ca.movimiento_id
   WHERE ca.cuota_id = c.id
     AND (m.anulado IS NULL OR m.anulado = false)
  ) AS fecha_ultimo_pago
FROM cuotas c
JOIN socios s ON s.id = c.socio_id;

CREATE OR REPLACE VIEW v_deudas_kpis AS
SELECT
  COALESCE(SUM(c.monto_pagado) FILTER (WHERE c.estado IN ('pagada', 'parcial')), 0) AS total_recaudado,
  COALESCE(SUM(c.monto_esperado - c.monto_pagado) FILTER (WHERE c.estado IN ('pendiente', 'parcial')), 0) AS total_pendiente,
  COALESCE(SUM(c.monto_esperado - c.monto_pagado) FILTER (WHERE c.estado = 'vencida'), 0) AS total_vencido,
  CASE
    WHEN SUM(c.monto_esperado) > 0
    THEN ROUND(
      (COALESCE(SUM(c.monto_pagado) FILTER (WHERE c.estado IN ('pagada', 'parcial')), 0)::NUMERIC
       / SUM(c.monto_esperado)::NUMERIC) * 100
    )
    ELSE 0
  END AS porcentaje_cobranza
FROM cuotas c;

-- ═══════════════════════════════════════════════════════════════
-- 1.11 RLS policies para nuevas tablas
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE cuota_aplicaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE promociones_cuotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimiento_promocion_cuotas ENABLE ROW LEVEL SECURITY;

-- cuota_aplicaciones
CREATE POLICY "Authenticated users can SELECT cuota_aplicaciones"
  ON cuota_aplicaciones FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can INSERT cuota_aplicaciones"
  ON cuota_aplicaciones FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can UPDATE cuota_aplicaciones"
  ON cuota_aplicaciones FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can DELETE cuota_aplicaciones"
  ON cuota_aplicaciones FOR DELETE TO authenticated USING (true);

-- promociones_cuotas
CREATE POLICY "Authenticated users can SELECT promociones_cuotas"
  ON promociones_cuotas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can INSERT promociones_cuotas"
  ON promociones_cuotas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can UPDATE promociones_cuotas"
  ON promociones_cuotas FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can DELETE promociones_cuotas"
  ON promociones_cuotas FOR DELETE TO authenticated USING (true);

-- movimiento_promocion_cuotas
CREATE POLICY "Authenticated users can SELECT movimiento_promocion_cuotas"
  ON movimiento_promocion_cuotas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can INSERT movimiento_promocion_cuotas"
  ON movimiento_promocion_cuotas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can UPDATE movimiento_promocion_cuotas"
  ON movimiento_promocion_cuotas FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can DELETE movimiento_promocion_cuotas"
  ON movimiento_promocion_cuotas FOR DELETE TO authenticated USING (true);

-- Indexes para performance
CREATE INDEX IF NOT EXISTS idx_cuota_aplicaciones_cuota ON cuota_aplicaciones(cuota_id);
CREATE INDEX IF NOT EXISTS idx_cuota_aplicaciones_movimiento ON cuota_aplicaciones(movimiento_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_socio ON movimientos(socio_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_anulado ON movimientos(anulado);
CREATE INDEX IF NOT EXISTS idx_movimiento_promocion_movimiento ON movimiento_promocion_cuotas(movimiento_id);

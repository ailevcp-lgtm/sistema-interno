-- ============================================================
-- 002: Habilitar Row Level Security y crear politicas
-- ============================================================
-- Todas las tablas requieren RLS habilitado para que Supabase
-- no bloquee las queries desde el frontend.
-- Las politicas permiten acceso completo a usuarios autenticados.
-- El control granular de permisos se maneja en el frontend
-- con la matriz de permisos definida en lib/constants.ts.
-- ============================================================

-- ── Habilitar RLS ──────────────────────────────────────────

ALTER TABLE socios ENABLE ROW LEVEL SECURITY;
ALTER TABLE cuotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimientos ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias_financieras ENABLE ROW LEVEL SECURITY;
ALTER TABLE estatuto_articulos ENABLE ROW LEVEL SECURITY;
ALTER TABLE resoluciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE logs_actividad ENABLE ROW LEVEL SECURITY;

-- ── Politicas SELECT ───────────────────────────────────────

CREATE POLICY "auth_select" ON socios FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_select" ON cuotas FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_select" ON movimientos FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_select" ON categorias_financieras FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_select" ON estatuto_articulos FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_select" ON resoluciones FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_select" ON balances FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_select" ON logs_actividad FOR SELECT TO authenticated USING (true);

-- ── Politicas INSERT ───────────────────────────────────────

CREATE POLICY "auth_insert" ON socios FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_insert" ON cuotas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_insert" ON movimientos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_insert" ON categorias_financieras FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_insert" ON estatuto_articulos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_insert" ON resoluciones FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_insert" ON balances FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_insert" ON logs_actividad FOR INSERT TO authenticated WITH CHECK (true);

-- ── Politicas UPDATE ───────────────────────────────────────

CREATE POLICY "auth_update" ON socios FOR UPDATE TO authenticated USING (true);
CREATE POLICY "auth_update" ON cuotas FOR UPDATE TO authenticated USING (true);
CREATE POLICY "auth_update" ON movimientos FOR UPDATE TO authenticated USING (true);
CREATE POLICY "auth_update" ON categorias_financieras FOR UPDATE TO authenticated USING (true);
CREATE POLICY "auth_update" ON estatuto_articulos FOR UPDATE TO authenticated USING (true);
CREATE POLICY "auth_update" ON resoluciones FOR UPDATE TO authenticated USING (true);
CREATE POLICY "auth_update" ON balances FOR UPDATE TO authenticated USING (true);

-- ── Politicas DELETE ───────────────────────────────────────

CREATE POLICY "auth_delete" ON socios FOR DELETE TO authenticated USING (true);
CREATE POLICY "auth_delete" ON cuotas FOR DELETE TO authenticated USING (true);
CREATE POLICY "auth_delete" ON movimientos FOR DELETE TO authenticated USING (true);
CREATE POLICY "auth_delete" ON resoluciones FOR DELETE TO authenticated USING (true);
CREATE POLICY "auth_delete" ON balances FOR DELETE TO authenticated USING (true);

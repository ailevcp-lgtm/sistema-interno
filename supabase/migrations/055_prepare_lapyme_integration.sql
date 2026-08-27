-- ============================================================
-- 055: Preparacion para integracion con API de La Pyme
-- ============================================================

ALTER TABLE movimientos
  ADD COLUMN IF NOT EXISTS external_source TEXT,
  ADD COLUMN IF NOT EXISTS external_request_id TEXT,
  ADD COLUMN IF NOT EXISTS external_synced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS external_payload JSONB;

UPDATE movimientos
SET external_source = 'powerbi_import'
WHERE external_source IS NULL
  AND import_batch_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_movimientos_external_source_id
  ON movimientos(external_source, external_id)
  WHERE external_source IS NOT NULL
    AND external_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_movimientos_external_source_synced
  ON movimientos(external_source, external_synced_at DESC)
  WHERE external_source IS NOT NULL;

ALTER TABLE cuentas
  ADD COLUMN IF NOT EXISTS external_source TEXT,
  ADD COLUMN IF NOT EXISTS external_id TEXT,
  ADD COLUMN IF NOT EXISTS external_payload JSONB,
  ADD COLUMN IF NOT EXISTS external_synced_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_cuentas_external_source_id
  ON cuentas(external_source, external_id)
  WHERE external_source IS NOT NULL
    AND external_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS lapyme_sync_checkpoints (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  scope TEXT NOT NULL UNIQUE,
  last_cursor TEXT,
  last_synced_at TIMESTAMPTZ,
  last_request_id TEXT,
  status TEXT NOT NULL DEFAULT 'idle' CHECK (status IN ('idle', 'running', 'success', 'failed')),
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lapyme_account_mappings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lapyme_object_type TEXT NOT NULL,
  lapyme_object_id TEXT NOT NULL,
  lapyme_object_name TEXT,
  local_table TEXT NOT NULL CHECK (local_table IN ('cuentas', 'categorias_financieras', 'subcategorias_financieras')),
  local_id UUID NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(lapyme_object_type, lapyme_object_id, local_table)
);

ALTER TABLE lapyme_sync_checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE lapyme_account_mappings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lapyme_sync_checkpoints_select_guard ON lapyme_sync_checkpoints;
CREATE POLICY lapyme_sync_checkpoints_select_guard ON lapyme_sync_checkpoints
  FOR SELECT TO authenticated
  USING (
    fn_has_resource_permission('finanzas', 'ver')
    OR fn_has_resource_permission('tesoreria', 'ver')
  );

DROP POLICY IF EXISTS lapyme_sync_checkpoints_insert_guard ON lapyme_sync_checkpoints;
CREATE POLICY lapyme_sync_checkpoints_insert_guard ON lapyme_sync_checkpoints
  FOR INSERT TO authenticated
  WITH CHECK (
    fn_has_resource_permission('finanzas', 'editar')
    OR fn_has_resource_permission('tesoreria', 'editar')
  );

DROP POLICY IF EXISTS lapyme_sync_checkpoints_update_guard ON lapyme_sync_checkpoints;
CREATE POLICY lapyme_sync_checkpoints_update_guard ON lapyme_sync_checkpoints
  FOR UPDATE TO authenticated
  USING (
    fn_has_resource_permission('finanzas', 'editar')
    OR fn_has_resource_permission('tesoreria', 'editar')
  )
  WITH CHECK (
    fn_has_resource_permission('finanzas', 'editar')
    OR fn_has_resource_permission('tesoreria', 'editar')
  );

DROP POLICY IF EXISTS lapyme_account_mappings_select_guard ON lapyme_account_mappings;
CREATE POLICY lapyme_account_mappings_select_guard ON lapyme_account_mappings
  FOR SELECT TO authenticated
  USING (
    fn_has_resource_permission('finanzas', 'ver')
    OR fn_has_resource_permission('tesoreria', 'ver')
  );

DROP POLICY IF EXISTS lapyme_account_mappings_insert_guard ON lapyme_account_mappings;
CREATE POLICY lapyme_account_mappings_insert_guard ON lapyme_account_mappings
  FOR INSERT TO authenticated
  WITH CHECK (
    fn_has_resource_permission('finanzas', 'editar')
    OR fn_has_resource_permission('tesoreria', 'editar')
  );

DROP POLICY IF EXISTS lapyme_account_mappings_update_guard ON lapyme_account_mappings;
CREATE POLICY lapyme_account_mappings_update_guard ON lapyme_account_mappings
  FOR UPDATE TO authenticated
  USING (
    fn_has_resource_permission('finanzas', 'editar')
    OR fn_has_resource_permission('tesoreria', 'editar')
  )
  WITH CHECK (
    fn_has_resource_permission('finanzas', 'editar')
    OR fn_has_resource_permission('tesoreria', 'editar')
  );

INSERT INTO lapyme_sync_checkpoints (scope)
VALUES
  ('warehouses'),
  ('payment_methods'),
  ('accounting_accounts'),
  ('customer_collections'),
  ('supplier_payments'),
  ('journal_entries')
ON CONFLICT (scope) DO NOTHING;

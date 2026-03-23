-- ============================================================
-- 050: Add storage policies for propuestas folder in documentos bucket
-- ============================================================

DROP POLICY IF EXISTS documentos_propuestas_insert_guard ON storage.objects;
DROP POLICY IF EXISTS documentos_propuestas_update_guard ON storage.objects;
DROP POLICY IF EXISTS documentos_propuestas_delete_guard ON storage.objects;

CREATE POLICY documentos_propuestas_insert_guard
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documentos'
  AND name LIKE 'propuestas/%'
  AND (
    fn_has_resource_permission('propuestas', 'crear')
    OR fn_has_resource_permission('propuestas', 'editar')
  )
);

CREATE POLICY documentos_propuestas_update_guard
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'documentos'
  AND name LIKE 'propuestas/%'
  AND (
    fn_has_resource_permission('propuestas', 'editar')
    OR fn_has_resource_permission('propuestas', 'eliminar')
  )
)
WITH CHECK (
  bucket_id = 'documentos'
  AND name LIKE 'propuestas/%'
  AND (
    fn_has_resource_permission('propuestas', 'editar')
    OR fn_has_resource_permission('propuestas', 'eliminar')
  )
);

CREATE POLICY documentos_propuestas_delete_guard
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'documentos'
  AND name LIKE 'propuestas/%'
  AND (
    fn_has_resource_permission('propuestas', 'editar')
    OR fn_has_resource_permission('propuestas', 'eliminar')
  )
);

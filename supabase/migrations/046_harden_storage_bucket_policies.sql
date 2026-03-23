-- ============================================================
-- 046: Harden storage bucket policies for internal documents
-- ============================================================

-- Avatars: keep public read, remove anonymous write surface.
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload an avatar" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update their own avatar" ON storage.objects;
DROP POLICY IF EXISTS avatars_public_read ON storage.objects;
DROP POLICY IF EXISTS avatars_authenticated_insert ON storage.objects;
DROP POLICY IF EXISTS avatars_authenticated_update ON storage.objects;
DROP POLICY IF EXISTS avatars_authenticated_delete ON storage.objects;

CREATE POLICY avatars_public_read
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'avatars');

CREATE POLICY avatars_authenticated_insert
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'avatars');

CREATE POLICY avatars_authenticated_update
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'avatars')
WITH CHECK (bucket_id = 'avatars');

CREATE POLICY avatars_authenticated_delete
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'avatars');

-- Documentos: keep public read for existing URLs, but restrict writes by folder + permission.
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Auth Upload" ON storage.objects;
DROP POLICY IF EXISTS "Auth Update" ON storage.objects;
DROP POLICY IF EXISTS "Auth Delete" ON storage.objects;
DROP POLICY IF EXISTS documentos_public_read ON storage.objects;
DROP POLICY IF EXISTS documentos_balances_insert_guard ON storage.objects;
DROP POLICY IF EXISTS documentos_balances_update_guard ON storage.objects;
DROP POLICY IF EXISTS documentos_balances_delete_guard ON storage.objects;
DROP POLICY IF EXISTS documentos_resoluciones_insert_guard ON storage.objects;
DROP POLICY IF EXISTS documentos_resoluciones_update_guard ON storage.objects;
DROP POLICY IF EXISTS documentos_resoluciones_delete_guard ON storage.objects;
DROP POLICY IF EXISTS documentos_decretos_insert_guard ON storage.objects;
DROP POLICY IF EXISTS documentos_decretos_update_guard ON storage.objects;
DROP POLICY IF EXISTS documentos_decretos_delete_guard ON storage.objects;

CREATE POLICY documentos_public_read
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'documentos');

CREATE POLICY documentos_balances_insert_guard
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documentos'
  AND name LIKE 'balances/%'
  AND (
    fn_has_resource_permission('balances', 'crear')
    OR fn_has_resource_permission('balances', 'editar')
  )
);

CREATE POLICY documentos_balances_update_guard
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'documentos'
  AND name LIKE 'balances/%'
  AND (
    fn_has_resource_permission('balances', 'editar')
    OR fn_has_resource_permission('balances', 'eliminar')
  )
)
WITH CHECK (
  bucket_id = 'documentos'
  AND name LIKE 'balances/%'
  AND (
    fn_has_resource_permission('balances', 'editar')
    OR fn_has_resource_permission('balances', 'eliminar')
  )
);

CREATE POLICY documentos_balances_delete_guard
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'documentos'
  AND name LIKE 'balances/%'
  AND (
    fn_has_resource_permission('balances', 'editar')
    OR fn_has_resource_permission('balances', 'eliminar')
  )
);

CREATE POLICY documentos_resoluciones_insert_guard
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documentos'
  AND name LIKE 'resoluciones/%'
  AND (
    fn_has_resource_permission('resoluciones', 'crear')
    OR fn_has_resource_permission('resoluciones', 'editar')
  )
);

CREATE POLICY documentos_resoluciones_update_guard
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'documentos'
  AND name LIKE 'resoluciones/%'
  AND (
    fn_has_resource_permission('resoluciones', 'editar')
    OR fn_has_resource_permission('resoluciones', 'eliminar')
  )
)
WITH CHECK (
  bucket_id = 'documentos'
  AND name LIKE 'resoluciones/%'
  AND (
    fn_has_resource_permission('resoluciones', 'editar')
    OR fn_has_resource_permission('resoluciones', 'eliminar')
  )
);

CREATE POLICY documentos_resoluciones_delete_guard
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'documentos'
  AND name LIKE 'resoluciones/%'
  AND (
    fn_has_resource_permission('resoluciones', 'editar')
    OR fn_has_resource_permission('resoluciones', 'eliminar')
  )
);

CREATE POLICY documentos_decretos_insert_guard
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documentos'
  AND name LIKE 'decretos/%'
  AND (
    fn_has_resource_permission('resoluciones', 'crear')
    OR fn_has_resource_permission('resoluciones', 'editar')
  )
);

CREATE POLICY documentos_decretos_update_guard
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'documentos'
  AND name LIKE 'decretos/%'
  AND (
    fn_has_resource_permission('resoluciones', 'editar')
    OR fn_has_resource_permission('resoluciones', 'eliminar')
  )
)
WITH CHECK (
  bucket_id = 'documentos'
  AND name LIKE 'decretos/%'
  AND (
    fn_has_resource_permission('resoluciones', 'editar')
    OR fn_has_resource_permission('resoluciones', 'eliminar')
  )
);

CREATE POLICY documentos_decretos_delete_guard
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'documentos'
  AND name LIKE 'decretos/%'
  AND (
    fn_has_resource_permission('resoluciones', 'editar')
    OR fn_has_resource_permission('resoluciones', 'eliminar')
  )
);

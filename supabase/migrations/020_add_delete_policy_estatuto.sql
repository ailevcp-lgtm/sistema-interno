-- ============================================================
-- 020: Add DELETE policy for estatuto_articulos
-- ============================================================

-- The previous RLS policies missed the DELETE operation for estatuto_articulos.
-- This is required for the bulk import feature which clears the table before inserting.

CREATE POLICY "auth_delete" ON estatuto_articulos
    FOR DELETE TO authenticated USING (true);

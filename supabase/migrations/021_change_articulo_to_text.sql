-- ============================================================
-- 021: Change estatuto_articulos.articulo to TEXT
-- ============================================================

-- Only proceed if column exists and is not already text. 
-- Since we know it is likely INTEGER and we want TEXT:

ALTER TABLE estatuto_articulos 
ALTER COLUMN articulo TYPE TEXT USING articulo::text;

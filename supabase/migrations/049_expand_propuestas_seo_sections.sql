ALTER TABLE public.propuestas ADD COLUMN IF NOT EXISTS descripcion_corta text;
ALTER TABLE public.propuestas ADD COLUMN IF NOT EXISTS pie_imagen_principal text;
ALTER TABLE public.propuestas ADD COLUMN IF NOT EXISTS autor character varying;
ALTER TABLE public.propuestas ADD COLUMN IF NOT EXISTS categoria character varying;
ALTER TABLE public.propuestas ADD COLUMN IF NOT EXISTS palabras_clave text[] DEFAULT '{}'::text[];
ALTER TABLE public.propuestas ADD COLUMN IF NOT EXISTS seo_titulo character varying;
ALTER TABLE public.propuestas ADD COLUMN IF NOT EXISTS seo_descripcion text;
ALTER TABLE public.propuestas ADD COLUMN IF NOT EXISTS secciones jsonb DEFAULT '[]'::jsonb;

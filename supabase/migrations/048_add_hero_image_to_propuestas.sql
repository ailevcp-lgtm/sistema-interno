-- Add hero_image_url to propuestas
ALTER TABLE public.propuestas ADD COLUMN IF NOT EXISTS hero_image_url text;

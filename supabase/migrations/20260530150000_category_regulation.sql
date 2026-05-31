-- Reglamento por categoría o a nivel de competición (URL externa o fichero subido)

ALTER TABLE public.competition_categories
  ADD COLUMN IF NOT EXISTS regulation_url text,
  ADD COLUMN IF NOT EXISTS regulation_file_path text,
  ADD COLUMN IF NOT EXISTS regulation_file_name text;

ALTER TABLE public.competitions
  ADD COLUMN IF NOT EXISTS regulation_url text,
  ADD COLUMN IF NOT EXISTS regulation_file_path text,
  ADD COLUMN IF NOT EXISTS regulation_file_name text;

COMMENT ON COLUMN public.competition_categories.regulation_url IS
  'URL externa del reglamento de la categoría; mutuamente excluyente con regulation_file_path';
COMMENT ON COLUMN public.competition_categories.regulation_file_path IS
  'Ruta en bucket competition-regulations';
COMMENT ON COLUMN public.competitions.regulation_url IS
  'URL externa del reglamento global (cuando no hay categorías)';
COMMENT ON COLUMN public.competitions.regulation_file_path IS
  'Ruta en bucket competition-regulations para reglamento global';

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'competition-regulations',
  'competition-regulations',
  true,
  10485760,
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]::text[]
)
ON CONFLICT (id) DO NOTHING;

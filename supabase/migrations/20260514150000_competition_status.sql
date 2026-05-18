-- Ciclo de vida interno de competición (borrador / publicada / en curso / cerrada)

ALTER TABLE public.competitions
  ADD COLUMN IF NOT EXISTS status text;

UPDATE public.competitions
SET status = 'published'
WHERE status IS NULL;

ALTER TABLE public.competitions
  ALTER COLUMN status SET DEFAULT 'published',
  ALTER COLUMN status SET NOT NULL;

ALTER TABLE public.competitions
  DROP CONSTRAINT IF EXISTS competitions_status_check;

ALTER TABLE public.competitions
  ADD CONSTRAINT competitions_status_check
  CHECK (status IN ('draft', 'published', 'running', 'closed'));

-- Token de acceso compartible para modo árbitro (misma migración que supabase/migrations/20260530120000_competition_referee_token.sql)
ALTER TABLE public.competitions
  ADD COLUMN IF NOT EXISTS referee_access_token text UNIQUE;

CREATE INDEX IF NOT EXISTS idx_competitions_referee_token
  ON public.competitions(referee_access_token)
  WHERE referee_access_token IS NOT NULL;

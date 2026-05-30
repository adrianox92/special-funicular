-- Token de acceso compartible para modo árbitro (registro de tiempos sin login).
ALTER TABLE public.competitions
  ADD COLUMN IF NOT EXISTS referee_access_token text UNIQUE;

CREATE INDEX IF NOT EXISTS idx_competitions_referee_token
  ON public.competitions(referee_access_token)
  WHERE referee_access_token IS NOT NULL;

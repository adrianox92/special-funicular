-- Modo Liga: agrupa varias competiciones con inscripciones y puntuación acumulada

CREATE TABLE IF NOT EXISTS public.leagues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  club_id uuid REFERENCES public.clubs(id) ON DELETE SET NULL,
  organizer uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'draft'
    CONSTRAINT leagues_status_check CHECK (status IN ('draft', 'published', 'running', 'closed')),
  scoring_mode text NOT NULL DEFAULT 'league_rules'
    CONSTRAINT leagues_scoring_mode_check CHECK (scoring_mode IN ('league_rules', 'per_competition')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leagues_organizer ON public.leagues(organizer);
CREATE INDEX IF NOT EXISTS idx_leagues_club_id ON public.leagues(club_id);
CREATE INDEX IF NOT EXISTS idx_leagues_slug ON public.leagues(slug);

CREATE TABLE IF NOT EXISTS public.league_competitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  competition_id uuid NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (league_id, competition_id)
);

CREATE INDEX IF NOT EXISTS idx_league_competitions_league_id ON public.league_competitions(league_id);
CREATE INDEX IF NOT EXISTS idx_league_competitions_competition_id ON public.league_competitions(competition_id);

CREATE TABLE IF NOT EXISTS public.league_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text,
  vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  vehicle_model text,
  registered_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'confirmed'
    CONSTRAINT league_participants_status_check CHECK (status IN ('confirmed', 'waitlist')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_league_participants_league_id ON public.league_participants(league_id);

ALTER TABLE public.competition_rules
  ADD COLUMN IF NOT EXISTS league_id uuid REFERENCES public.leagues(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_competition_rules_league_id ON public.competition_rules(league_id);

CREATE OR REPLACE FUNCTION public.set_leagues_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_leagues_updated_at ON public.leagues;
CREATE TRIGGER trg_leagues_updated_at
  BEFORE UPDATE ON public.leagues
  FOR EACH ROW
  EXECUTE FUNCTION public.set_leagues_updated_at();

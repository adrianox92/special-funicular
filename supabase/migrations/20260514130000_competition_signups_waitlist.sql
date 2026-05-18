-- Lista de espera en inscripciones públicas / miembro

ALTER TABLE public.competition_signups
  ADD COLUMN IF NOT EXISTS is_waitlist boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS waitlist_position integer;

CREATE INDEX IF NOT EXISTS idx_competition_signups_waitlist
  ON public.competition_signups (competition_id, is_waitlist, waitlist_position);

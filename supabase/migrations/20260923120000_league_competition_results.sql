-- Resultados explícitos de liga por piloto × prueba (DNS / DSQ).
-- DNS y DSQ valen 0 pts y SÍ ocupan plaza de descarte (counting_races).
-- Quien no tiene fila aquí ni aparece en el cálculo de la prueba NO consume descarte.
-- DNF no se modela aquí: puntos/posición salen del resultado de la competición.

CREATE TABLE IF NOT EXISTS public.league_competition_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  competition_id uuid NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
  league_participant_id uuid NOT NULL REFERENCES public.league_participants(id) ON DELETE CASCADE,
  result_status text NOT NULL
    CONSTRAINT league_competition_results_status_check
    CHECK (result_status IN ('dns', 'dsq')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (league_id, competition_id, league_participant_id)
);

CREATE INDEX IF NOT EXISTS idx_league_competition_results_league_id
  ON public.league_competition_results(league_id);

CREATE INDEX IF NOT EXISTS idx_league_competition_results_competition_id
  ON public.league_competition_results(competition_id);

CREATE INDEX IF NOT EXISTS idx_league_competition_results_participant_id
  ON public.league_competition_results(league_participant_id);

COMMENT ON TABLE public.league_competition_results IS
  'Marcas DNS/DSQ de liga: 0 puntos y ocupan descarte. Ausencia de fila = no inscrito en esa prueba.';

COMMENT ON COLUMN public.league_competition_results.result_status IS
  'dns = no disputa (0 pts, consume descarte). dsq = descalificado (igual que DNS respecto a descartes).';

CREATE OR REPLACE FUNCTION public.set_league_competition_results_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_league_competition_results_updated_at ON public.league_competition_results;
CREATE TRIGGER trg_league_competition_results_updated_at
  BEFORE UPDATE ON public.league_competition_results
  FOR EACH ROW
  EXECUTE FUNCTION public.set_league_competition_results_updated_at();

ALTER TABLE public.league_competition_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS league_competition_results_select ON public.league_competition_results;
CREATE POLICY league_competition_results_select ON public.league_competition_results
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.leagues l
      WHERE l.id = league_competition_results.league_id
        AND (
          l.status <> 'draft'
          OR l.organizer = auth.uid()
          OR (
            l.club_id IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM public.club_members cm
              WHERE cm.club_id = l.club_id AND cm.user_id = auth.uid()
            )
          )
        )
    )
  );

DROP POLICY IF EXISTS league_competition_results_modify ON public.league_competition_results;
CREATE POLICY league_competition_results_modify ON public.league_competition_results
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.leagues l
      WHERE l.id = league_competition_results.league_id AND l.organizer = auth.uid()
    )
  );

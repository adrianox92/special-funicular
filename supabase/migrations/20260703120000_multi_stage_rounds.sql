-- Competiciones multi-tramo (rally): circuito opcional por ronda

ALTER TABLE public.competitions
  ADD COLUMN IF NOT EXISTS is_multi_stage boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.competitions.is_multi_stage IS
  'Si true, cada ronda puede tener un circuito distinto (competition_round_stages).';

CREATE TABLE IF NOT EXISTS public.competition_round_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id uuid NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
  round_number integer NOT NULL CHECK (round_number >= 1),
  circuit_id uuid REFERENCES public.circuits(id) ON DELETE SET NULL,
  circuit_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (competition_id, round_number)
);

CREATE INDEX IF NOT EXISTS idx_competition_round_stages_competition_id
  ON public.competition_round_stages(competition_id);

COMMENT ON TABLE public.competition_round_stages IS
  'Circuito opcional por ronda en competiciones multi-tramo. Si circuit_id es null, se usa el circuito por defecto de la competición.';

ALTER TABLE public.competition_round_stages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS competition_round_stages_select ON public.competition_round_stages;
CREATE POLICY competition_round_stages_select ON public.competition_round_stages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.competitions c
      WHERE c.id = competition_round_stages.competition_id
        AND (
          c.organizer = auth.uid()
          OR (
            c.club_id IS NOT NULL
            AND (
              EXISTS (
                SELECT 1 FROM public.club_members m
                WHERE m.club_id = c.club_id AND m.user_id = auth.uid()
              )
              OR EXISTS (
                SELECT 1 FROM public.clubs cl
                WHERE cl.id = c.club_id AND cl.owner_user_id = auth.uid()
              )
            )
          )
        )
    )
  );

DROP POLICY IF EXISTS competition_round_stages_modify ON public.competition_round_stages;
CREATE POLICY competition_round_stages_modify ON public.competition_round_stages
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.competitions c
      WHERE c.id = competition_round_stages.competition_id
        AND c.organizer = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.competitions c
      WHERE c.id = competition_round_stages.competition_id
        AND c.organizer = auth.uid()
    )
  );

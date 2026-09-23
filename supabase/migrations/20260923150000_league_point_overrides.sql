-- Overrides auditados de puntos a nivel liga (piloto × prueba).
-- Prioridad de puntos efectivos: override > marca DNS/DSQ > puntos calculados.
-- Quitar la fila restaura el valor automático (resultado / DNS / DSQ / no figura).
-- No sustituye league_competition_results: un override puede existir encima de DNS/DSQ.

CREATE TABLE IF NOT EXISTS public.league_point_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  competition_id uuid NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
  league_participant_id uuid NOT NULL REFERENCES public.league_participants(id) ON DELETE CASCADE,
  points numeric NOT NULL
    CONSTRAINT league_point_overrides_points_check
    CHECK (points >= 0 AND points <= 9999),
  reason text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by_label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (league_id, competition_id, league_participant_id),
  CONSTRAINT league_point_overrides_reason_len
    CHECK (reason IS NULL OR char_length(reason) <= 140)
);

CREATE INDEX IF NOT EXISTS idx_league_point_overrides_league_id
  ON public.league_point_overrides(league_id);

CREATE INDEX IF NOT EXISTS idx_league_point_overrides_competition_id
  ON public.league_point_overrides(competition_id);

CREATE INDEX IF NOT EXISTS idx_league_point_overrides_participant_id
  ON public.league_point_overrides(league_participant_id);

COMMENT ON TABLE public.league_point_overrides IS
  'Ajuste auditado de puntos por piloto × prueba. Gana a DNS/DSQ y al cálculo automático al sumar la general.';

COMMENT ON COLUMN public.league_point_overrides.points IS
  'Puntos efectivos de la celda. Sustituyen resultado calculado o marca DNS/DSQ.';

COMMENT ON COLUMN public.league_point_overrides.reason IS
  'Motivo corto opcional (visible como nota de “ajustado”).';

COMMENT ON COLUMN public.league_point_overrides.updated_by_label IS
  'Etiqueta de autor (nombre, nunca email) para mostrar auditoría sin exponer credenciales.';

CREATE OR REPLACE FUNCTION public.set_league_point_overrides_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_league_point_overrides_updated_at ON public.league_point_overrides;
CREATE TRIGGER trg_league_point_overrides_updated_at
  BEFORE UPDATE ON public.league_point_overrides
  FOR EACH ROW
  EXECUTE FUNCTION public.set_league_point_overrides_updated_at();

ALTER TABLE public.league_point_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS league_point_overrides_select ON public.league_point_overrides;
CREATE POLICY league_point_overrides_select ON public.league_point_overrides
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.leagues l
      WHERE l.id = league_point_overrides.league_id
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

DROP POLICY IF EXISTS league_point_overrides_modify ON public.league_point_overrides;
CREATE POLICY league_point_overrides_modify ON public.league_point_overrides
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.leagues l
      WHERE l.id = league_point_overrides.league_id AND l.organizer = auth.uid()
    )
  );

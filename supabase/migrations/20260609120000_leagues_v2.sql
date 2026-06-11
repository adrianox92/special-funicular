-- Mejoras de ligas: descartes, cupo, desempates, palmarés y RLS

ALTER TABLE public.leagues
  ADD COLUMN IF NOT EXISTS counting_races integer,
  ADD COLUMN IF NOT EXISTS max_participants integer,
  ADD COLUMN IF NOT EXISTS tiebreak_mode text NOT NULL DEFAULT 'competitions_completed';

ALTER TABLE public.leagues
  DROP CONSTRAINT IF EXISTS leagues_counting_races_check;
ALTER TABLE public.leagues
  ADD CONSTRAINT leagues_counting_races_check
    CHECK (counting_races IS NULL OR counting_races > 0);

ALTER TABLE public.leagues
  DROP CONSTRAINT IF EXISTS leagues_max_participants_check;
ALTER TABLE public.leagues
  ADD CONSTRAINT leagues_max_participants_check
    CHECK (max_participants IS NULL OR max_participants > 0);

ALTER TABLE public.leagues
  DROP CONSTRAINT IF EXISTS leagues_tiebreak_mode_check;
ALTER TABLE public.leagues
  ADD CONSTRAINT leagues_tiebreak_mode_check
    CHECK (tiebreak_mode IN ('competitions_completed', 'most_wins', 'last_race_position'));

ALTER TABLE public.vehicle_palmares
  ADD COLUMN IF NOT EXISTS league_id uuid REFERENCES public.leagues(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS league_position integer;

CREATE INDEX IF NOT EXISTS idx_vehicle_palmares_league_id
  ON public.vehicle_palmares(league_id)
  WHERE league_id IS NOT NULL;

-- RLS en tablas de liga
ALTER TABLE public.leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.league_competitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.league_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS leagues_select_visible ON public.leagues;
CREATE POLICY leagues_select_visible ON public.leagues
  FOR SELECT USING (
    status <> 'draft'
    OR organizer = auth.uid()
    OR (
      club_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.club_members cm
        WHERE cm.club_id = leagues.club_id AND cm.user_id = auth.uid()
      )
    )
    OR EXISTS (
      SELECT 1 FROM public.clubs c
      WHERE c.id = leagues.club_id AND c.owner_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS leagues_insert_organizer ON public.leagues;
CREATE POLICY leagues_insert_organizer ON public.leagues
  FOR INSERT WITH CHECK (organizer = auth.uid());

DROP POLICY IF EXISTS leagues_update_organizer ON public.leagues;
CREATE POLICY leagues_update_organizer ON public.leagues
  FOR UPDATE USING (organizer = auth.uid());

DROP POLICY IF EXISTS leagues_delete_organizer ON public.leagues;
CREATE POLICY leagues_delete_organizer ON public.leagues
  FOR DELETE USING (organizer = auth.uid());

DROP POLICY IF EXISTS league_competitions_select ON public.league_competitions;
CREATE POLICY league_competitions_select ON public.league_competitions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.leagues l
      WHERE l.id = league_competitions.league_id
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

DROP POLICY IF EXISTS league_competitions_modify ON public.league_competitions;
CREATE POLICY league_competitions_modify ON public.league_competitions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.leagues l
      WHERE l.id = league_competitions.league_id AND l.organizer = auth.uid()
    )
  );

DROP POLICY IF EXISTS league_participants_select ON public.league_participants;
CREATE POLICY league_participants_select ON public.league_participants
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.leagues l
      WHERE l.id = league_participants.league_id
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

DROP POLICY IF EXISTS league_participants_insert ON public.league_participants;
CREATE POLICY league_participants_insert ON public.league_participants
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.leagues l
      WHERE l.id = league_participants.league_id
        AND l.status <> 'closed'
        AND (
          l.organizer = auth.uid()
          OR l.status IN ('published', 'running')
        )
    )
  );

DROP POLICY IF EXISTS league_participants_modify ON public.league_participants;
CREATE POLICY league_participants_modify ON public.league_participants
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.leagues l
      WHERE l.id = league_participants.league_id AND l.organizer = auth.uid()
    )
  );

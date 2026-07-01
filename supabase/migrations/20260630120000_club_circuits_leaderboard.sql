-- Circuitos de club + flag leaderboard público

ALTER TABLE public.clubs
  ADD COLUMN IF NOT EXISTS leaderboard_public boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.clubs.leaderboard_public IS 'Si true, los circuitos del club y sus rankings son visibles en la ficha pública.';

ALTER TABLE public.circuits
  ADD COLUMN IF NOT EXISTS club_id uuid REFERENCES public.clubs(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_circuits_club_id ON public.circuits(club_id);

ALTER TABLE public.circuits DROP CONSTRAINT IF EXISTS circuits_user_id_name_unique;

CREATE UNIQUE INDEX IF NOT EXISTS circuits_club_id_name_unique
  ON public.circuits (club_id, name)
  WHERE club_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS circuits_user_id_name_personal_unique
  ON public.circuits (user_id, name)
  WHERE club_id IS NULL;

ALTER TABLE public.circuits DROP CONSTRAINT IF EXISTS circuits_scope_check;
ALTER TABLE public.circuits ADD CONSTRAINT circuits_scope_check CHECK (
  (club_id IS NULL AND user_id IS NOT NULL)
  OR (club_id IS NOT NULL)
);

COMMENT ON COLUMN public.circuits.club_id IS 'Si no es null, circuito canónico del club (compartido entre miembros).';

-- RLS: miembros del club pueden ver circuitos del club
DROP POLICY IF EXISTS "Users can view own circuits" ON public.circuits;
CREATE POLICY "Users can view own circuits"
  ON public.circuits FOR SELECT
  USING (
    auth.uid() = user_id
    OR (
      club_id IS NOT NULL
      AND (
        EXISTS (
          SELECT 1 FROM public.club_members m
          WHERE m.club_id = circuits.club_id AND m.user_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1 FROM public.clubs c
          WHERE c.id = circuits.club_id AND c.owner_user_id = auth.uid()
        )
      )
    )
  );

DROP POLICY IF EXISTS "Users can insert own circuits" ON public.circuits;
CREATE POLICY "Users can insert own circuits"
  ON public.circuits FOR INSERT
  WITH CHECK (
    (club_id IS NULL AND auth.uid() = user_id)
    OR (
      club_id IS NOT NULL
      AND auth.uid() = user_id
      AND (
        EXISTS (
          SELECT 1 FROM public.club_members m
          WHERE m.club_id = circuits.club_id AND m.user_id = auth.uid() AND m.role = 'admin'
        )
        OR EXISTS (
          SELECT 1 FROM public.clubs c
          WHERE c.id = circuits.club_id AND c.owner_user_id = auth.uid()
        )
      )
    )
  );

DROP POLICY IF EXISTS "Users can update own circuits" ON public.circuits;
CREATE POLICY "Users can update own circuits"
  ON public.circuits FOR UPDATE
  USING (
    (club_id IS NULL AND auth.uid() = user_id)
    OR (
      club_id IS NOT NULL
      AND (
        EXISTS (
          SELECT 1 FROM public.club_members m
          WHERE m.club_id = circuits.club_id AND m.user_id = auth.uid() AND m.role = 'admin'
        )
        OR EXISTS (
          SELECT 1 FROM public.clubs c
          WHERE c.id = circuits.club_id AND c.owner_user_id = auth.uid()
        )
      )
    )
  );

DROP POLICY IF EXISTS "Users can delete own circuits" ON public.circuits;
CREATE POLICY "Users can delete own circuits"
  ON public.circuits FOR DELETE
  USING (
    (club_id IS NULL AND auth.uid() = user_id)
    OR (
      club_id IS NOT NULL
      AND (
        EXISTS (
          SELECT 1 FROM public.club_members m
          WHERE m.club_id = circuits.club_id AND m.user_id = auth.uid() AND m.role = 'admin'
        )
        OR EXISTS (
          SELECT 1 FROM public.clubs c
          WHERE c.id = circuits.club_id AND c.owner_user_id = auth.uid()
        )
      )
    )
  );

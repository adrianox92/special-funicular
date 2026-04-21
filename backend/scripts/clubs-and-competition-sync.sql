-- Copia para SQL Editor (Supabase): clubes, miembros, invitaciones, competiciones.club_id,
-- updated_at / external_status en competiciones, app_installations.club_id, trigger y RLS.
-- Mantener alineado con supabase/migrations/20260419120000_clubs_and_competition_sync.sql

-- Clubes, miembros, invitaciones y vínculo con competiciones / licencias multi-PC

CREATE TABLE IF NOT EXISTS public.clubs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  license_installations_max integer NOT NULL DEFAULT 10
    CONSTRAINT clubs_license_installations_max_check CHECK (license_installations_max > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clubs_owner_user_id ON public.clubs(owner_user_id);

CREATE TABLE IF NOT EXISTS public.club_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (club_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_club_members_user_id ON public.club_members(user_id);
CREATE INDEX IF NOT EXISTS idx_club_members_club_id ON public.club_members(club_id);

CREATE TABLE IF NOT EXISTS public.club_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_club_invitations_token ON public.club_invitations(token);

ALTER TABLE public.competitions
  ADD COLUMN IF NOT EXISTS club_id uuid REFERENCES public.clubs(id) ON DELETE SET NULL;

ALTER TABLE public.competitions
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE public.competitions
  ADD COLUMN IF NOT EXISTS external_status text;

COMMENT ON COLUMN public.competitions.external_status IS 'Estado opcional sincronizado desde Slot Race Manager (DRAFT/RUNNING/FINISHED).';

CREATE INDEX IF NOT EXISTS idx_competitions_club_id ON public.competitions(club_id);

ALTER TABLE public.app_installations
  ADD COLUMN IF NOT EXISTS club_id uuid REFERENCES public.clubs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_app_installations_club_id ON public.app_installations(club_id);

-- Trigger: actualizar updated_at en competiciones
CREATE OR REPLACE FUNCTION public.set_competitions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_competitions_updated_at ON public.competitions;
CREATE TRIGGER trg_competitions_updated_at
  BEFORE UPDATE ON public.competitions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_competitions_updated_at();

-- RLS (acceso directo desde cliente Supabase; el backend usa service role y la omite)
ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clubs_select_member" ON public.clubs;
CREATE POLICY "clubs_select_member" ON public.clubs
  FOR SELECT USING (
    owner_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.club_members m
      WHERE m.club_id = clubs.id AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "clubs_insert_owner" ON public.clubs;
CREATE POLICY "clubs_insert_owner" ON public.clubs
  FOR INSERT WITH CHECK (owner_user_id = auth.uid());

DROP POLICY IF EXISTS "clubs_update_owner" ON public.clubs;
CREATE POLICY "clubs_update_owner" ON public.clubs
  FOR UPDATE USING (owner_user_id = auth.uid());

DROP POLICY IF EXISTS "clubs_delete_owner" ON public.clubs;
CREATE POLICY "clubs_delete_owner" ON public.clubs
  FOR DELETE USING (owner_user_id = auth.uid());

DROP POLICY IF EXISTS "club_members_select" ON public.club_members;
CREATE POLICY "club_members_select" ON public.club_members
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.clubs c
      WHERE c.id = club_members.club_id AND c.owner_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.club_members m2
      WHERE m2.club_id = club_members.club_id AND m2.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "club_members_insert_admin" ON public.club_members;
CREATE POLICY "club_members_insert_admin" ON public.club_members
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.clubs c
      WHERE c.id = club_id AND c.owner_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.club_members m
      WHERE m.club_id = club_members.club_id
        AND m.user_id = auth.uid()
        AND m.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "club_members_delete_self_or_admin" ON public.club_members;
CREATE POLICY "club_members_delete_self_or_admin" ON public.club_members
  FOR DELETE USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.clubs c
      WHERE c.id = club_id AND c.owner_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.club_members m
      WHERE m.club_id = club_members.club_id
        AND m.user_id = auth.uid()
        AND m.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "club_invitations_select" ON public.club_invitations;
CREATE POLICY "club_invitations_select" ON public.club_invitations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.clubs c
      WHERE c.id = club_invitations.club_id AND c.owner_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.club_members m
      WHERE m.club_id = club_invitations.club_id
        AND m.user_id = auth.uid()
        AND m.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "club_invitations_insert_admin" ON public.club_invitations;
CREATE POLICY "club_invitations_insert_admin" ON public.club_invitations
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.clubs c
      WHERE c.id = club_id AND c.owner_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.club_members m
      WHERE m.club_id = club_invitations.club_id
        AND m.user_id = auth.uid()
        AND m.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "club_invitations_delete_admin" ON public.club_invitations;
CREATE POLICY "club_invitations_delete_admin" ON public.club_invitations
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.clubs c
      WHERE c.id = club_invitations.club_id AND c.owner_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.club_members m
      WHERE m.club_id = club_invitations.club_id
        AND m.user_id = auth.uid()
        AND m.role = 'admin'
    )
  );

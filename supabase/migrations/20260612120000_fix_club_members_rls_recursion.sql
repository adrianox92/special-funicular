-- Evita recursión infinita en políticas RLS que consultan club_members desde club_members
-- (o desde otras tablas cuya política consulta club_members, como league_participants).

CREATE OR REPLACE FUNCTION public.is_club_member(p_club_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_club_id IS NOT NULL
    AND p_user_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.club_members
      WHERE club_id = p_club_id AND user_id = p_user_id
    );
$$;

CREATE OR REPLACE FUNCTION public.is_club_admin(p_club_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_club_id IS NOT NULL
    AND p_user_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.club_members
      WHERE club_id = p_club_id
        AND user_id = p_user_id
        AND role = 'admin'
    );
$$;

CREATE OR REPLACE FUNCTION public.is_club_owner(p_club_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_club_id IS NOT NULL
    AND p_user_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.clubs
      WHERE id = p_club_id AND owner_user_id = p_user_id
    );
$$;

REVOKE ALL ON FUNCTION public.is_club_member(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_club_member(uuid, uuid) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_club_admin(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_club_admin(uuid, uuid) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_club_owner(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_club_owner(uuid, uuid) TO anon, authenticated, service_role;

DROP POLICY IF EXISTS "clubs_select_member" ON public.clubs;
CREATE POLICY "clubs_select_member" ON public.clubs
  FOR SELECT USING (
    owner_user_id = auth.uid()
    OR public.is_club_member(id)
  );

DROP POLICY IF EXISTS "club_members_select" ON public.club_members;
CREATE POLICY "club_members_select" ON public.club_members
  FOR SELECT USING (
    user_id = auth.uid()
    OR public.is_club_owner(club_id)
    OR public.is_club_member(club_id)
  );

DROP POLICY IF EXISTS "club_members_insert_admin" ON public.club_members;
CREATE POLICY "club_members_insert_admin" ON public.club_members
  FOR INSERT WITH CHECK (
    public.is_club_owner(club_id)
    OR public.is_club_admin(club_id)
  );

DROP POLICY IF EXISTS "club_members_delete_self_or_admin" ON public.club_members;
CREATE POLICY "club_members_delete_self_or_admin" ON public.club_members
  FOR DELETE USING (
    user_id = auth.uid()
    OR public.is_club_owner(club_id)
    OR public.is_club_admin(club_id)
  );

DROP POLICY IF EXISTS "club_invitations_select" ON public.club_invitations;
CREATE POLICY "club_invitations_select" ON public.club_invitations
  FOR SELECT USING (
    public.is_club_owner(club_id)
    OR public.is_club_admin(club_id)
  );

DROP POLICY IF EXISTS "club_invitations_insert_admin" ON public.club_invitations;
CREATE POLICY "club_invitations_insert_admin" ON public.club_invitations
  FOR INSERT WITH CHECK (
    public.is_club_owner(club_id)
    OR public.is_club_admin(club_id)
  );

DROP POLICY IF EXISTS "club_invitations_delete_admin" ON public.club_invitations;
CREATE POLICY "club_invitations_delete_admin" ON public.club_invitations
  FOR DELETE USING (
    public.is_club_owner(club_id)
    OR public.is_club_admin(club_id)
  );

DROP POLICY IF EXISTS leagues_select_visible ON public.leagues;
CREATE POLICY leagues_select_visible ON public.leagues
  FOR SELECT USING (
    status <> 'draft'
    OR organizer = auth.uid()
    OR (
      club_id IS NOT NULL
      AND public.is_club_member(club_id)
    )
    OR public.is_club_owner(club_id)
  );

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
            AND public.is_club_member(l.club_id)
          )
        )
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
            AND public.is_club_member(l.club_id)
          )
        )
    )
  );

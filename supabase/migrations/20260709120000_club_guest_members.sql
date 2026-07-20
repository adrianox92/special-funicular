-- Miembros de club sin cuenta y sus tiempos (leaderboard de circuitos)

CREATE TABLE IF NOT EXISTS public.club_guest_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  linked_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (club_id, name)
);

CREATE INDEX IF NOT EXISTS idx_club_guest_members_club_id ON public.club_guest_members(club_id);
CREATE INDEX IF NOT EXISTS idx_club_guest_members_linked_user_id ON public.club_guest_members(linked_user_id);

CREATE TABLE IF NOT EXISTS public.club_guest_timings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  guest_member_id uuid NOT NULL REFERENCES public.club_guest_members(id) ON DELETE CASCADE,
  circuit_id uuid NOT NULL REFERENCES public.circuits(id) ON DELETE CASCADE,
  best_lap_time text NOT NULL,
  best_lap_timestamp numeric,
  timing_date date NOT NULL DEFAULT CURRENT_DATE,
  lane text,
  laps integer,
  consistency_score numeric,
  vehicle_model text,
  vehicle_type text,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'app')),
  entered_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_club_guest_timings_club_circuit ON public.club_guest_timings(club_id, circuit_id);
CREATE INDEX IF NOT EXISTS idx_club_guest_timings_guest ON public.club_guest_timings(guest_member_id);
CREATE INDEX IF NOT EXISTS idx_club_guest_timings_timing_date ON public.club_guest_timings(timing_date);

ALTER TABLE public.club_guest_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_guest_timings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS club_guest_members_select ON public.club_guest_members;
CREATE POLICY club_guest_members_select ON public.club_guest_members
  FOR SELECT USING (
    public.is_club_member(club_id)
    OR public.is_club_owner(club_id)
  );

DROP POLICY IF EXISTS club_guest_members_insert_admin ON public.club_guest_members;
CREATE POLICY club_guest_members_insert_admin ON public.club_guest_members
  FOR INSERT WITH CHECK (
    public.is_club_owner(club_id)
    OR public.is_club_admin(club_id)
  );

DROP POLICY IF EXISTS club_guest_members_update_admin ON public.club_guest_members;
CREATE POLICY club_guest_members_update_admin ON public.club_guest_members
  FOR UPDATE USING (
    public.is_club_owner(club_id)
    OR public.is_club_admin(club_id)
  );

DROP POLICY IF EXISTS club_guest_members_delete_admin ON public.club_guest_members;
CREATE POLICY club_guest_members_delete_admin ON public.club_guest_members
  FOR DELETE USING (
    public.is_club_owner(club_id)
    OR public.is_club_admin(club_id)
  );

DROP POLICY IF EXISTS club_guest_timings_select ON public.club_guest_timings;
CREATE POLICY club_guest_timings_select ON public.club_guest_timings
  FOR SELECT USING (
    public.is_club_member(club_id)
    OR public.is_club_owner(club_id)
  );

DROP POLICY IF EXISTS club_guest_timings_insert_admin ON public.club_guest_timings;
CREATE POLICY club_guest_timings_insert_admin ON public.club_guest_timings
  FOR INSERT WITH CHECK (
    public.is_club_owner(club_id)
    OR public.is_club_admin(club_id)
  );

DROP POLICY IF EXISTS club_guest_timings_update_admin ON public.club_guest_timings;
CREATE POLICY club_guest_timings_update_admin ON public.club_guest_timings
  FOR UPDATE USING (
    public.is_club_owner(club_id)
    OR public.is_club_admin(club_id)
  );

DROP POLICY IF EXISTS club_guest_timings_delete_admin ON public.club_guest_timings;
CREATE POLICY club_guest_timings_delete_admin ON public.club_guest_timings
  FOR DELETE USING (
    public.is_club_owner(club_id)
    OR public.is_club_admin(club_id)
  );

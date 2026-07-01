CREATE TABLE IF NOT EXISTS public.training_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  circuit_id uuid NOT NULL REFERENCES public.circuits(id) ON DELETE CASCADE,
  lane text,
  goal_type text NOT NULL CHECK (goal_type IN ('lap_time', 'consistency')),
  target_value numeric NOT NULL,
  active boolean NOT NULL DEFAULT true,
  achieved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS training_goals_user_active_idx
  ON public.training_goals (user_id, active)
  WHERE active = true;

CREATE UNIQUE INDEX IF NOT EXISTS training_goals_active_unique_idx
  ON public.training_goals (user_id, vehicle_id, circuit_id, COALESCE(lane, ''), goal_type)
  WHERE active = true AND achieved_at IS NULL;

ALTER TABLE public.training_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY training_goals_select_own ON public.training_goals
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY training_goals_insert_own ON public.training_goals
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY training_goals_update_own ON public.training_goals
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY training_goals_delete_own ON public.training_goals
  FOR DELETE USING (user_id = auth.uid());

COMMENT ON TABLE public.training_goals IS 'Metas de entrenamiento por vehículo/circuito/carril';

-- Palmarés manual por vehículo (eventos externos o complemento de competiciones del sistema).
CREATE TABLE IF NOT EXISTS public.vehicle_palmares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  competition_name text NOT NULL,
  event_date date,
  position integer,
  category text,
  notes text,
  competition_id uuid REFERENCES public.competitions(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vehicle_palmares_vehicle_id
  ON public.vehicle_palmares(vehicle_id);

CREATE INDEX IF NOT EXISTS idx_vehicle_palmares_user_id
  ON public.vehicle_palmares(user_id);

CREATE INDEX IF NOT EXISTS idx_vehicle_palmares_event_date
  ON public.vehicle_palmares(event_date DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_vehicle_palmares_competition_id
  ON public.vehicle_palmares(competition_id)
  WHERE competition_id IS NOT NULL;

ALTER TABLE public.vehicle_palmares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users select own vehicle palmares"
  ON public.vehicle_palmares FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own vehicle palmares"
  ON public.vehicle_palmares FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own vehicle palmares"
  ON public.vehicle_palmares FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own vehicle palmares"
  ON public.vehicle_palmares FOR DELETE
  USING (auth.uid() = user_id);

COMMENT ON TABLE public.vehicle_palmares IS 'Palmarés del vehículo: eventos manuales y enlaces opcionales a competiciones del sistema';

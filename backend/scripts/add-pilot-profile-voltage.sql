-- Voltaje de alimentación en sesiones de cronometraje y perfil público de piloto.
-- Ejecutar en Supabase SQL Editor.

-- 1) vehicle_timings: voltaje opcional (V)
ALTER TABLE public.vehicle_timings
ADD COLUMN IF NOT EXISTS supply_voltage_volts numeric(5, 2);

ALTER TABLE public.vehicle_timings
DROP CONSTRAINT IF EXISTS vehicle_timings_supply_voltage_volts_check;

ALTER TABLE public.vehicle_timings
ADD CONSTRAINT vehicle_timings_supply_voltage_volts_check
CHECK (
  supply_voltage_volts IS NULL
  OR (supply_voltage_volts >= 0 AND supply_voltage_volts <= 30)
);

COMMENT ON COLUMN public.vehicle_timings.supply_voltage_volts IS 'Voltaje de pista/alimentación en el momento de la sesión (V). Opcional.';

-- 2) Perfil público agregado por usuario (piloto)
CREATE TABLE IF NOT EXISTS public.pilot_public_profiles (
  user_id uuid NOT NULL PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  slug text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS pilot_public_profiles_slug_lower_idx
ON public.pilot_public_profiles (lower(slug));

COMMENT ON TABLE public.pilot_public_profiles IS 'Slug y visibilidad del perfil público de piloto (datos agregados vía API Express).';
COMMENT ON COLUMN public.pilot_public_profiles.slug IS 'Identificador URL único (validar formato en aplicación).';
COMMENT ON COLUMN public.pilot_public_profiles.enabled IS 'Si es false, GET público devuelve 404.';

ALTER TABLE public.pilot_public_profiles ENABLE ROW LEVEL SECURITY;

-- Políticas: el usuario solo gestiona su fila (acceso típico vía cliente Supabase con JWT)
DROP POLICY IF EXISTS pilot_public_profiles_select_own ON public.pilot_public_profiles;
CREATE POLICY pilot_public_profiles_select_own
  ON public.pilot_public_profiles FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS pilot_public_profiles_insert_own ON public.pilot_public_profiles;
CREATE POLICY pilot_public_profiles_insert_own
  ON public.pilot_public_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS pilot_public_profiles_update_own ON public.pilot_public_profiles;
CREATE POLICY pilot_public_profiles_update_own
  ON public.pilot_public_profiles FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS pilot_public_profiles_delete_own ON public.pilot_public_profiles;
CREATE POLICY pilot_public_profiles_delete_own
  ON public.pilot_public_profiles FOR DELETE
  USING (auth.uid() = user_id);

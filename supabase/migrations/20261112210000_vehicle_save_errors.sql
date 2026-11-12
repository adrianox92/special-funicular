-- Fallos de alta/edición de vehículo (4xx/5xx). Solo el backend con service_role escribe.
-- Sin políticas públicas: RLS activo y REVOKE a anon/authenticated.

CREATE TABLE IF NOT EXISTS public.vehicle_save_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  route text NOT NULL,
  status integer NOT NULL CHECK (status >= 400 AND status < 600),
  error_message text,
  catalog_item_id_raw text,
  source text
);

COMMENT ON TABLE public.vehicle_save_errors IS
  'Errores de POST/PUT /api/vehicles. Sin cuerpos ni secretos; escrito solo con service_role.';
COMMENT ON COLUMN public.vehicle_save_errors.catalog_item_id_raw IS
  'Resumen del catalog_item_id recibido (p. ej. array:2:uuid,uuid), no el multipart entero.';
COMMENT ON COLUMN public.vehicle_save_errors.source IS
  'Flujo del cliente si se envió: suggest, catalog_tab, manual, duplicate, edit.';

CREATE INDEX IF NOT EXISTS vehicle_save_errors_created_at_idx
  ON public.vehicle_save_errors (created_at DESC);

ALTER TABLE public.vehicle_save_errors ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.vehicle_save_errors FROM PUBLIC, anon, authenticated;
GRANT INSERT, SELECT ON TABLE public.vehicle_save_errors TO service_role;

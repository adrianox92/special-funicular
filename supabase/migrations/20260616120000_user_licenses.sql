-- Tabla de licencias Premium de la app Slot Lap Timer (compra única vía RevenueCat).
-- user_id referencia auth.users (UUID), igual que el resto del esquema.
-- active solo pasa a false por reembolso (webhook REFUND/EXPIRATION); no hay caducidad.
-- Acceso exclusivo desde el service role del backend (bypassa RLS).

CREATE TABLE IF NOT EXISTS public.user_licenses (
  id                   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rc_app_user_id       TEXT NOT NULL,
  platform             TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
  product_id           TEXT NOT NULL DEFAULT 'slot_lap_timer_premium',
  store_transaction_id TEXT,
  active               BOOLEAN NOT NULL DEFAULT FALSE,
  source               TEXT NOT NULL DEFAULT 'iap',
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_licenses_rc_app_user_id
  ON public.user_licenses (rc_app_user_id);

ALTER TABLE public.user_licenses ENABLE ROW LEVEL SECURITY;
-- Sin políticas RLS: solo el service role accede (bypassa RLS por defecto en Supabase).

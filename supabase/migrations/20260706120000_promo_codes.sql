-- Códigos promocionales pre-asignados por email para Slot Lap Timer Premium.
-- Cada código solo puede canjearlo el usuario cuyo email coincide con assigned_email.
-- Acceso exclusivo desde el service role del backend (RLS sin políticas).

CREATE TABLE IF NOT EXISTS public.promo_codes (
  id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code                TEXT NOT NULL UNIQUE,
  assigned_email      TEXT NOT NULL,
  redeemed_by_user_id UUID REFERENCES auth.users(id),
  redeemed_at         TIMESTAMPTZ,
  note                TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (redeemed_by_user_id)
);

CREATE INDEX IF NOT EXISTS idx_promo_codes_assigned_email
  ON public.promo_codes (lower(trim(assigned_email)));

ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
-- Sin políticas RLS: solo el service role accede.

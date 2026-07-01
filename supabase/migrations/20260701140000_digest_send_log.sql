CREATE TABLE IF NOT EXISTS public.digest_send_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sent_at timestamptz NOT NULL DEFAULT now(),
  digest_type text NOT NULL DEFAULT 'weekly'
);

CREATE INDEX IF NOT EXISTS digest_send_log_user_sent_idx
  ON public.digest_send_log (user_id, sent_at DESC);

COMMENT ON TABLE public.digest_send_log IS 'Idempotencia de informes semanales enviados';

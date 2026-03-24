-- Suscripciones Web Push por usuario (gestión vía API Express + service role)
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);

COMMENT ON TABLE push_subscriptions IS 'Endpoints Web Push; el backend envía notificaciones con web-push (VAPID).';

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Sin políticas para rol anon/authenticated: solo el service role del backend accede vía PostgREST.
-- Si en el futuro se usa el cliente Supabase con JWT, añadir políticas SELECT/INSERT/DELETE por auth.uid() = user_id.

-- Slot Race Manager (DS200 Manager) — licencias e instalaciones
-- Ejecutar en Supabase SQL Editor o vía migración.

CREATE TABLE IF NOT EXISTS user_subscriptions (
  user_id   UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  is_paid   BOOLEAN NOT NULL DEFAULT false,
  paid_since TIMESTAMPTZ,
  notes     TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_installations (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  installation_id TEXT NOT NULL,
  label           TEXT,
  registered_at   TIMESTAMPTZ DEFAULT now(),
  last_seen_at    TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_installation UNIQUE (user_id, installation_id)
);

CREATE INDEX IF NOT EXISTS idx_app_installations_user_id ON app_installations(user_id);

ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_installations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_own_subscription" ON user_subscriptions;
CREATE POLICY "users_own_subscription" ON user_subscriptions
  FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_own_installations" ON app_installations;
CREATE POLICY "users_own_installations" ON app_installations
  FOR ALL USING (auth.uid() = user_id);

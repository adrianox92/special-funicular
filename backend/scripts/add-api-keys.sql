-- API keys: hash SHA-256 en base de datos (el texto en claro solo se muestra al crear/regenerar).
-- Varias keys activas por usuario (D15). La migración 20260924150000 aplica esto en instalaciones existentes.
CREATE TABLE IF NOT EXISTS user_api_keys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  api_key_hash TEXT NOT NULL,
  api_key_enc TEXT,
  name TEXT,
  key_prefix TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_api_keys_api_key_hash ON user_api_keys(api_key_hash);
CREATE INDEX IF NOT EXISTS idx_user_api_keys_user_id_active
  ON user_api_keys (user_id)
  WHERE revoked_at IS NULL;

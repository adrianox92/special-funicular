-- API keys: solo hash SHA-256 en base de datos (el texto en claro solo se muestra al crear/regenerar).
CREATE TABLE IF NOT EXISTS user_api_keys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  api_key_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_user_api_key UNIQUE (user_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_api_keys_api_key_hash ON user_api_keys(api_key_hash);

-- Migración desde esquema antiguo (columna api_key en texto plano) a api_key_hash (SHA-256 hex).
-- Ejecutar en Supabase SQL Editor si la tabla ya existía con api_key.
-- Instalaciones nuevas: usar solo backend/scripts/add-api-keys.sql (sin este fichero).
-- Requiere extensión pgcrypto (Database → Extensions en Supabase).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE user_api_keys ADD COLUMN IF NOT EXISTS api_key_hash TEXT;

UPDATE user_api_keys
SET api_key_hash = encode(digest(api_key, 'sha256'), 'hex')
WHERE api_key_hash IS NULL
  AND api_key IS NOT NULL
  AND length(trim(api_key)) > 0;

ALTER TABLE user_api_keys ALTER COLUMN api_key_hash SET NOT NULL;

DROP INDEX IF EXISTS idx_user_api_keys_api_key;

ALTER TABLE user_api_keys DROP COLUMN IF EXISTS api_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_api_keys_api_key_hash ON user_api_keys(api_key_hash);

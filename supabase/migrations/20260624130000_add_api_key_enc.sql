-- Add reversible encrypted storage for API keys (AES-256-GCM, server-side secret).
-- Existing rows will have api_key_enc = NULL and will be migrated on the user's next login.
ALTER TABLE user_api_keys ADD COLUMN IF NOT EXISTS api_key_enc TEXT;

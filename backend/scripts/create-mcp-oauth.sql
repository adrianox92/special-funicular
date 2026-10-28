-- Conectores MCP de solo lectura (OAuth 2.1 + PKCE).
-- Los tokens se guardan hasheados (SHA-256), igual que las API keys.
-- Ejecutar en el SQL editor de Supabase antes de usar /mcp.

CREATE TABLE IF NOT EXISTS mcp_oauth_clients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id TEXT NOT NULL UNIQUE,
  client_name TEXT,
  redirect_uris TEXT[] NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mcp_oauth_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code_hash TEXT NOT NULL UNIQUE,
  client_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  redirect_uri TEXT NOT NULL,
  code_challenge TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'read',
  resource TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mcp_oauth_codes_user
  ON mcp_oauth_codes (user_id);

CREATE TABLE IF NOT EXISTS mcp_oauth_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  access_token_hash TEXT NOT NULL UNIQUE,
  refresh_token_hash TEXT UNIQUE,
  scope TEXT NOT NULL DEFAULT 'read',
  access_expires_at TIMESTAMPTZ NOT NULL,
  refresh_expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mcp_oauth_tokens_user_active
  ON mcp_oauth_tokens (user_id)
  WHERE revoked_at IS NULL;

ALTER TABLE mcp_oauth_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcp_oauth_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcp_oauth_tokens ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE mcp_oauth_clients FROM anon, authenticated;
REVOKE ALL ON TABLE mcp_oauth_codes FROM anon, authenticated;
REVOKE ALL ON TABLE mcp_oauth_tokens FROM anon, authenticated;

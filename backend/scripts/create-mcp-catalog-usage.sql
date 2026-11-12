-- Registro de consultas MCP al catálogo.
-- Ejecutar en el SQL editor de Supabase. Sin esta tabla el límite sigue en memoria
-- y se pierde al reiniciar la API.
-- Las filas de más de 90 días se pueden borrar:
--   DELETE FROM mcp_catalog_lookups WHERE created_at < now() - interval '90 days';

CREATE TABLE IF NOT EXISTS mcp_catalog_lookups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id TEXT,
  reference TEXT NOT NULL,
  manufacturer TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK (
    outcome IN ('found', 'not_found', 'ambiguous', 'rate_limited', 'daily_limited')
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mcp_catalog_lookups_user_created
  ON mcp_catalog_lookups (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mcp_catalog_lookups_created
  ON mcp_catalog_lookups (created_at DESC);

ALTER TABLE mcp_catalog_lookups ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE mcp_catalog_lookups FROM anon, authenticated;

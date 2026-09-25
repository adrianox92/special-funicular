-- P6 / D15: multiple personal API keys, club/station key (v1), sync idempotency store.
-- Additive and backward compatible: existing user_api_keys rows stay valid.

-- ---- user_api_keys: allow more than one active key per user ----
ALTER TABLE public.user_api_keys DROP CONSTRAINT IF EXISTS unique_user_api_key;
DROP INDEX IF EXISTS unique_user_api_key;

ALTER TABLE public.user_api_keys ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.user_api_keys ADD COLUMN IF NOT EXISTS key_prefix TEXT;
ALTER TABLE public.user_api_keys ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;
ALTER TABLE public.user_api_keys ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_user_api_keys_user_id_active
  ON public.user_api_keys (user_id)
  WHERE revoked_at IS NULL;

-- ---- club/station API key: one per club, rotatable by admin/owner ----
CREATE TABLE IF NOT EXISTS public.club_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  api_key_hash TEXT NOT NULL,
  api_key_enc TEXT,
  key_prefix TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  CONSTRAINT unique_club_api_key UNIQUE (club_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_club_api_keys_api_key_hash
  ON public.club_api_keys (api_key_hash);

ALTER TABLE public.club_api_keys ENABLE ROW LEVEL SECURITY;

-- ---- idempotency replay store (scoped to API-key owner) ----
CREATE TABLE IF NOT EXISTS public.sync_idempotency_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_scope TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  request_fingerprint TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  response_body JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT sync_idempotency_owner_key_unique UNIQUE (owner_scope, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_sync_idempotency_expires_at
  ON public.sync_idempotency_keys (expires_at);

ALTER TABLE public.sync_idempotency_keys ENABLE ROW LEVEL SECURITY;

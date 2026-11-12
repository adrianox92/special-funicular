-- Consentimiento de comunicaciones comerciales (RGPD).
-- Opt-in explícito; los usuarios existentes quedan sin consentimiento (no hay fila).
-- Cada usuario solo puede leer y actualizar su propia fila (RLS).

CREATE TABLE IF NOT EXISTS public.user_marketing_consents (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  consented boolean NOT NULL DEFAULT false,
  given_at timestamptz,
  withdrawn_at timestamptz,
  source text NOT NULL DEFAULT 'signup'
    CHECK (source IN ('signup', 'profile', 'unsubscribe')),
  unsubscribe_token uuid NOT NULL DEFAULT gen_random_uuid(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_marketing_consents_given_when_true
    CHECK (consented = false OR given_at IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS user_marketing_consents_unsubscribe_token_idx
  ON public.user_marketing_consents (unsubscribe_token);

COMMENT ON TABLE public.user_marketing_consents IS
  'Opt-in de novedades por email. consented=false por defecto; given_at/withdrawn_at registran el último alta o baja.';
COMMENT ON COLUMN public.user_marketing_consents.consented IS
  'true si el usuario acepta comunicaciones comerciales por email.';
COMMENT ON COLUMN public.user_marketing_consents.given_at IS
  'Momento del último consentimiento otorgado.';
COMMENT ON COLUMN public.user_marketing_consents.withdrawn_at IS
  'Momento de la última retirada de consentimiento.';
COMMENT ON COLUMN public.user_marketing_consents.source IS
  'Origen del último cambio: signup, profile o unsubscribe.';
COMMENT ON COLUMN public.user_marketing_consents.unsubscribe_token IS
  'Token opaco para baja sin sesión (enlaces de email futuros).';

CREATE OR REPLACE FUNCTION public.tg_user_marketing_consents_audit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.updated_at := now();
    IF NEW.consented THEN
      NEW.given_at := COALESCE(NEW.given_at, now());
    END IF;
    IF NEW.unsubscribe_token IS NULL THEN
      NEW.unsubscribe_token := gen_random_uuid();
    END IF;
    RETURN NEW;
  END IF;

  NEW.user_id := OLD.user_id;
  NEW.unsubscribe_token := OLD.unsubscribe_token;
  NEW.updated_at := now();
  IF NEW.consented AND NOT OLD.consented THEN
    NEW.given_at := now();
  ELSIF (NOT NEW.consented) AND OLD.consented THEN
    NEW.withdrawn_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_marketing_consents_audit ON public.user_marketing_consents;
CREATE TRIGGER user_marketing_consents_audit
  BEFORE INSERT OR UPDATE ON public.user_marketing_consents
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_user_marketing_consents_audit();

ALTER TABLE public.user_marketing_consents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_marketing_consents_select_own ON public.user_marketing_consents;
CREATE POLICY user_marketing_consents_select_own
  ON public.user_marketing_consents
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS user_marketing_consents_insert_own ON public.user_marketing_consents;
CREATE POLICY user_marketing_consents_insert_own
  ON public.user_marketing_consents
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS user_marketing_consents_update_own ON public.user_marketing_consents;
CREATE POLICY user_marketing_consents_update_own
  ON public.user_marketing_consents
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

REVOKE ALL ON FUNCTION public.tg_user_marketing_consents_audit() FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE ON public.user_marketing_consents TO authenticated;
GRANT ALL ON public.user_marketing_consents TO service_role;

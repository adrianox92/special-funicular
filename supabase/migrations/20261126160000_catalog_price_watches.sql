-- «Lo busco»: precio máximo por usuario y referencia, y avisos in-app.
-- El usuario gestiona su búsqueda. Los avisos los inserta el backend (service_role).
-- Al guardar un vehículo con esa referencia, la búsqueda se borra.

CREATE TABLE IF NOT EXISTS public.catalog_price_watches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  catalog_item_id uuid NOT NULL REFERENCES public.slot_catalog_items(id) ON DELETE CASCADE,
  max_price numeric(10,2) NOT NULL,
  currency text NOT NULL DEFAULT 'EUR',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catalog_price_watches_user_item_key UNIQUE (user_id, catalog_item_id),
  CONSTRAINT catalog_price_watches_max_price_check CHECK (max_price > 0 AND max_price <= 99999999.99),
  CONSTRAINT catalog_price_watches_currency_check CHECK (currency ~ '^[A-Z]{3}$')
);

COMMENT ON TABLE public.catalog_price_watches IS
  'Precio máximo que un usuario pagaría por una referencia del catálogo.';
COMMENT ON COLUMN public.catalog_price_watches.max_price IS
  'Tope incluido: una oferta a este precio o por debajo puede avisar.';

CREATE INDEX IF NOT EXISTS idx_catalog_price_watches_item_price
  ON public.catalog_price_watches (catalog_item_id, currency, max_price);

CREATE TABLE IF NOT EXISTS public.catalog_price_watch_notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  watch_id uuid REFERENCES public.catalog_price_watches(id) ON DELETE SET NULL,
  offer_id uuid REFERENCES public.catalog_shop_offers(id) ON DELETE SET NULL,
  shop_id uuid REFERENCES public.catalog_shops(id) ON DELETE SET NULL,
  catalog_item_id uuid NOT NULL REFERENCES public.slot_catalog_items(id) ON DELETE CASCADE,
  shop_name text NOT NULL,
  reference text,
  model_name text,
  price numeric(10,2) NOT NULL,
  currency text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catalog_price_watch_notices_price_check CHECK (price > 0),
  CONSTRAINT catalog_price_watch_notices_currency_check CHECK (currency ~ '^[A-Z]{3}$')
);

COMMENT ON TABLE public.catalog_price_watch_notices IS
  'Aviso in-app de una tienda que cumple una búsqueda de precio. También recuerda el último precio avisado por tienda.';
COMMENT ON COLUMN public.catalog_price_watch_notices.watch_id IS
  'Queda nulo si el usuario quita la búsqueda o el coche entra en el garaje; el aviso se conserva.';

CREATE INDEX IF NOT EXISTS idx_catalog_price_watch_notices_watch_shop
  ON public.catalog_price_watch_notices (watch_id, shop_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_catalog_price_watch_notices_unread
  ON public.catalog_price_watch_notices (user_id, created_at DESC)
  WHERE read_at IS NULL;

CREATE OR REPLACE FUNCTION public.tg_catalog_price_watches_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_at := COALESCE(NEW.created_at, now());
    NEW.updated_at := now();
    RETURN NEW;
  END IF;

  NEW.id := OLD.id;
  NEW.user_id := OLD.user_id;
  NEW.catalog_item_id := OLD.catalog_item_id;
  NEW.currency := OLD.currency;
  NEW.created_at := OLD.created_at;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS catalog_price_watches_guard ON public.catalog_price_watches;
CREATE TRIGGER catalog_price_watches_guard
  BEFORE INSERT OR UPDATE ON public.catalog_price_watches
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_catalog_price_watches_guard();

CREATE OR REPLACE FUNCTION public.tg_catalog_price_watch_notices_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.id := OLD.id;
  NEW.user_id := OLD.user_id;
  NEW.watch_id := OLD.watch_id;
  NEW.offer_id := OLD.offer_id;
  NEW.shop_id := OLD.shop_id;
  NEW.catalog_item_id := OLD.catalog_item_id;
  NEW.shop_name := OLD.shop_name;
  NEW.reference := OLD.reference;
  NEW.model_name := OLD.model_name;
  NEW.price := OLD.price;
  NEW.currency := OLD.currency;
  NEW.created_at := OLD.created_at;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS catalog_price_watch_notices_guard ON public.catalog_price_watch_notices;
CREATE TRIGGER catalog_price_watch_notices_guard
  BEFORE UPDATE ON public.catalog_price_watch_notices
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_catalog_price_watch_notices_guard();

CREATE OR REPLACE FUNCTION public.tg_clear_catalog_price_watch_on_vehicle()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.catalog_item_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.catalog_item_id IS DISTINCT FROM OLD.catalog_item_id) THEN
    DELETE FROM public.catalog_price_watches
    WHERE user_id = NEW.user_id
      AND catalog_item_id = NEW.catalog_item_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS vehicles_clear_catalog_price_watch ON public.vehicles;
CREATE TRIGGER vehicles_clear_catalog_price_watch
  AFTER INSERT OR UPDATE OF catalog_item_id ON public.vehicles
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_clear_catalog_price_watch_on_vehicle();

COMMENT ON FUNCTION public.tg_clear_catalog_price_watch_on_vehicle() IS
  'Quita la búsqueda de precio cuando el usuario guarda un vehículo con esa referencia.';

ALTER TABLE public.catalog_price_watches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_price_watch_notices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS catalog_price_watches_select_own ON public.catalog_price_watches;
CREATE POLICY catalog_price_watches_select_own
  ON public.catalog_price_watches
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS catalog_price_watches_insert_own ON public.catalog_price_watches;
CREATE POLICY catalog_price_watches_insert_own
  ON public.catalog_price_watches
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS catalog_price_watches_update_own ON public.catalog_price_watches;
CREATE POLICY catalog_price_watches_update_own
  ON public.catalog_price_watches
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS catalog_price_watches_delete_own ON public.catalog_price_watches;
CREATE POLICY catalog_price_watches_delete_own
  ON public.catalog_price_watches
  FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS catalog_price_watch_notices_select_own ON public.catalog_price_watch_notices;
CREATE POLICY catalog_price_watch_notices_select_own
  ON public.catalog_price_watch_notices
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS catalog_price_watch_notices_update_own ON public.catalog_price_watch_notices;
CREATE POLICY catalog_price_watch_notices_update_own
  ON public.catalog_price_watch_notices
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

REVOKE ALL ON TABLE public.catalog_price_watches FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.catalog_price_watch_notices FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.catalog_price_watches TO authenticated;
GRANT SELECT, UPDATE ON TABLE public.catalog_price_watch_notices TO authenticated;
GRANT ALL ON TABLE public.catalog_price_watches TO service_role;
GRANT ALL ON TABLE public.catalog_price_watch_notices TO service_role;

REVOKE ALL ON FUNCTION public.tg_catalog_price_watches_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_catalog_price_watch_notices_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_clear_catalog_price_watch_on_vehicle() FROM PUBLIC, anon, authenticated;

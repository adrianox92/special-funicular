-- ============================================================
-- Store listings — monetización del catálogo
-- ============================================================

-- ------------------------------------------------------------
-- seller_profiles
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.seller_profiles (
  user_id       uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  store_name    text NOT NULL,
  store_description text,
  store_url     text,
  logo_url      text,
  approved      boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.seller_profiles ENABLE ROW LEVEL SECURITY;

-- Cualquiera puede leer perfiles aprobados (para mostrar logo/nombre en listados)
CREATE POLICY "seller_profiles_public_read"
  ON public.seller_profiles FOR SELECT
  USING (approved = true);

-- Cada usuario puede leer su propio perfil independientemente del estado
CREATE POLICY "seller_profiles_own_read"
  ON public.seller_profiles FOR SELECT
  USING (auth.uid() = user_id);

-- Cada usuario puede crear su propio perfil (solicitud de alta)
CREATE POLICY "seller_profiles_own_insert"
  ON public.seller_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Cada usuario puede actualizar su propio perfil (nombre, logo, etc.)
CREATE POLICY "seller_profiles_own_update"
  ON public.seller_profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- ------------------------------------------------------------
-- store_listings
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.store_listings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_item_id uuid NOT NULL REFERENCES public.slot_catalog_items(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title           text NOT NULL,
  url             text NOT NULL,
  price           numeric(10, 2),
  currency        text NOT NULL DEFAULT 'EUR',
  notes           text,
  active          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.store_listings ENABLE ROW LEVEL SECURITY;

-- Público: solo listados activos
CREATE POLICY "store_listings_public_read"
  ON public.store_listings FOR SELECT
  USING (active = true);

-- Propietario: puede ver todos sus listados (activos o no)
CREATE POLICY "store_listings_own_read"
  ON public.store_listings FOR SELECT
  USING (auth.uid() = user_id);

-- Propietario: insertar sus propios listados
CREATE POLICY "store_listings_own_insert"
  ON public.store_listings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Propietario: editar sus propios listados
CREATE POLICY "store_listings_own_update"
  ON public.store_listings FOR UPDATE
  USING (auth.uid() = user_id);

-- Propietario: borrar sus propios listados
CREATE POLICY "store_listings_own_delete"
  ON public.store_listings FOR DELETE
  USING (auth.uid() = user_id);

-- ------------------------------------------------------------
-- store_listing_clicks — tracking de clics
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.store_listing_clicks (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.store_listings(id) ON DELETE CASCADE,
  user_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id text,
  clicked_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.store_listing_clicks ENABLE ROW LEVEL SECURITY;

-- Cualquiera puede registrar un clic (anónimo o autenticado)
CREATE POLICY "store_listing_clicks_public_insert"
  ON public.store_listing_clicks FOR INSERT
  WITH CHECK (true);

-- El propietario del listado puede ver los clics de sus propios listados
CREATE POLICY "store_listing_clicks_owner_read"
  ON public.store_listing_clicks FOR SELECT
  USING (
    listing_id IN (
      SELECT id FROM public.store_listings WHERE user_id = auth.uid()
    )
  );

-- ------------------------------------------------------------
-- Índices
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_store_listings_catalog_item_id
  ON public.store_listings (catalog_item_id)
  WHERE active = true;

CREATE INDEX IF NOT EXISTS idx_store_listings_user_id
  ON public.store_listings (user_id);

CREATE INDEX IF NOT EXISTS idx_store_listing_clicks_listing_id
  ON public.store_listing_clicks (listing_id);

-- ------------------------------------------------------------
-- Bucket para logos de tienda (store-logos dentro de catalog-images)
-- Los logos se subirán a la carpeta store-logos/ del bucket catalog-images
-- que ya existe. No se requiere crear un bucket nuevo.
-- ------------------------------------------------------------

-- Inventario de repuestos y consumibles por usuario
-- Ejecutar en Supabase SQL Editor después de desplegar el backend.

CREATE TABLE IF NOT EXISTS public.inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  reference text,
  url text,
  category text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  unit text NOT NULL DEFAULT 'uds',
  min_stock integer,
  purchase_price numeric,
  purchase_date date,
  notes text,
  vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventory_items_user_id ON public.inventory_items(user_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_category ON public.inventory_items(category);
CREATE INDEX IF NOT EXISTS idx_inventory_items_vehicle_id ON public.inventory_items(vehicle_id);

ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users select own inventory items"
  ON public.inventory_items FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own inventory items"
  ON public.inventory_items FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own inventory items"
  ON public.inventory_items FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own inventory items"
  ON public.inventory_items FOR DELETE
  USING (auth.uid() = user_id);

COMMENT ON TABLE public.inventory_items IS 'Líneas de stock por adquisición; misma referencia puede repetirse en varias filas (distintas compras).';

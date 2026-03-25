-- Historial de reposiciones / compras por línea de inventario
-- Ejecutar en Supabase SQL Editor después de desplegar el backend.

CREATE TABLE IF NOT EXISTS public.inventory_purchase_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quantity integer NOT NULL CHECK (quantity > 0),
  purchase_price numeric,
  supplier text,
  purchase_date date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inv_purchase_hist_item_id
  ON public.inventory_purchase_history(inventory_item_id);

CREATE INDEX IF NOT EXISTS idx_inv_purchase_hist_user_id
  ON public.inventory_purchase_history(user_id);

CREATE INDEX IF NOT EXISTS idx_inv_purchase_hist_created_at
  ON public.inventory_purchase_history(created_at DESC);

ALTER TABLE public.inventory_purchase_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users select own inventory purchase history"
  ON public.inventory_purchase_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own inventory purchase history"
  ON public.inventory_purchase_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own inventory purchase history"
  ON public.inventory_purchase_history FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own inventory purchase history"
  ON public.inventory_purchase_history FOR DELETE
  USING (auth.uid() = user_id);

COMMENT ON TABLE public.inventory_purchase_history IS 'Registro de cada reposición de stock con precio y origen de compra.';

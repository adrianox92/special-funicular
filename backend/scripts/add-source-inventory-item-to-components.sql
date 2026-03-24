-- Origen del stock al montar desde inventario; permite descontar unidades extra al subir mounted_qty.
ALTER TABLE public.components
  ADD COLUMN IF NOT EXISTS source_inventory_item_id uuid REFERENCES public.inventory_items (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.components.source_inventory_item_id IS 'Si se montó desde inventario, id de la línea de stock descontada; usado al aumentar mounted_qty.';

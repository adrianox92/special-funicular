-- Campos alineados con componentes del vehículo (marca, material, etc.)
ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS manufacturer text,
  ADD COLUMN IF NOT EXISTS material text,
  ADD COLUMN IF NOT EXISTS size text,
  ADD COLUMN IF NOT EXISTS color text,
  ADD COLUMN IF NOT EXISTS teeth integer,
  ADD COLUMN IF NOT EXISTS rpm numeric,
  ADD COLUMN IF NOT EXISTS gaus numeric,
  ADD COLUMN IF NOT EXISTS description text;

COMMENT ON COLUMN public.inventory_items.manufacturer IS 'Marca/fabricante; se usa al montar en vehículo si no se envía otro valor.';
COMMENT ON COLUMN public.inventory_items.description IS 'Descripción técnica del repuesto (equivalente a description en components).';

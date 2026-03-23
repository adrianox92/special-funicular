-- Cantidad de unidades físicas montadas en este registro de componente.
-- Filas existentes reciben 1 automáticamente al añadir la columna con DEFAULT en PostgreSQL.
ALTER TABLE public.components
  ADD COLUMN IF NOT EXISTS mounted_qty integer NOT NULL DEFAULT 1;

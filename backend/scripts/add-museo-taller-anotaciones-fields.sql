-- Add Museo, Taller (boolean) and Anotaciones (text) fields to vehicles table
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS museo BOOLEAN DEFAULT false;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS taller BOOLEAN DEFAULT false;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS anotaciones TEXT;

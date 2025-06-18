-- Añadir columna slug a la tabla competitions
ALTER TABLE competitions 
ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;

-- Crear índice para mejorar el rendimiento de búsquedas por slug
CREATE INDEX IF NOT EXISTS idx_competitions_slug ON competitions(slug);

-- Generar slugs para competiciones existentes que no tengan slug
UPDATE competitions 
SET slug = LOWER(
  REGEXP_REPLACE(
    REGEXP_REPLACE(name, '[^a-zA-Z0-9\s]', '', 'g'),
    '\s+', '-', 'g'
  )
) || '-' || EXTRACT(EPOCH FROM created_at)::TEXT
WHERE slug IS NULL; 
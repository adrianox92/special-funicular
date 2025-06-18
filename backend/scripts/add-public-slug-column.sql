-- Añadir columna public_slug a la tabla competitions
ALTER TABLE competitions 
ADD COLUMN IF NOT EXISTS public_slug TEXT UNIQUE;

-- Crear índice para mejorar el rendimiento de búsquedas por public_slug
CREATE INDEX IF NOT EXISTS idx_competitions_public_slug ON competitions(public_slug); 
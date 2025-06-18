-- Añadir campo category_id a la tabla competition_participants
ALTER TABLE competition_participants 
ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES competition_categories(id);

-- Crear índice para mejorar el rendimiento de las consultas
CREATE INDEX IF NOT EXISTS idx_competition_participants_category_id 
ON competition_participants(category_id); 
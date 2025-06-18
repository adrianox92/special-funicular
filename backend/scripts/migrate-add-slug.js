const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function addSlugColumn() {
  try {
    console.log('Añadiendo columna slug a la tabla competitions...');
    
    // Añadir la columna slug
    const { error: alterError } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE competitions 
        ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;
      `
    });

    if (alterError) {
      console.error('Error al añadir columna slug:', alterError);
      return;
    }

    console.log('Columna slug añadida correctamente');

    // Generar slugs para competiciones existentes
    console.log('Generando slugs para competiciones existentes...');
    
    const { data: competitions, error: fetchError } = await supabase
      .from('competitions')
      .select('id, name')
      .is('slug', null);

    if (fetchError) {
      console.error('Error al obtener competiciones:', fetchError);
      return;
    }

    for (const competition of competitions) {
      const slug = generateSlug(competition.name);
      
      const { error: updateError } = await supabase
        .from('competitions')
        .update({ slug })
        .eq('id', competition.id);

      if (updateError) {
        console.error(`Error al actualizar slug para competición ${competition.id}:`, updateError);
      } else {
        console.log(`Slug generado para "${competition.name}": ${slug}`);
      }
    }

    console.log('Migración completada exitosamente');
  } catch (error) {
    console.error('Error en la migración:', error);
  }
}

function generateSlug(name) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Eliminar acentos
    .replace(/[^a-z0-9\s-]/g, '') // Solo letras, números, espacios y guiones
    .replace(/\s+/g, '-') // Reemplazar espacios con guiones
    .replace(/-+/g, '-') // Múltiples guiones por uno solo
    .trim('-') // Eliminar guiones al inicio y final
    + '-' + Date.now().toString().slice(-6); // Añadir timestamp para unicidad
}

addSlugColumn(); 
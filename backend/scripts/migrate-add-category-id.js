const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Configuración de Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY deben estar definidos en las variables de entorno');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function migrateAddCategoryId() {
  try {
    console.log('Iniciando migración: Añadir category_id a competition_participants...');

    // Leer el archivo SQL
    const sqlPath = path.join(__dirname, 'add-category-id-to-participants.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');

    // Ejecutar las consultas SQL
    const { error } = await supabase.rpc('exec_sql', { sql: sqlContent });

    if (error) {
      console.error('[ERR] Error al ejecutar la migración:', error);
      return;
    }

    console.log('[OK] Migración completada exitosamente');
    console.log('Cambios realizados:');
    console.log('   - Añadido campo category_id a la tabla competition_participants');
    console.log('   - Creado índice para mejorar el rendimiento de consultas');

  } catch (error) {
    console.error('[ERR] Error durante la migración:', error);
  }
}

// Ejecutar la migración
migrateAddCategoryId(); 
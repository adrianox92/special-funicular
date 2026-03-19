const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: SUPABASE_URL y SUPABASE_KEY (o SUPABASE_SERVICE_ROLE_KEY) deben estar definidos en .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function migrateAddApiKeys() {
  try {
    console.log('Iniciando migración: Crear tabla user_api_keys...');

    const sqlPath = path.join(__dirname, 'add-api-keys.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');

    const { error } = await supabase.rpc('exec_sql', { sql: sqlContent });

    if (error) {
      console.error('[ERR] Error al ejecutar la migración:', error.message);
      console.log('');
      console.log('Note: Si no tienes la función exec_sql, ejecuta manualmente en Supabase SQL Editor:');
      console.log(sqlContent);
      process.exit(1);
    }

    console.log('[OK] Migración completada exitosamente');
    console.log('Cambios realizados:');
    console.log('   - Creada tabla user_api_keys');
    console.log('   - Índice en api_key para búsquedas rápidas');
  } catch (error) {
    console.error('[ERR] Error durante la migración:', error);
    process.exit(1);
  }
}

migrateAddApiKeys();

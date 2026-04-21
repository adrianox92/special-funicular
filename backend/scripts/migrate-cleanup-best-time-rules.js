require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { createServerClient } = require('../lib/supabaseClients');

// Configuración de Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY deben estar definidos en las variables de entorno');
  process.exit(1);
}

const supabase = createServerClient(supabaseUrl, supabaseKey);

async function cleanupBestTimeRules() {
  try {
    console.log('Iniciando limpieza: Eliminar reglas best_time_per_round...');

    // Leer el archivo SQL
    const sqlPath = path.join(__dirname, 'cleanup-best-time-rules.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');

    // Ejecutar las consultas SQL
    const { error } = await supabase.rpc('exec_sql', { sql: sqlContent });

    if (error) {
      console.error('[ERR] Error al ejecutar la limpieza:', error);
      return;
    }

    console.log('[OK] Limpieza completada exitosamente');
    console.log('Cambios realizados:');
    console.log('   - Eliminadas reglas de competición con tipo best_time_per_round');
    console.log('   - Eliminadas plantillas con tipo best_time_per_round');

  } catch (error) {
    console.error('[ERR] Error durante la limpieza:', error);
  }
}

// Ejecutar la limpieza
cleanupBestTimeRules(); 
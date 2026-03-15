const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: SUPABASE_URL y SUPABASE_KEY (o SUPABASE_SERVICE_ROLE_KEY) deben estar definidos en .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function migrateCreateCircuits() {
  try {
    console.log('🚀 Iniciando migración: Crear tabla circuits y referencias circuit_id...');

    // 1. Crear tabla circuits
    console.log('📝 Ejecutando create-circuits-table.sql...');
    const createTablePath = path.join(__dirname, 'create-circuits-table.sql');
    const createTableSql = fs.readFileSync(createTablePath, 'utf8');

    const { error: error1 } = await supabase.rpc('exec_sql', { sql: createTableSql });

    if (error1) {
      console.log('⚠️  No se pudo ejecutar via exec_sql:', error1.message);
      console.log('');
      console.log('💡 Ejecuta manualmente en Supabase SQL Editor los siguientes scripts:');
      console.log('   1. backend/scripts/create-circuits-table.sql');
      console.log('   2. backend/scripts/migrate-circuit-references.sql');
      process.exit(1);
    }

    console.log('✅ Tabla circuits creada correctamente');

    // 2. Añadir circuit_id a competitions, vehicle_timings, competition_timings
    console.log('📝 Ejecutando migrate-circuit-references.sql...');
    const migrateRefsPath = path.join(__dirname, 'migrate-circuit-references.sql');
    const migrateRefsSql = fs.readFileSync(migrateRefsPath, 'utf8');

    const { error: error2 } = await supabase.rpc('exec_sql', { sql: migrateRefsSql });

    if (error2) {
      console.log('⚠️  Error al añadir referencias circuit_id:', error2.message);
      console.log('');
      console.log('💡 Ejecuta manualmente en Supabase SQL Editor:');
      console.log('   backend/scripts/migrate-circuit-references.sql');
      process.exit(1);
    }

    console.log('✅ Referencias circuit_id añadidas correctamente');

    console.log('');
    console.log('🎉 Migración completada exitosamente');
    console.log('📋 Cambios realizados:');
    console.log('   - Creada tabla circuits (id, user_id, name, description, num_lanes, lane_lengths)');
    console.log('   - Añadido circuit_id a competitions');
    console.log('   - Añadido circuit_id a vehicle_timings');
    console.log('   - Añadido circuit_id a competition_timings');
  } catch (error) {
    console.error('❌ Error durante la migración:', error);
    console.log('');
    console.log('💡 Ejecuta manualmente en Supabase SQL Editor:');
    console.log('   1. backend/scripts/create-circuits-table.sql');
    console.log('   2. backend/scripts/migrate-circuit-references.sql');
    process.exit(1);
  }
}

migrateCreateCircuits();

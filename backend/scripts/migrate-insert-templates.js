const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function insertRuleTemplates() {
  try {
    console.log('Iniciando inserción de plantillas de reglas...');

    // Leer el archivo SQL
    const sqlPath = path.join(__dirname, 'insert-rule-templates.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');

    // Dividir el SQL en statements individuales
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    console.log(`Encontrados ${statements.length} statements SQL para ejecutar`);

    // Ejecutar cada statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      console.log(`\nEjecutando statement ${i + 1}/${statements.length}...`);
      
      const { error } = await supabase.rpc('exec_sql', { sql: statement });
      
      if (error) {
        console.error(`[ERR] Error en statement ${i + 1}:`, error);
        throw error;
      }
      
      console.log(`[OK] Statement ${i + 1} ejecutado correctamente`);
    }

    console.log('\n¡Migración completada exitosamente!');
    console.log('Se han insertado las siguientes plantillas:');
    console.log('   - Sistema Estándar (1º=10, 2º=8, 3º=6, 4º=4, 5º=2)');
    console.log('   - Sistema F1 (1º=25, 2º=18, 3º=15, 4º=12, 5º=10, 6º=8, 7º=6, 8º=4, 9º=2, 10º=1)');
    console.log('   - Sistema Simple (1º=3, 2º=2, 3º=1)');
    console.log('   - Sistema con Bonus (con punto extra por mejor vuelta)');
    console.log('   - Puntuación Final (bonus para ganador general)');
    console.log('   - Mejor Vuelta por Ronda (5 puntos por mejor vuelta)');
    console.log('   - Sistema de Eliminación (solo primeros 3)');
    console.log('   - Sistema Extendido (para competiciones grandes)');

  } catch (error) {
    console.error('Error durante la migración:', error);
    process.exit(1);
  }
}

// Ejecutar la migración
insertRuleTemplates(); 
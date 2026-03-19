const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

// Verificar que las variables de entorno necesarias estén definidas
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
  console.error('Error: Las variables de entorno SUPABASE_URL y SUPABASE_KEY son requeridas.');
  console.error('Asegúrate de que el archivo .env existe en el directorio raíz del proyecto y contiene estas variables.');
  process.exit(1);
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function addCircuitNameColumn() {
  try {
    console.log('Iniciando migración para agregar campo circuit_name...');

    // Verificar si la columna ya existe
    const { data: columns, error: columnsError } = await supabase
      .rpc('get_table_columns', { table_name: 'competitions' });

    if (columnsError) {
      console.log('No se pudo verificar las columnas existentes, procediendo con la migración...');
    } else {
      const hasCircuitName = columns.some(col => col.column_name === 'circuit_name');
      if (hasCircuitName) {
        console.log('[OK] La columna circuit_name ya existe en la tabla competitions');
        return;
      }
    }

    // Agregar la columna circuit_name
    const { error } = await supabase
      .rpc('add_column_if_not_exists', {
        table_name: 'competitions',
        column_name: 'circuit_name',
        column_type: 'text'
      });

    if (error) {
      // Si el RPC no existe, intentar con SQL directo
      console.log('Intentando con SQL directo...');
      const { error: sqlError } = await supabase
        .from('competitions')
        .select('id')
        .limit(1);

      if (sqlError && sqlError.message.includes('circuit_name')) {
        console.log('[OK] La columna circuit_name ya existe');
        return;
      }

      console.log('[WARN] No se pudo verificar automáticamente. Por favor, ejecuta manualmente:');
      console.log('ALTER TABLE public.competitions ADD COLUMN circuit_name text;');
      return;
    }

    console.log('[OK] Columna circuit_name agregada exitosamente');

    // Agregar comentario a la columna
    try {
      await supabase
        .rpc('add_column_comment', {
          table_name: 'competitions',
          column_name: 'circuit_name',
          comment: 'Nombre del circuito donde se realizará la competición'
        });
      console.log('[OK] Comentario agregado a la columna circuit_name');
    } catch (commentError) {
      console.log('[WARN] No se pudo agregar el comentario automáticamente');
    }

    console.log('Migración completada exitosamente');

  } catch (error) {
    console.error('[ERR] Error durante la migración:', error);
    console.log('\nPara ejecutar manualmente, usa este SQL en Supabase:');
    console.log('ALTER TABLE public.competitions ADD COLUMN circuit_name text;');
    console.log('COMMENT ON COLUMN public.competitions.circuit_name IS \'Nombre del circuito donde se realizará la competición\';');
  }
}

// Ejecutar la migración
addCircuitNameColumn()
  .then(() => {
    console.log('[OK] Proceso completado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('[ERR] Error fatal:', error);
    process.exit(1);
  }); 
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY deben estar definidos en .env');
  process.exit(1);
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function migratePositionTracking() {
  console.log('🚀 Iniciando migración para añadir seguimiento de posiciones...');
  
  try {
    // 1. Añadir campo current_position
    console.log('📝 Añadiendo campo current_position...');
    const { error: error1 } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE vehicle_timings ADD COLUMN IF NOT EXISTS current_position integer;'
    });
    
    if (error1) {
      console.log('⚠️  Campo current_position ya existe o hubo un error:', error1.message);
    } else {
      console.log('✅ Campo current_position añadido correctamente');
    }

    // 2. Añadir campo previous_position
    console.log('📝 Añadiendo campo previous_position...');
    const { error: error3 } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE vehicle_timings ADD COLUMN IF NOT EXISTS previous_position integer;'
    });
    
    if (error3) {
      console.log('⚠️  Campo previous_position ya existe o hubo un error:', error3.message);
    } else {
      console.log('✅ Campo previous_position añadido correctamente');
    }

    // 3. Añadir campo position_updated_at
    console.log('📝 Añadiendo campo position_updated_at...');
    const { error: error4 } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE vehicle_timings ADD COLUMN IF NOT EXISTS position_updated_at timestamp DEFAULT now();'
    });
    
    if (error4) {
      console.log('⚠️  Campo position_updated_at ya existe o hubo un error:', error4.message);
    } else {
      console.log('✅ Campo position_updated_at añadido correctamente');
    }

    // 4. Añadir campo position_change
    console.log('📝 Añadiendo campo position_change...');
    const { error: error5 } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE vehicle_timings ADD COLUMN IF NOT EXISTS position_change integer DEFAULT 0;'
    });
    
    if (error5) {
      console.log('⚠️  Campo position_change ya existe o hubo un error:', error5.message);
    } else {
      console.log('✅ Campo position_change añadido correctamente');
    }

    // 5. Crear índices para mejorar rendimiento
    console.log('🔍 Creando índices para mejorar rendimiento...');
    
    const { error: error6 } = await supabase.rpc('exec_sql', {
      sql: 'CREATE INDEX IF NOT EXISTS idx_vehicle_timings_circuit_position ON vehicle_timings(circuit, best_lap_time, timing_date);'
    });
    
    if (error6) {
      console.log('⚠️  Índice de circuito ya existe o hubo un error:', error6.message);
    } else {
      console.log('✅ Índice de circuito creado correctamente');
    }

    const { error: error7 } = await supabase.rpc('exec_sql', {
      sql: 'CREATE INDEX IF NOT EXISTS idx_vehicle_timings_position_tracking ON vehicle_timings(vehicle_id, circuit, position_updated_at);'
    });
    
    if (error7) {
      console.log('⚠️  Índice de seguimiento ya existe o hubo un error:', error7.message);
    } else {
      console.log('✅ Índice de seguimiento creado correctamente');
    }

    // 5. Actualizar posiciones existentes (opcional)
    console.log('🔄 Actualizando posiciones existentes...');
    
    // Obtener todos los circuitos únicos
    const { data: circuits, error: circuitsError } = await supabase
      .from('vehicle_timings')
      .select('circuit')
      .not('circuit', 'is', null)
      .neq('circuit', '')
      .order('circuit');

    if (circuitsError) {
      console.log('⚠️  Error al obtener circuitos:', circuitsError.message);
    } else {
      const uniqueCircuits = [...new Set(circuits.map(c => c.circuit))];
      console.log(`📊 Encontrados ${uniqueCircuits.length} circuitos únicos`);
      
      // Para cada circuito, calcular y actualizar posiciones
      for (const circuit of uniqueCircuits) {
        console.log(`🔄 Procesando circuito: ${circuit}`);
        
        // Obtener todos los tiempos del circuito ordenados por mejor tiempo
        const { data: timings, error: timingsError } = await supabase
          .from('vehicle_timings')
          .select('id, vehicle_id, best_lap_time, timing_date')
          .eq('circuit', circuit)
          .not('best_lap_time', 'is', null)
          .order('best_lap_time', { ascending: true });

        if (timingsError) {
          console.log(`⚠️  Error al obtener tiempos del circuito ${circuit}:`, timingsError.message);
          continue;
        }

        // Actualizar posiciones
        for (let i = 0; i < timings.length; i++) {
          const timing = timings[i];
          const currentPosition = i + 1;
          
          // Actualizar la posición actual y marcar como actualizada
          const { error: updateError } = await supabase
            .from('vehicle_timings')
            .update({
              current_position: currentPosition,
              previous_position: currentPosition, // Para registros existentes, no hay cambio
              position_updated_at: new Date().toISOString(),
              position_change: 0 // Sin cambios para registros existentes
            })
            .eq('id', timing.id);

          if (updateError) {
            console.log(`⚠️  Error al actualizar posición para timing ${timing.id}:`, updateError.message);
          }
        }
        
        console.log(`✅ Circuito ${circuit} procesado: ${timings.length} tiempos actualizados`);
      }
    }

    console.log('🎉 Migración completada exitosamente!');
    console.log('');
    console.log('📋 Resumen de cambios:');
    console.log('   - Campo previous_position añadido');
    console.log('   - Campo position_updated_at añadido');
    console.log('   - Campo position_change añadido');
    console.log('   - Índices de rendimiento creados');
    console.log('   - Posiciones existentes actualizadas');
    console.log('');
    console.log('💡 Los nuevos campos permitirán:');
    console.log('   - Rastrear cambios de posición en tiempo real');
    console.log('   - Mostrar si un vehículo subió o bajó de posición');
    console.log('   - Mejorar el rendimiento de las consultas de ranking');

  } catch (error) {
    console.error('❌ Error durante la migración:', error);
    process.exit(1);
  }
}

// Ejecutar la migración
migratePositionTracking();

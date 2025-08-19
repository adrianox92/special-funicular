const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const { updateCircuitPositions } = require('../lib/positionTracker');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY deben estar definidos en .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function recalculateAllPositions() {
  console.log('🔄 Iniciando recálculo de todas las posiciones...');
  
  try {
    // 1. Resetear todas las posiciones actuales
    console.log('\n🗑️  Reseteando posiciones actuales...');
    const { error: resetError } = await supabase
      .from('vehicle_timings')
      .update({
        current_position: null,
        previous_position: null,
        position_change: 0,
        position_updated_at: new Date().toISOString()
      })
      .not('circuit', 'is', null);

    if (resetError) {
      console.error('❌ Error al resetear posiciones:', resetError.message);
      return;
    }

    console.log('✅ Posiciones reseteadas correctamente');

    // 2. Obtener todos los circuitos únicos
    console.log('\n🔍 Obteniendo circuitos únicos...');
    const { data: circuits, error: circuitsError } = await supabase
      .from('vehicle_timings')
      .select('circuit')
      .not('circuit', 'is', null)
      .neq('circuit', '')
      .order('circuit');

    if (circuitsError) {
      console.error('❌ Error al obtener circuitos:', circuitsError.message);
      return;
    }

    const uniqueCircuits = [...new Set(circuits.map(c => c.circuit))];
    console.log(`📊 Encontrados ${uniqueCircuits.length} circuitos únicos:`, uniqueCircuits);

    if (uniqueCircuits.length === 0) {
      console.log('⚠️  No hay circuitos para recalcular');
      return;
    }

    // 3. Recalcular posiciones para cada circuito
    let totalUpdates = 0;
    let totalFailures = 0;

    for (const circuit of uniqueCircuits) {
      console.log(`\n🏁 Recalculando posiciones para: ${circuit}`);
      
      try {
        const result = await updateCircuitPositions(circuit);
        
        if (result.success) {
          console.log(`✅ ${circuit}: ${result.successfulUpdates} actualizaciones exitosas`);
          totalUpdates += result.successfulUpdates;
          if (result.failedUpdates > 0) {
            console.warn(`⚠️  ${circuit}: ${result.failedUpdates} actualizaciones fallidas`);
            totalFailures += result.failedUpdates;
          }
        } else {
          console.error(`❌ Error en circuito ${circuit}:`, result.error);
          totalFailures++;
        }
      } catch (error) {
        console.error(`❌ Error al procesar circuito ${circuit}:`, error.message);
        totalFailures++;
      }
    }

    // 4. Resumen final
    console.log('\n📋 Resumen del recálculo:');
    console.log(`   Circuitos procesados: ${uniqueCircuits.length}`);
    console.log(`   Actualizaciones exitosas: ${totalUpdates}`);
    console.log(`   Fallos: ${totalFailures}`);

    if (totalFailures === 0) {
      console.log('\n🎉 Recálculo completado exitosamente!');
    } else {
      console.log('\n⚠️  Recálculo completado con algunos errores');
    }

    // 5. Verificar algunas posiciones como muestra
    console.log('\n🔍 Verificando posiciones recalculadas...');
    for (const circuit of uniqueCircuits.slice(0, 2)) { // Solo los primeros 2 circuitos
      const { data: sampleTimings, error: sampleError } = await supabase
        .from('vehicle_timings')
        .select(`
          vehicle_id,
          best_lap_time,
          current_position,
          position_change,
          lane,
          vehicles!inner (
            manufacturer,
            model
          )
        `)
        .eq('circuit', circuit)
        .not('best_lap_time', 'is', null)
        .order('current_position', { ascending: true })
        .limit(5);

      if (!sampleError && sampleTimings) {
        console.log(`\n🏆 Top 5 en ${circuit}:`);
        sampleTimings.forEach((timing, index) => {
          const changeIcon = timing.position_change > 0 ? '⬆️' : timing.position_change < 0 ? '⬇️' : '➡️';
          console.log(`   P${timing.current_position}: ${timing.vehicles.manufacturer} ${timing.vehicles.model} - ${timing.best_lap_time} ${changeIcon}`);
        });
      }
    }

  } catch (error) {
    console.error('❌ Error durante el recálculo:', error);
  }
}

// Ejecutar el recálculo
recalculateAllPositions();


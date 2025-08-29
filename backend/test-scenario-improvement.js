const { createClient } = require('@supabase/supabase-js');
const { updateCircuitPositions, getCircuitRanking } = require('./lib/positionTracker');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function testScenarioImprovement() {
  console.log('🧪 Probando escenario de mejora de posiciones...\n');

  try {
    // 1. Buscar un circuito existente para la prueba
    console.log('🔍 Buscando circuitos existentes...');
    const { data: circuits, error: circuitsError } = await supabase
      .from('vehicle_timings')
      .select('circuit')
      .not('circuit', 'is', null)
      .neq('circuit', '')
      .order('circuit')
      .limit(1);

    if (circuitsError || !circuits || circuits.length === 0) {
      console.log('⚠️  No hay circuitos para probar. Creando escenario de prueba...');
      await createTestScenario();
      return;
    }

    const testCircuit = circuits[0].circuit;
    console.log(`✅ Usando circuito existente: ${testCircuit}`);

    // 2. Mostrar ranking actual
    console.log(`\n📊 Ranking actual del circuito: ${testCircuit}`);
    const initialRanking = await getCircuitRanking(testCircuit);
    
    if (initialRanking.length === 0) {
      console.log('⚠️  No hay tiempos en este circuito');
      return;
    }

    displayRanking('INICIAL', initialRanking);

    // 3. Simular mejora de tiempo (modificar el tiempo del último clasificado)
    if (initialRanking.length >= 2) {
      const lastPosition = initialRanking[initialRanking.length - 1];
      console.log(`\n🔄 Simulando mejora de tiempo para el vehículo en última posición...`);
      console.log(`   Vehículo ${lastPosition.vehicle_id} actualmente en P${lastPosition.current_position}`);
      
      // Buscar un timing de este vehículo para modificar
      const { data: timingToUpdate, error: timingError } = await supabase
        .from('vehicle_timings')
        .select('id, best_lap_time')
        .eq('vehicle_id', lastPosition.vehicle_id)
        .eq('circuit', testCircuit)
        .eq('lane', lastPosition.lane)
        .eq('laps', lastPosition.laps)
        .limit(1)
        .single();

      if (timingError || !timingToUpdate) {
        console.log('⚠️  No se pudo encontrar el timing para modificar');
        return;
      }

      // Mejorar el tiempo (reducir en 2 segundos)
      const currentTime = timingToUpdate.best_lap_time;
      const improvedTime = improveTime(currentTime, 2); // Mejorar en 2 segundos
      
      console.log(`   Tiempo actual: ${currentTime}`);
      console.log(`   Tiempo mejorado: ${improvedTime}`);
      
      // Actualizar el tiempo
      const { error: updateError } = await supabase
        .from('vehicle_timings')
        .update({ best_lap_time: improvedTime })
        .eq('id', timingToUpdate.id);

      if (updateError) {
        console.log(`❌ Error al actualizar tiempo: ${updateError.message}`);
        return;
      }

      console.log(`   ✅ Tiempo actualizado exitosamente`);
    }

    // 4. Recalcular posiciones
    console.log(`\n🔄 Recalculando posiciones del circuito: ${testCircuit}`);
    const updateResult = await updateCircuitPositions(testCircuit);
    
    if (!updateResult.success) {
      console.log(`❌ Error al recalcular posiciones: ${updateResult.error}`);
      return;
    }

    console.log(`   ✅ Posiciones recalculadas: ${updateResult.successfulUpdates} actualizaciones`);

    // 5. Mostrar ranking final
    console.log(`\n📊 Ranking final del circuito: ${testCircuit}`);
    const finalRanking = await getCircuitRanking(testCircuit);
    displayRanking('FINAL', finalRanking);

    // 6. Análisis de cambios
    console.log(`\n📈 Análisis de cambios de posición:`);
    analyzePositionChanges(initialRanking, finalRanking);

  } catch (error) {
    console.error('❌ Error durante la prueba:', error);
  }
}

function displayRanking(title, ranking) {
  console.log(`\n🏆 ${title}:`);
  ranking.forEach((entry, index) => {
    const changeIcon = entry.position_change > 0 ? '⬆️' : entry.position_change < 0 ? '⬇️' : '➡️';
    const changeText = entry.position_change > 0 ? `+${entry.position_change}` : entry.position_change < 0 ? `${entry.position_change}` : '0';
    console.log(`   ${index + 1}. Vehículo ${entry.vehicle_id} - P${entry.current_position} ${changeIcon} (cambio: ${changeText}) - ${entry.best_lap_time}`);
  });
}

function analyzePositionChanges(initial, final) {
  const changes = [];
  
  final.forEach(entry => {
    const initialEntry = initial.find(i => i.vehicle_id === entry.vehicle_id && i.lane === entry.lane && i.laps === entry.laps);
    if (initialEntry) {
      const initialPosition = initialEntry.current_position;
      const finalPosition = entry.current_position;
      const change = initialPosition - finalPosition;
      
      if (change !== 0) {
        changes.push({
          vehicle_id: entry.vehicle_id,
          initial: initialPosition,
          final: finalPosition,
          change: change,
          type: change > 0 ? 'SUBIDA' : 'BAJADA'
        });
      }
    }
  });

  if (changes.length === 0) {
    console.log('   ℹ️  No se detectaron cambios de posición');
    return;
  }

  const upChanges = changes.filter(c => c.change > 0);
  const downChanges = changes.filter(c => c.change < 0);

  if (upChanges.length > 0) {
    console.log(`   🟢 SUBIDAS de posición (${upChanges.length}):`);
    upChanges.forEach(change => {
      console.log(`      Vehículo ${change.vehicle_id}: P${change.initial} → P${change.final} (+${change.change})`);
    });
  }

  if (downChanges.length > 0) {
    console.log(`   🔴 BAJADAS de posición (${downChanges.length}):`);
    downChanges.forEach(change => {
      console.log(`      Vehículo ${change.vehicle_id}: P${change.initial} → P${change.final} (${change.change})`);
    });
  }

  console.log(`\n   📊 Resumen:`);
  console.log(`      Total de cambios: ${changes.length}`);
  console.log(`      Subidas: ${upChanges.length}`);
  console.log(`      Bajadas: ${downChanges.length}`);
}

function improveTime(timeStr, secondsToImprove) {
  // Convertir tiempo a segundos
  const [minutes, seconds] = timeStr.split(':');
  const [secs, ms] = seconds.split('.');
  let totalSeconds = parseInt(minutes) * 60 + parseInt(secs) + parseInt(ms) / 1000;
  
  // Mejorar el tiempo
  totalSeconds = Math.max(0, totalSeconds - secondsToImprove);
  
  // Convertir de vuelta a formato MM:SS.mmm
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const ms = Math.floor((seconds % 1) * 1000);
  const secs = Math.floor(seconds);
  
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
}

async function createTestScenario() {
  console.log('🔧 Creando escenario de prueba...');
  // Aquí podrías crear datos de prueba si no hay circuitos existentes
  console.log('⚠️  Por favor, añade algunos tiempos en un circuito para probar la funcionalidad');
}

// Ejecutar si se llama directamente
if (require.main === module) {
  testScenarioImprovement();
}

module.exports = { testScenarioImprovement };

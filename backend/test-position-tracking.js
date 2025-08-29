const { updateCircuitPositions, getCircuitRanking } = require('./lib/positionTracker');

async function testPositionTracking() {
  console.log('🧪 Probando sistema de tracking de posiciones...\n');

  try {
    // Simular un circuito de prueba
    const testCircuit = 'Circuito de Prueba';
    
    console.log(`1️⃣ Obteniendo ranking actual del circuito: ${testCircuit}`);
    const initialRanking = await getCircuitRanking(testCircuit);
    console.log(`   Ranking inicial: ${initialRanking.length} vehículos`);
    
    if (initialRanking.length > 0) {
      console.log('   Primeros 3 vehículos:');
      initialRanking.slice(0, 3).forEach((entry, index) => {
        const changeIcon = entry.position_change > 0 ? '⬆️' : entry.position_change < 0 ? '⬇️' : '➡️';
        const changeText = entry.position_change > 0 ? `+${entry.position_change}` : entry.position_change < 0 ? `${entry.position_change}` : '0';
        console.log(`   ${index + 1}. Vehículo ${entry.vehicle_id} - P${entry.current_position} ${changeIcon} (cambio: ${changeText})`);
      });
    }

    console.log(`\n2️⃣ Actualizando posiciones del circuito: ${testCircuit}`);
    const updateResult = await updateCircuitPositions(testCircuit);
    
    if (updateResult.success) {
      console.log(`   ✅ Posiciones actualizadas exitosamente`);
      console.log(`   Total de tiempos procesados: ${updateResult.totalTimings}`);
      console.log(`   Actualizaciones exitosas: ${updateResult.successfulUpdates}`);
      
      if (updateResult.failedUpdates > 0) {
        console.log(`   ⚠️  Actualizaciones fallidas: ${updateResult.failedUpdates}`);
      }
    } else {
      console.log(`   ❌ Error al actualizar posiciones: ${updateResult.error}`);
    }

    console.log(`\n3️⃣ Obteniendo ranking actualizado del circuito: ${testCircuit}`);
    const updatedRanking = await getCircuitRanking(testCircuit);
    console.log(`   Ranking actualizado: ${updatedRanking.length} vehículos`);
    
    if (updatedRanking.length > 0) {
      console.log('   Primeros 3 vehículos:');
      updatedRanking.slice(0, 3).forEach((entry, index) => {
        const changeIcon = entry.position_change > 0 ? '⬆️' : entry.position_change < 0 ? '⬇️' : '➡️';
        const changeText = entry.position_change > 0 ? `+${entry.position_change}` : entry.position_change < 0 ? `${entry.position_change}` : '0';
        console.log(`   ${index + 1}. Vehículo ${entry.vehicle_id} - P${entry.current_position} ${changeIcon} (cambio: ${changeText})`);
      });
      
      // Mostrar cambios de posición
      console.log('\n   📊 Cambios de posición detectados:');
      const upChanges = updatedRanking.filter(entry => entry.position_change > 0);
      const downChanges = updatedRanking.filter(entry => entry.position_change < 0);
      const stablePositions = updatedRanking.filter(entry => entry.position_change === 0);
      
      if (upChanges.length > 0) {
        console.log(`   🟢 Vehículos que SUBIERON de posición (${upChanges.length}):`);
        upChanges.forEach(entry => {
          console.log(`      Vehículo ${entry.vehicle_id}: P${entry.previous_position} → P${entry.current_position} (+${entry.position_change})`);
        });
      }
      
      if (downChanges.length > 0) {
        console.log(`   🔴 Vehículos que BAJARON de posición (${downChanges.length}):`);
        downChanges.forEach(entry => {
          console.log(`      Vehículo ${entry.vehicle_id}: P${entry.previous_position} → P${entry.current_position} (${entry.position_change})`);
        });
      }
      
      if (stablePositions.length > 0) {
        console.log(`   🟡 Vehículos con posición ESTABLE (${stablePositions.length}):`);
        stablePositions.forEach(entry => {
          console.log(`      Vehículo ${entry.vehicle_id}: P${entry.current_position} (sin cambios)`);
        });
      }
      
      // Resumen estadístico
      console.log('\n   📈 Resumen de cambios:');
      console.log(`      Total de vehículos: ${updatedRanking.length}`);
      console.log(`      Subidas: ${upChanges.length}`);
      console.log(`      Bajadas: ${downChanges.length}`);
      console.log(`      Estables: ${stablePositions.length}`);
    }

  } catch (error) {
    console.error('❌ Error durante la prueba:', error);
  }
}

// Ejecutar la prueba si se llama directamente
if (require.main === module) {
  testPositionTracking();
}

module.exports = { testPositionTracking };



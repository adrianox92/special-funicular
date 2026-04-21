require('dotenv').config();

const { createServerClient } = require('../lib/supabaseClients');
const { updateCircuitPositions } = require('../lib/positionTracker');

const supabase = createServerClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

async function recalculateAllPositions() {
  console.log('Iniciando recálculo completo de posiciones...\n');

  try {
    // 1. Obtener todos los circuitos únicos
    console.log('Obteniendo lista de circuitos...');
    const { data: circuits, error: circuitsError } = await supabase
      .from('vehicle_timings')
      .select('circuit')
      .not('circuit', 'is', null)
      .neq('circuit', '')
      .order('circuit');

    if (circuitsError) {
      throw new Error(`Error al obtener circuitos: ${circuitsError.message}`);
    }

    const uniqueCircuits = [...new Set(circuits.map(c => c.circuit))];
    console.log(`[OK] Encontrados ${uniqueCircuits.length} circuitos únicos`);

    if (uniqueCircuits.length === 0) {
      console.log('[WARN] No hay circuitos para procesar');
      return;
    }

    // 2. Procesar cada circuito
    console.log('\nProcesando circuitos...');
    const results = [];
    
    for (const circuit of uniqueCircuits) {
      console.log(`\nProcesando circuito: ${circuit}`);
      
      try {
        const result = await updateCircuitPositions(circuit);
        results.push({
          circuit,
          success: result.success,
          totalTimings: result.totalTimings,
          successfulUpdates: result.successfulUpdates,
          failedUpdates: result.failedUpdates
        });

        if (result.success) {
          console.log(`   [OK] ${circuit}: ${result.successfulUpdates} actualizaciones exitosas`);
        } else {
          console.log(`   [ERR] ${circuit}: ${result.error}`);
        }
      } catch (error) {
        console.error(`   [ERR] Error procesando ${circuit}:`, error.message);
        results.push({
          circuit,
          success: false,
          error: error.message
        });
      }
    }

    // 3. Resumen final
    console.log('\nResumen del recálculo:');
    const successfulCircuits = results.filter(r => r.success);
    const failedCircuits = results.filter(r => !r.success);
    
    console.log(`   [OK] Circuitos procesados exitosamente: ${successfulCircuits.length}/${uniqueCircuits.length}`);
    console.log(`   [ERR] Circuitos con errores: ${failedCircuits.length}`);
    
    if (successfulCircuits.length > 0) {
      const totalUpdates = successfulCircuits.reduce((sum, r) => sum + (r.successfulUpdates || 0), 0);
      const totalTimings = successfulCircuits.reduce((sum, r) => sum + (r.totalTimings || 0), 0);
      console.log(`   Total de tiempos procesados: ${totalTimings}`);
      console.log(`   Total de actualizaciones: ${totalUpdates}`);
    }

    if (failedCircuits.length > 0) {
      console.log('\n[WARN] Circuitos con errores:');
      failedCircuits.forEach(r => {
        console.log(`   - ${r.circuit}: ${r.error}`);
      });
    }

    console.log('\n[OK] Recálculo de posiciones completado!');
    
    // 4. Verificar que las posiciones se calcularon correctamente
    console.log('\nVerificando resultados...');
    for (const circuit of uniqueCircuits.slice(0, 3)) { // Solo verificar los primeros 3
      try {
        const { data: timings, error } = await supabase
          .from('vehicle_timings')
          .select('current_position, previous_position, position_change')
          .eq('circuit', circuit)
          .not('current_position', 'is', null)
          .order('current_position')
          .limit(5);

        if (!error && timings.length > 0) {
          console.log(`   ${circuit}: ${timings.length} posiciones verificadas`);
          timings.forEach(t => {
            if (t.position_change !== 0) {
              const changeText = t.position_change > 0 ? `+${t.position_change}` : `${t.position_change}`;
              console.log(`     P${t.current_position} (cambio: ${changeText})`);
            }
          });
        }
      } catch (error) {
        console.log(`   [WARN] No se pudo verificar ${circuit}: ${error.message}`);
      }
    }

  } catch (error) {
    console.error('[ERR] Error durante el recálculo:', error);
    process.exit(1);
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  recalculateAllPositions();
}

module.exports = { recalculateAllPositions };


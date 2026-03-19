const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: SUPABASE_URL y SUPABASE_KEY deben estar definidos en .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Función para convertir tiempo de formato mm:ss.ms a segundos
 */
function timeToSeconds(timeStr) {
  if (!timeStr) return Infinity;
  const match = timeStr.match(/^(\d{2}):(\d{2})\.(\d{3})$/);
  if (!match) return Infinity;
  const [, minutes, seconds, milliseconds] = match.map(Number);
  return minutes * 60 + seconds + milliseconds / 1000;
}

/**
 * Script para actualizar posiciones basándose en:
 * - 1 posición por coche por carril
 * - Solo el mejor tiempo de cada coche en cada carril
 * - Carriles separados (carril 1 y carril 2 = posiciones independientes)
 */
async function fixPositionsByLane() {
  console.log('Iniciando corrección de posiciones por carril...');
  
  try {
    // 1. Resetear todas las posiciones
    console.log('\nReseteando todas las posiciones...');
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
      console.error('[ERR] Error al resetear posiciones:', resetError.message);
      return;
    }
    console.log('[OK] Posiciones reseteadas correctamente');

    // 2. Obtener todos los circuitos únicos
    console.log('\nObteniendo circuitos únicos...');
    const { data: circuits, error: circuitsError } = await supabase
      .from('vehicle_timings')
      .select('circuit')
      .not('circuit', 'is', null)
      .neq('circuit', '');

    if (circuitsError) {
      console.error('[ERR] Error al obtener circuitos:', circuitsError.message);
      return;
    }

    const uniqueCircuits = [...new Set(circuits.map(c => c.circuit))];
    console.log(`Encontrados ${uniqueCircuits.length} circuitos únicos:`, uniqueCircuits);

    // 3. Procesar cada circuito
    for (const circuit of uniqueCircuits) {
      console.log(`\nProcesando circuito: ${circuit}`);
      
      // Obtener todos los tiempos de este circuito
      const { data: allTimings, error: timingsError } = await supabase
        .from('vehicle_timings')
        .select('id, vehicle_id, best_lap_time, lane, laps')
        .eq('circuit', circuit)
        .not('best_lap_time', 'is', null);

      if (timingsError) {
        console.error(`[ERR] Error al obtener tiempos del circuito ${circuit}:`, timingsError.message);
        continue;
      }

      if (!allTimings || allTimings.length === 0) {
        console.log(`[INFO] No hay tiempos para el circuito: ${circuit}`);
        continue;
      }

              // 4. Agrupar por vehículo + carril + vueltas y obtener solo el mejor tiempo de cada combinación
        const bestTimingsByVehicleLaneLaps = {};
        
        allTimings.forEach(timing => {
          const key = `${timing.vehicle_id}-${timing.lane || 'sin-carril'}-${timing.laps || 'sin-vueltas'}`;
          const lapTime = timeToSeconds(timing.best_lap_time);
          
          if (!bestTimingsByVehicleLaneLaps[key] || lapTime < bestTimingsByVehicleLaneLaps[key].lapTime) {
            bestTimingsByVehicleLaneLaps[key] = {
              ...timing,
              lapTime
            };
          }
        });

        // Convertir a array y ordenar por mejor tiempo GLOBALMENTE
        const sortedTimings = Object.values(bestTimingsByVehicleLaneLaps)
          .sort((a, b) => a.lapTime - b.lapTime);

        console.log(`   ${sortedTimings.length} entradas únicas (vehículo+carril+vueltas)`);

        // 5. Asignar posiciones GLOBALES
        for (let i = 0; i < sortedTimings.length; i++) {
          const timing = sortedTimings[i];
          const position = i + 1;

          // Actualizar TODOS los tiempos de este vehículo en este carril, circuito y vueltas
          const { error: updateError } = await supabase
            .from('vehicle_timings')
            .update({
              current_position: position,
              previous_position: position, // No hay histórico, así que es la misma
              position_change: 0, // Sin cambios en la corrección inicial
              position_updated_at: new Date().toISOString()
            })
            .eq('vehicle_id', timing.vehicle_id)
            .eq('circuit', circuit)
            .eq('lane', timing.lane)
            .eq('laps', timing.laps || null);

          if (updateError) {
            console.error(`[ERR] Error al actualizar posición:`, updateError.message);
          } else {
            console.log(`   P${position}: Vehículo ${timing.vehicle_id} - Carril ${timing.lane} (${timing.laps || 'N/A'} vueltas) - ${timing.best_lap_time}`);
          }
        }
    }

    console.log('\nCorrección de posiciones completada exitosamente!');

    // 6. Verificar resultados
    console.log('\nVerificando posiciones actualizadas...');
    for (const circuit of uniqueCircuits.slice(0, 2)) {
      const { data: verifyTimings, error: verifyError } = await supabase
        .from('vehicle_timings')
        .select('vehicle_id, best_lap_time, current_position, lane, laps')
        .eq('circuit', circuit)
        .not('current_position', 'is', null)
        .order('lane')
        .order('current_position')
        .limit(10);

      if (!verifyError && verifyTimings) {
        console.log(`\nRanking en ${circuit}:`);
        verifyTimings.forEach(t => {
          console.log(`   P${t.current_position} (Carril ${t.lane}): Vehículo ${t.vehicle_id} - ${t.best_lap_time} (${t.laps || 'N/A'} vueltas)`);
        });
      }
    }

  } catch (error) {
    console.error('[ERR] Error durante la corrección:', error);
  }
}

// Ejecutar el script
fixPositionsByLane();

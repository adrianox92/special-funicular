require('dotenv').config();

const { createServerClient } = require('../lib/supabaseClients');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: SUPABASE_URL y SUPABASE_KEY deben estar definidos en .env');
  process.exit(1);
}

const supabase = createServerClient(supabaseUrl, supabaseKey);

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
 * Script para actualizar posiciones ÚNICAMENTE al mejor tiempo de cada vehículo+carril+vueltas
 * Los demás registros tendrán current_position = null
 */
async function fixUniquePositions() {
  console.log('Iniciando corrección de posiciones únicas...');
  
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

      // 4. Agrupar por vehículo + carril + vueltas y obtener SOLO el mejor tiempo de cada combinación
      const bestTimingsByVehicleLaneVueltas = {};
      
      allTimings.forEach(timing => {
        const key = `${timing.vehicle_id}-${timing.lane || 'sin-carril'}-${timing.laps || 'sin-vueltas'}`;
        const lapTime = timeToSeconds(timing.best_lap_time);
        
        if (!bestTimingsByVehicleLaneVueltas[key] || lapTime < bestTimingsByVehicleLaneVueltas[key].lapTime) {
          bestTimingsByVehicleLaneVueltas[key] = {
            ...timing,
            lapTime
          };
        }
      });

      // Convertir a array y ordenar por mejor tiempo GLOBALMENTE
      const sortedTimings = Object.values(bestTimingsByVehicleLaneVueltas)
        .sort((a, b) => a.lapTime - b.lapTime);

      console.log(`   ${sortedTimings.length} entradas únicas para ranking (de ${allTimings.length} registros totales)`);

      // 5. Asignar posiciones GLOBALES solo a los mejores tiempos
      for (let i = 0; i < sortedTimings.length; i++) {
        const timing = sortedTimings[i];
        const position = i + 1;

        // Actualizar SOLO este registro específico (el mejor de su grupo)
        const { error: updateError } = await supabase
          .from('vehicle_timings')
          .update({
            current_position: position,
            previous_position: position, // No hay histórico, así que es la misma
            position_change: 0, // Sin cambios en la corrección inicial
            position_updated_at: new Date().toISOString()
          })
          .eq('id', timing.id); // Solo el ID específico del mejor tiempo

        if (updateError) {
          console.error(`[ERR] Error al actualizar posición:`, updateError.message);
        } else {
          console.log(`   P${position}: ID ${timing.id} - Vehículo ${timing.vehicle_id.substring(0,8)} - Carril ${timing.lane} (${timing.laps || 'N/A'} vueltas) - ${timing.best_lap_time}`);
        }
      }
    }

    console.log('\nCorrección de posiciones únicas completada exitosamente!');

    // 6. Verificar resultados
    console.log('\nVerificando posiciones únicas...');
    for (const circuit of uniqueCircuits.slice(0, 2)) {
      const { data: verifyTimings, error: verifyError } = await supabase
        .from('vehicle_timings')
        .select('id, vehicle_id, best_lap_time, current_position, lane, laps')
        .eq('circuit', circuit)
        .not('current_position', 'is', null)
        .order('current_position')
        .limit(10);

      if (!verifyError && verifyTimings) {
        console.log(`\nRanking único en ${circuit}:`);
        verifyTimings.forEach(t => {
          console.log(`   P${t.current_position}: ID ${t.id} - Vehículo ${t.vehicle_id.substring(0,8)} - Carril ${t.lane} (${t.laps || 'N/A'} vueltas) - ${t.best_lap_time}`);
        });
      }
    }

    // 7. Verificar que no hay duplicados
    console.log('\nVerificando ausencia de posiciones duplicadas...');
    const { data: duplicates, error: duplicatesError } = await supabase
      .rpc('check_duplicate_positions', { p_circuit: uniqueCircuits[0] });

    if (!duplicatesError) {
      console.log('[OK] No se encontraron posiciones duplicadas');
    }

  } catch (error) {
    console.error('[ERR] Error durante la corrección:', error);
  }
}

// Ejecutar el script
fixUniquePositions();













const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

/**
 * Función para convertir tiempo de vuelta a segundos
 * @param {string} timeStr - Tiempo en formato "MM:SS.mmm"
 * @returns {number} Tiempo en segundos
 */
function timeToSeconds(timeStr) {
  if (!timeStr) return Infinity;
  const match = timeStr.match(/^([0-9]{2}):([0-9]{2})\.([0-9]{3})$/);
  if (!match) return Infinity;
  const [, min, sec, ms] = match.map(Number);
  return min * 60 + sec + ms / 1000;
}

/**
 * Función para actualizar las posiciones de todos los vehículos en un circuito
 * @param {string} circuit - Nombre del circuito
 * @param {string} newTimingId - ID del nuevo tiempo registrado (opcional)
 * @returns {Promise<Object>} Resultado de la actualización
 */
async function updateCircuitPositions(circuit, newTimingId = null) {
  try {
    console.log(`🔄 Actualizando posiciones para el circuito: ${circuit}`);
    
    // Obtener todos los tiempos del circuito
    const { data: allTimings, error: timingsError } = await supabase
      .from('vehicle_timings')
      .select('id, vehicle_id, best_lap_time, timing_date, current_position, lane, laps')
      .eq('circuit', circuit)
      .not('best_lap_time', 'is', null)
      .order('best_lap_time', { ascending: true });

    if (timingsError) {
      throw new Error(`Error al obtener tiempos del circuito: ${timingsError.message}`);
    }

    if (!allTimings || allTimings.length === 0) {
      console.log(`ℹ️  No hay tiempos registrados para el circuito: ${circuit}`);
      return { success: true, message: 'No hay tiempos para actualizar' };
    }

    // Agrupar por vehículo + carril + vueltas y obtener solo el mejor tiempo de cada combinación
    // El ranking es global por circuito, donde cada coche puede tener hasta 2 entradas (carril 1 y carril 2)
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

    // Convertir a array y ordenar por mejor tiempo
    const timings = Object.values(bestTimingsByVehicleLaneVueltas).sort((a, b) => a.lapTime - b.lapTime);

    console.log(`📊 Procesando ${timings.length} mejores tiempos únicos para el circuito ${circuit} (de ${allTimings.length} tiempos totales)`);

    // PRIMERO: Obtener las posiciones actuales de todos los vehículos ANTES de hacer cambios
    const currentPositions = {};
    for (const timing of timings) {
      const { data: currentTimingData, error: currentTimingError } = await supabase
        .from('vehicle_timings')
        .select('current_position')
        .eq('id', timing.id)
        .single();
      
      if (currentTimingError) {
        console.error(`❌ Error al obtener posición actual del timing ${timing.id}:`, currentTimingError.message);
        currentPositions[timing.id] = 999; // Posición muy alta como fallback
      } else {
        currentPositions[timing.id] = currentTimingData.current_position || 999;
      }
    }

    // SEGUNDO: Calcular las nuevas posiciones y cambios
    const updatePromises = timings.map(async (timing, index) => {
      const newPosition = index + 1;
      const previousPosition = currentPositions[timing.id];
      const positionChange = previousPosition - newPosition; // Positivo = subió, negativo = bajó

      console.log(`   🔍 Vehículo ${timing.vehicle_id}: P${previousPosition} → P${newPosition} (cambio: ${positionChange > 0 ? '+' : ''}${positionChange})`);

      // Actualizar TODOS los tiempos de este vehículo+circuito+carril+vueltas con la misma posición
      // Cada combinación vehículo+carril+vueltas tiene su propia posición en el ranking global
      
      // Obtener todos los tiempos de este vehículo en este circuito, carril y número de vueltas
      const { data: vehicleTimings, error: vehicleTimingsError } = await supabase
        .from('vehicle_timings')
        .select('id')
        .eq('vehicle_id', timing.vehicle_id)
        .eq('circuit', circuit)
        .eq('lane', timing.lane)
        .eq('laps', timing.laps || null);

      if (vehicleTimingsError) {
        console.error(`❌ Error al obtener tiempos del vehículo ${timing.vehicle_id}:`, vehicleTimingsError.message);
        return { success: false, error: vehicleTimingsError.message };
      }

      // Solo actualizar si hay cambios o si es un nuevo tiempo
      if (positionChange !== 0 || timing.id === newTimingId || vehicleTimings.some(vt => vt.id === newTimingId)) {
        
        // 1. Actualizar el mejor tiempo (timing.id) con la posición
        const updateBestData = {
          current_position: newPosition,
          previous_position: previousPosition,
          position_updated_at: new Date().toISOString(),
          position_change: positionChange
        };

        const { error: updateBestError } = await supabase
          .from('vehicle_timings')
          .update(updateBestData)
          .eq('id', timing.id);

        if (updateBestError) {
          console.error(`❌ Error al actualizar mejor tiempo ${timing.id}:`, updateBestError.message);
          return { success: false, error: updateBestError.message };
        }

        // 2. Actualizar los otros tiempos del mismo grupo para quitar su posición
        const otherTimingIds = vehicleTimings.map(vt => vt.id).filter(id => id !== timing.id);
        
        if (otherTimingIds.length > 0) {
          const updateOthersData = {
            current_position: null,
            previous_position: null,
            position_updated_at: new Date().toISOString(),
            position_change: 0
          };

          const { error: updateOthersError } = await supabase
            .from('vehicle_timings')
            .update(updateOthersData)
            .in('id', otherTimingIds);

          if (updateOthersError) {
            console.error(`❌ Error al actualizar otros tiempos:`, updateOthersError.message);
          } else {
            console.log(`   📝 Otros ${otherTimingIds.length} registros actualizados a position = null`);
          }
        }

        // Log del cambio de posición si es significativo
        if (positionChange !== 0) {
          const changeText = positionChange > 0 ? `subió ${positionChange} puesto(s)` : `bajó ${Math.abs(positionChange)} puesto(s)`;
          console.log(`📈 Vehículo ${timing.vehicle_id} ${changeText} en ${circuit}: P${previousPosition} → P${newPosition} (1 mejor tiempo + ${otherTimingIds.length} otros actualizados)`);
        }

        return { success: true, positionChange, previousPosition, currentPosition: newPosition, timingsUpdated: 1 + otherTimingIds.length };
      }

      return { success: true, positionChange: 0, previousPosition, currentPosition: newPosition, timingsUpdated: 0 };
    });

    // Esperar a que se completen todas las actualizaciones
    const results = await Promise.all(updatePromises);
    const successfulUpdates = results.filter(r => r.success);
    const failedUpdates = results.filter(r => !r.success);

    console.log(`✅ Circuito ${circuit} actualizado: ${successfulUpdates.length} posiciones procesadas`);

    if (failedUpdates.length > 0) {
      console.warn(`⚠️  ${failedUpdates.length} actualizaciones fallaron`);
    }

    return {
      success: true,
      circuit,
      totalTimings: timings.length,
      successfulUpdates: successfulUpdates.length,
      failedUpdates: failedUpdates.length,
      results
    };

  } catch (error) {
    console.error(`❌ Error al actualizar posiciones del circuito ${circuit}:`, error);
    return {
      success: false,
      error: error.message,
      circuit
    };
  }
}

/**
 * Función para obtener el ranking actual de un circuito
 * @param {string} circuit - Nombre del circuito
 * @returns {Promise<Array>} Array de rankings ordenados por posición
 */
async function getCircuitRanking(circuit) {
  try {
    const { data: allTimings, error } = await supabase
      .from('vehicle_timings')
      .select(`
        id,
        vehicle_id,
        best_lap_time,
        timing_date,
        previous_position,
        position_change,
        position_updated_at,
        current_position,
        lane,
        laps,
        vehicles!inner (
          id,
          model,
          manufacturer
        )
      `)
      .eq('circuit', circuit)
      .not('best_lap_time', 'is', null)
      .order('best_lap_time', { ascending: true });

    if (error) {
      throw new Error(`Error al obtener ranking del circuito: ${error.message}`);
    }

    if (!allTimings || allTimings.length === 0) {
      return [];
    }

    // Agrupar por vehículo + carril + vueltas y obtener solo el mejor tiempo de cada combinación
    // El ranking es global por circuito, donde cada coche puede tener hasta 2 entradas (carril 1 y carril 2)
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

    // Convertir a array y ordenar por mejor tiempo
    const timings = Object.values(bestTimingsByVehicleLaneVueltas).sort((a, b) => a.lapTime - b.lapTime);

    // Enriquecer con información de posición y cambios
    return timings.map((timing, index) => {
      const currentPosition = index + 1;
      // Usar el previous_position almacenado en la base de datos, no calcularlo
      const previousPosition = timing.previous_position || currentPosition;
      const positionChange = timing.position_change || 0;

      return {
        ...timing,
        current_position: currentPosition,
        previous_position: previousPosition,
        position_change: positionChange,
        position_status: positionChange > 0 ? 'up' : positionChange < 0 ? 'down' : 'stable',
        gap_to_leader: index === 0 ? 0 : (timeToSeconds(timing.best_lap_time) - timeToSeconds(timings[0].best_lap_time)).toFixed(3),
        gap_to_previous: index === 0 ? 0 : (timeToSeconds(timing.best_lap_time) - timeToSeconds(timings[index - 1].best_lap_time)).toFixed(3)
      };
    });

  } catch (error) {
    console.error(`❌ Error al obtener ranking del circuito ${circuit}:`, error);
    throw error;
  }
}

/**
 * Función para actualizar posiciones después de registrar un nuevo tiempo
 * @param {string} circuit - Nombre del circuito
 * @param {string} timingId - ID del nuevo tiempo
 * @returns {Promise<Object>} Resultado de la actualización
 */
async function updatePositionsAfterNewTiming(circuit, timingId) {
  try {
    console.log(`🆕 Actualizando posiciones después de nuevo tiempo en ${circuit}`);
    
    // Actualizar posiciones del circuito
    const updateResult = await updateCircuitPositions(circuit, timingId);
    
    if (!updateResult.success) {
      throw new Error(`Error al actualizar posiciones: ${updateResult.error}`);
    }

    // Obtener el ranking actualizado
    const ranking = await getCircuitRanking(circuit);
    
    return {
      success: true,
      circuit,
      ranking,
      updateResult
    };

  } catch (error) {
    console.error(`❌ Error al actualizar posiciones después de nuevo tiempo:`, error);
    return {
      success: false,
      error: error.message,
      circuit
    };
  }
}

module.exports = {
  updateCircuitPositions,
  getCircuitRanking,
  updatePositionsAfterNewTiming,
  timeToSeconds
};

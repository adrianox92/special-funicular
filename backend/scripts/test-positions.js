const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY deben estar definidos en .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testPositions() {
  console.log('🧪 Probando posiciones antes y después del cambio...');
  
  try {
    // Obtener un circuito con múltiples tiempos
    const { data: circuits } = await supabase
      .from('vehicle_timings')
      .select('circuit')
      .not('circuit', 'is', null)
      .neq('circuit', '');

    if (!circuits || circuits.length === 0) {
      console.log('⚠️  No hay circuitos con tiempos');
      return;
    }

    const uniqueCircuits = [...new Set(circuits.map(c => c.circuit))];
    const testCircuit = uniqueCircuits[0];

    console.log(`🏁 Probando con circuito: ${testCircuit}`);

    // Obtener todos los tiempos de este circuito
    const { data: allTimings } = await supabase
      .from('vehicle_timings')
      .select(`
        id,
        vehicle_id,
        best_lap_time,
        current_position,
        lane,
        vehicles!inner (
          manufacturer,
          model
        )
      `)
      .eq('circuit', testCircuit)
      .not('best_lap_time', 'is', null)
      .order('best_lap_time', { ascending: true });

    console.log(`\n📊 Total de tiempos en ${testCircuit}: ${allTimings.length}`);

    // Agrupar por vehículo + carril
    const groupedByVehicleLane = {};
    allTimings.forEach(timing => {
      const key = `${timing.vehicle_id}-${timing.lane || 'sin-carril'}`;
      if (!groupedByVehicleLane[key]) {
        groupedByVehicleLane[key] = [];
      }
      groupedByVehicleLane[key].push(timing);
    });

    console.log(`📊 Combinaciones vehículo+carril únicas: ${Object.keys(groupedByVehicleLane).length}`);
    
    // Mostrar algunos ejemplos
    console.log('\n🔍 Primeros 10 tiempos en la base de datos:');
    allTimings.slice(0, 10).forEach((timing, index) => {
      console.log(`   ${index + 1}. P${timing.current_position || 'SIN POS'}: ${timing.vehicles.manufacturer} ${timing.vehicles.model} - ${timing.best_lap_time} (Carril: ${timing.lane || 'N/A'})`);
    });

    // Mostrar agrupaciones
    console.log('\n📝 Agrupaciones por vehículo+carril:');
    Object.entries(groupedByVehicleLane).slice(0, 5).forEach(([key, timings]) => {
      const [vehicleId, lane] = key.split('-');
      const vehicle = timings[0].vehicles;
      const bestTime = Math.min(...timings.map(t => {
        const [minutes, seconds] = t.best_lap_time.split(':');
        const [secs, ms] = seconds.split('.');
        return parseInt(minutes) * 60 + parseInt(secs) + parseInt(ms) / 1000;
      }));
      
      console.log(`   ${vehicle.manufacturer} ${vehicle.model} (Carril: ${lane}): ${timings.length} tiempos, mejor: ${timings.find(t => {
        const [minutes, seconds] = t.best_lap_time.split(':');
        const [secs, ms] = seconds.split('.');
        return (parseInt(minutes) * 60 + parseInt(secs) + parseInt(ms) / 1000) === bestTime;
      }).best_lap_time}`);
    });

  } catch (error) {
    console.error('❌ Error durante la prueba:', error);
  }
}

testPositions();


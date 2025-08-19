const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY deben estar definidos en .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testPositionTracking() {
  console.log('🧪 Iniciando pruebas del sistema de seguimiento de posiciones...');
  
  try {
    // 1. Verificar que los campos existen
    console.log('\n📋 Verificando campos de la base de datos...');
    
    const { data: tableInfo, error: tableError } = await supabase
      .from('vehicle_timings')
      .select('previous_position, position_change, position_updated_at')
      .limit(1);
    
    if (tableError) {
      console.error('❌ Error al verificar campos:', tableError.message);
      return;
    }
    
    console.log('✅ Campos de posición verificados correctamente');
    
    // 2. Obtener circuitos existentes
    console.log('\n🔍 Obteniendo circuitos existentes...');
    
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
      console.log('⚠️  No hay circuitos para probar. Añade algunos tiempos con circuito para probar la funcionalidad.');
      return;
    }
    
    // 3. Probar con el primer circuito
    const testCircuit = uniqueCircuits[0];
    console.log(`\n🏁 Probando con el circuito: ${testCircuit}`);
    
    // Obtener ranking actual del circuito
    const { data: timings, error: timingsError } = await supabase
      .from('vehicle_timings')
      .select(`
        id,
        vehicle_id,
        best_lap_time,
        timing_date,
        previous_position,
        position_change,
        position_updated_at,
        vehicles!inner (
          id,
          model,
          manufacturer
        )
      `)
      .eq('circuit', testCircuit)
      .not('best_lap_time', 'is', null)
      .order('best_lap_time', { ascending: true });
    
    if (timingsError) {
      console.error('❌ Error al obtener tiempos del circuito:', timingsError.message);
      return;
    }
    
    console.log(`📊 Circuito ${testCircuit}: ${timings.length} tiempos encontrados`);
    
    // Mostrar ranking actual
    console.log('\n🏆 Ranking actual del circuito:');
    timings.forEach((timing, index) => {
      const position = index + 1;
      const previousPosition = timing.previous_position || position;
      const positionChange = timing.position_change || 0;
      const changeText = positionChange > 0 ? `⬆️ +${positionChange}` : 
                        positionChange < 0 ? `⬇️ ${positionChange}` : '➡️ 0';
      
      console.log(`  ${position}. ${timing.vehicles.manufacturer} ${timing.vehicles.model} - ${timing.best_lap_time} ${changeText}`);
    });
    
    // 4. Simular un cambio de posición (opcional)
    console.log('\n🔄 Para probar cambios de posición:');
    console.log('   1. Registra un nuevo tiempo en el circuito');
    console.log('   2. O modifica un tiempo existente');
    console.log('   3. Las posiciones se actualizarán automáticamente');
    
    // 5. Verificar estadísticas
    console.log('\n📈 Estadísticas del sistema:');
    
    const { data: stats, error: statsError } = await supabase
      .from('vehicle_timings')
      .select('position_change')
      .not('circuit', 'is', null)
      .not('position_change', 'is', null);
    
    if (!statsError && stats) {
      const totalChanges = stats.length;
      const upChanges = stats.filter(s => s.position_change > 0).length;
      const downChanges = stats.filter(s => s.position_change < 0).length;
      const stablePositions = stats.filter(s => s.position_change === 0).length;
      
      console.log(`   Total de cambios registrados: ${totalChanges}`);
      console.log(`   Subidas de posición: ${upChanges}`);
      console.log(`   Bajadas de posición: ${downChanges}`);
      console.log(`   Posiciones estables: ${stablePositions}`);
    }
    
    console.log('\n✅ Pruebas completadas exitosamente!');
    console.log('\n💡 Para probar la funcionalidad completa:');
    console.log('   1. Ejecuta la migración: node scripts/migrate-add-position-tracking.js');
    console.log('   2. Registra nuevos tiempos en diferentes circuitos');
    console.log('   3. Observa cómo se actualizan las posiciones automáticamente');
    console.log('   4. Verifica los cambios en la interfaz web');
    
  } catch (error) {
    console.error('❌ Error durante las pruebas:', error);
  }
}

// Ejecutar las pruebas
testPositionTracking();



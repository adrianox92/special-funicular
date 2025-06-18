// Script de prueba para verificar el cálculo de puntos
const axios = require('axios');

async function testPointsCalculation() {
  try {
    // Reemplaza con el ID de tu competición de prueba
    const competitionId = 'a96fc1bf-64ef-4d51-ba2a-376109761fc6';
    
    console.log('🧪 Probando cálculo de puntos...');
    
    // Obtener progreso y puntos
    const response = await axios.get(`http://localhost:3001/api/competitions/${competitionId}/progress`);
    
    console.log('📊 Datos de progreso:');
    console.log('- Participantes:', response.data.participants_count);
    console.log('- Rondas:', response.data.rounds);
    console.log('- Tiempos registrados:', response.data.times_registered);
    console.log('- Total requerido:', response.data.total_required_times);
    console.log('- Completada:', response.data.is_completed);
    console.log('- Progreso:', response.data.progress_percentage + '%');
    
    console.log('\n🏆 Puntos por participante:');
    response.data.participant_stats.forEach(participant => {
      console.log(`- Participante ${participant.participant_id}: ${participant.points} puntos`);
    });
    
    console.log('\n📋 Tiempos por ronda:');
    Object.entries(response.data.times_by_round).forEach(([round, timings]) => {
      console.log(`Ronda ${round}:`);
      timings.forEach(timing => {
        const penalty = Number(timing.penalty_seconds) || 0;
        console.log(`  - ${timing.participant_id}: ${timing.total_time} + ${penalty}s penalización`);
      });
    });
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

testPointsCalculation(); 
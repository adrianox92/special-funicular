const express = require('express');
const router = express.Router();
const { OpenAI } = require('openai');
const { createClient } = require('@supabase/supabase-js');
const authMiddleware = require('../middleware/auth');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Crear el cliente de Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// Aplicar middleware de autenticación a todas las rutas
router.use(authMiddleware);

// Función auxiliar para obtener métricas del dashboard
async function getUserDashboardMetrics(userId) {
  const { data: vehicles, error: vehiclesError } = await supabase
    .from('vehicles')
    .select('*')
    .eq('user_id', userId);

  if (vehiclesError) throw vehiclesError;

  // Calcular métricas relevantes
  const totalVehicles = vehicles.length;
  const modifiedVehicles = vehicles.filter(vehicle => vehicle.modified).length;
  const totalInvestment = vehicles.reduce((acc, vehicle) => acc + (vehicle.total_price || 0), 0);
  const basePriceTotal = vehicles.reduce((acc, vehicle) => acc + (vehicle.price || 0), 0);
  const modificationInvestment = totalInvestment - basePriceTotal;
  
  // Análisis por marca
  const vehiclesByBrand = vehicles.reduce((acc, vehicle) => {
    acc[vehicle.manufacturer] = (acc[vehicle.manufacturer] || 0) + 1;
    return acc;
  }, {});

  // Análisis de precios
  const averagePriceIncrease = vehicles.reduce((acc, vehicle) => {
    if (vehicle.price && vehicle.total_price) {
      return acc + ((vehicle.total_price - vehicle.price) / vehicle.price * 100);
    }
    return acc;
  }, 0) / (modifiedVehicles || 1);

  // Encontrar el vehículo con mayor incremento
  const vehicleWithHighestIncrease = vehicles.reduce((max, vehicle) => {
    if (!vehicle.price || !vehicle.total_price) return max;
    const increase = ((vehicle.total_price - vehicle.price) / vehicle.price) * 100;
    return increase > (max.increase || 0) ? { ...vehicle, increase } : max;
  }, {});

  // Análisis de modificaciones
  const modificationTypes = vehicles.reduce((acc, vehicle) => {
    if (vehicle.technical_specs) {
      const specs = JSON.parse(vehicle.technical_specs);
      specs.forEach(spec => {
        if (spec.is_modification && spec.components) {
          spec.components.forEach(comp => {
            acc[comp.type] = (acc[comp.type] || 0) + 1;
          });
        }
      });
    }
    return acc;
  }, {});

  return {
    totalVehicles,
    modifiedVehicles,
    totalInvestment,
    basePriceTotal,
    modificationInvestment,
    vehiclesByBrand,
    averagePriceIncrease,
    vehicleWithHighestIncrease,
    modificationTypes,
    modificationPercentage: (modifiedVehicles / totalVehicles) * 100
  };
}

// Función para construir el prompt de insights
function buildInsightPrompt(metrics) {
  return `
Analiza los siguientes datos de la colección de Scalextric y genera 3 insights relevantes y accionables:

DATOS DE LA COLECCIÓN:
- Total de vehículos: ${metrics.totalVehicles}
- Vehículos modificados: ${metrics.modifiedVehicles} (${metrics.modificationPercentage.toFixed(1)}% de la colección)
- Valor actual de la colección: ${metrics.totalInvestment.toFixed(2)}€
- Inversión en modificaciones: ${metrics.modificationInvestment.toFixed(2)}€
- Incremento promedio de precio por modificación: ${metrics.averagePriceIncrease.toFixed(1)}%
- Distribución por marca: ${JSON.stringify(metrics.vehiclesByBrand)}
- Tipos de modificaciones realizadas: ${JSON.stringify(metrics.modificationTypes)}

El vehículo con mayor incremento de precio es:
${metrics.vehicleWithHighestIncrease.model || 'N/A'} (${metrics.vehicleWithHighestIncrease.increase?.toFixed(1)}% de incremento)

Genera insights que sean:
1. Útiles para el coleccionista, enfocados en:
   - Oportunidades de mejora en la colección
   - ¿Los vehículos modificados rinden mejor en pista?
   - Balance entre vehículos modificados y de serie
   - Distribución de marcas y posibles gaps
2. Basados en datos concretos de la colección
3. Con sugerencias específicas y accionables
4. En español
5. Máximo 3 insights, cada uno con un título claro y una explicación concisa
`;
}

router.get('/insights-ia', async (req, res) => {
  try {
    const userId = req.user.id;
    const forceRegenerate = req.query.force === 'true';

    // 1. Buscar si ya hay insights generados recientemente
    const { data: existing, error: existingError } = await supabase
      .from('user_insights')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (existingError) throw existingError;

    const now = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(now.getDate() - 7);

    // Solo usar insights existentes si no se fuerza la regeneración y son recientes
    if (!forceRegenerate && existing && new Date(existing.generated_at) > sevenDaysAgo) {
      // Parsear los insights existentes
      let parsedInsights;
      try {
        // Si es un string, intentar parsearlo como JSON
        if (typeof existing.content === 'string') {
          parsedInsights = JSON.parse(existing.content);
        } else {
          parsedInsights = existing.content;
        }

        // Asegurarnos de que es un array
        if (!Array.isArray(parsedInsights)) {
          parsedInsights = [parsedInsights];
        }

        // Procesar los insights para asegurar el formato correcto
        const processedInsights = parsedInsights.map(item => {
          if (typeof item === 'string') {
            try {
              // Intentar parsear el string como JSON
              const parsed = JSON.parse(item);
              // Asegurarnos de que tiene el formato correcto
              if (parsed.title && parsed.content) {
                return {
                  title: parsed.title.replace(/^"|"$/g, ''),
                  content: parsed.content.replace(/^"|"$/g, '')
                };
              }
              // Si no tiene el formato correcto, intentar extraer título y contenido
              const colonIndex = item.indexOf(':');
              if (colonIndex > 0) {
                return {
                  title: item.substring(0, colonIndex).trim().replace(/^"|"$/g, ''),
                  content: item.substring(colonIndex + 1).trim().replace(/^"|"$/g, '')
                };
              }
              // Si no se puede extraer, devolver como contenido
              return {
                title: 'Insight',
                content: item.replace(/^"|"$/g, '')
              };
            } catch (e) {
              // Si no se puede parsear como JSON, intentar extraer título y contenido
              const colonIndex = item.indexOf(':');
              if (colonIndex > 0) {
                return {
                  title: item.substring(0, colonIndex).trim().replace(/^"|"$/g, ''),
                  content: item.substring(colonIndex + 1).trim().replace(/^"|"$/g, '')
                };
              }
              return {
                title: 'Insight',
                content: item.replace(/^"|"$/g, '')
              };
            }
          }
          // Si ya es un objeto, asegurarnos de que tiene el formato correcto
          if (item && typeof item === 'object') {
            return {
              title: (item.title || 'Insight').replace(/^"|"$/g, ''),
              content: (item.content || '').replace(/^"|"$/g, '')
            };
          }
          return {
            title: 'Insight',
            content: String(item).replace(/^"|"$/g, '')
          };
        });

        // Filtrar insights vacíos o inválidos
        const validInsights = processedInsights.filter(insight => 
          insight.title && insight.content && 
          insight.title.trim() !== '' && 
          insight.content.trim() !== ''
        );

        // Asegurarnos de que los insights tienen el formato correcto antes de enviarlos
        const finalInsights = validInsights.map(insight => ({
          title: insight.title.trim(),
          content: insight.content.trim()
        }));

        return res.json({ insights: finalInsights });
      } catch (parseError) {
        console.error('Error parsing insights:', parseError);
        // Si hay error al parsear, continuar con la regeneración
      }
    }

    // 2. Recalcular métricas del usuario
    const metrics = await getUserDashboardMetrics(userId);

    // 3. Generar con OpenAI
    const prompt = buildInsightPrompt(metrics);
    const completion = await openai.chat.completions.create({
      model: 'gpt-4-mini',
      messages: [
        { 
          role: 'system', 
          content: 'Eres un experto analista de colecciones de Scalextric. Genera 3 insights útiles y relevantes basados en datos concretos. Devuelve la respuesta en formato JSON, con un array llamado "insights", donde cada elemento tiene "title" y "content". Ejemplo:\n{\n  "insights": [\n    {"title": "Rentabilidad de las Modificaciones", "content": "El incremento promedio..."},\n    {"title": "Diversificación de Marcas", "content": "La colección..."},\n    {"title": "Oportunidad de Inversión", "content": "Se recomienda..."}\n  ]\n}\nNo uses comillas escapadas ni numeración. Responde solo con el JSON.' 
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.5
    });

    let insights = [];
    try {
      // Buscar el primer bloque JSON en la respuesta
      const match = completion.choices[0].message.content.match(/\{[\s\S]*\}/);
      if (match) {
        const json = JSON.parse(match[0]);
        if (json.insights && Array.isArray(json.insights)) {
          insights = json.insights.map(insight => ({
            title: (insight.title || '').trim(),
            content: (insight.content || '').trim()
          }));
        }
      }
    } catch (e) {
      console.error('Error parsing OpenAI JSON:', e);
    }

    // Si no se pudo parsear, insights será un array vacío
    if (!insights.length) {
      // Fallback: intentar extraer insights como antes
      const raw = completion.choices[0].message.content;
      insights = raw.split('\n\n')
        .filter(l => l.trim().length > 0)
        .slice(0, 3)
        .map(insight => {
          const colonIndex = insight.indexOf(':');
          if (colonIndex > 0) {
            const title = insight.substring(0, colonIndex).trim();
            const content = insight.substring(colonIndex + 1).trim();
            return {
              title: title.replace(/^"|"$/g, ''),
              content: content.replace(/^"|"$/g, '')
            };
          }
          return {
            title: `Insight`,
            content: insight.replace(/^"|"$/g, '')
          };
        });
    }

    // 5. Guardar/actualizar en Supabase
    if (existing) {
      const { error: updateError } = await supabase
        .from('user_insights')
        .update({ 
          content: insights, 
          generated_at: now.toISOString() 
        })
        .eq('user_id', userId);

      if (updateError) throw updateError;
    } else {
      const { error: insertError } = await supabase
        .from('user_insights')
        .insert([{ 
          user_id: userId, 
          content: insights,
          generated_at: now.toISOString()
        }]);

      if (insertError) throw insertError;
    }

    res.json({ insights });
  } catch (error) {
    console.error('Error generando insights:', error);
    res.status(500).json({ 
      error: 'Error generando insights',
      details: error.message 
    });
  }
});

module.exports = router; 
const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const authMiddleware = require('../middleware/auth');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Aplicar middleware de autenticación a todas las rutas
router.use(authMiddleware);

// Función para formatear tiempo de segundos a mm:ss.ms
const formatTime = (seconds) => {
  if (!seconds) return null;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = (seconds % 60).toFixed(3);
  return `${String(minutes).padStart(2, '0')}:${remainingSeconds.padStart(6, '0')}`;
};

// Función para convertir tiempo de formato mm:ss.ms a segundos
const timeToSeconds = (timeStr) => {
  if (!timeStr || typeof timeStr !== 'string') return null;
  const [minutes, seconds] = timeStr.split(':');
  if (!minutes || !seconds) return null;
  return Number(minutes) * 60 + Number(seconds);
};

router.get('/metrics', async (req, res) => {
  try {
    // Obtener total de vehículos y estadísticas básicas con todos los campos necesarios
    const { data: vehicles, error: vehiclesError } = await supabase
      .from('vehicles')
      .select(`
        id,
        model,
        manufacturer,
        price,
        total_price,
        modified,
        purchase_date,
        technical_specs (
          id,
          is_modification,
          components (
            price
          )
        ),
        vehicle_timings (
          best_lap_time,
          timing_date,
          circuit,
          laps,
          lane
        )
      `)
      .eq('user_id', req.user.id);

    if (vehiclesError) throw vehiclesError;

    // Calcular métricas básicas con redondeo
    const totalVehicles = vehicles.length;
    const modifiedVehicles = vehicles.filter(v => v.modified).length;
    const stockVehicles = totalVehicles - modifiedVehicles;
    
    // Calcular inversión total solo en modificaciones
    const totalInvestment = Number(vehicles
      .filter(v => v.modified && v.technical_specs?.length > 0)
      .reduce((sum, vehicle) => {
        // Sumar solo los componentes que son modificaciones
        const modificationCost = vehicle.technical_specs
          .filter(spec => spec.is_modification)
          .reduce((specSum, spec) => {
            const componentsCost = spec.components
              .reduce((compSum, comp) => compSum + (comp.price || 0), 0);
            return specSum + componentsCost;
          }, 0);
        return sum + modificationCost;
      }, 0)
      .toFixed(2));
    
    const averageInvestmentPerVehicle = modifiedVehicles > 0 
      ? Number((totalInvestment / modifiedVehicles).toFixed(2))
      : 0;

    // Calcular incremento promedio y mayor incremento
    const vehiclesWithIncrement = vehicles
      .filter(v => v.modified && v.price > 0 && v.total_price > v.price)
      .map(v => ({
        ...v,
        price_increment: Number(((v.total_price - v.price) / v.price * 100).toFixed(2))
      }))
      .sort((a, b) => b.price_increment - a.price_increment);

    const averagePriceIncrement = vehiclesWithIncrement.length > 0
      ? Number((vehiclesWithIncrement.reduce((sum, v) => sum + v.price_increment, 0) / 
                vehiclesWithIncrement.length).toFixed(2))
      : 0;

    const highestIncrementVehicle = vehiclesWithIncrement[0] ? {
      id: vehiclesWithIncrement[0].id,
      model: vehiclesWithIncrement[0].model || 'Sin modelo',
      manufacturer: vehiclesWithIncrement[0].manufacturer || 'Sin marca',
      price: Number(vehiclesWithIncrement[0].price.toFixed(2)),
      total_price: Number(vehiclesWithIncrement[0].total_price.toFixed(2)),
      price_increment: vehiclesWithIncrement[0].price_increment,
      purchase_date: vehiclesWithIncrement[0].purchase_date
    } : null;

    // Obtener coche con mejor tiempo absoluto
    const { data: bestTimeVehicle, error: bestTimeError } = await supabase
      .from('vehicle_timings')
      .select(`
        best_lap_time,
        timing_date,
        circuit,
        laps,
        lane,
        vehicles!inner (
          id,
          model,
          manufacturer
        )
      `)
      .eq('vehicles.user_id', req.user.id)
      .not('best_lap_time', 'is', null)
      .gt('best_lap_time', 0)
      .order('best_lap_time', { ascending: true })
      .limit(1)
      .single();

    

    if (bestTimeError && bestTimeError.code !== 'PGRST116') {
      throw bestTimeError;
    }

    // Calcular rendimiento promedio por tipo usando una consulta SQL más eficiente
    const { data: performanceByType, error: performanceError } = await supabase
      .from('vehicles')
      .select(`
        type,
        model,
        manufacturer,
        vehicle_timings (
          best_lap_time,
          timing_date
        )
      `)
      .eq('user_id', req.user.id);

    if (performanceError) throw performanceError;


    // Procesar datos de rendimiento por tipo
    const typePerformance = {};
    performanceByType.forEach(vehicle => {
      
      if (!vehicle.type) {
        return;
      }

      if (!typePerformance[vehicle.type]) {
        typePerformance[vehicle.type] = {
          total_time: 0,
          count: 0,
          vehicles: []
        };
      }

      // Solo procesar vehículos que tienen tiempos válidos
      const validTimings = vehicle.vehicle_timings?.filter(t => {
        const timeInSeconds = timeToSeconds(t.best_lap_time);
        return timeInSeconds !== null && timeInSeconds > 0;
      }) || [];


      if (validTimings.length > 0) {
        const bestTime = Math.min(...validTimings.map(t => timeToSeconds(t.best_lap_time)));
        
        typePerformance[vehicle.type].total_time += bestTime;
        typePerformance[vehicle.type].count++;
        typePerformance[vehicle.type].vehicles.push({
          model: vehicle.model || 'Sin modelo',
          manufacturer: vehicle.manufacturer || 'Sin marca',
          best_time: Number(bestTime.toFixed(2))
        });
      }
    });


    // Calcular promedios y ordenar vehículos por tipo
    Object.keys(typePerformance).forEach(type => {
      if (typePerformance[type].count > 0) {
        typePerformance[type].average_time = Number(
          (typePerformance[type].total_time / typePerformance[type].count).toFixed(2)
        );
        typePerformance[type].vehicles.sort((a, b) => a.best_time - b.best_time);
      }
    });


    // Calcular evolución del valor total de la colección por trimestres
    const getQuarterStartDate = (date) => {
      const d = new Date(date);
      const quarter = Math.floor(d.getMonth() / 3);
      return new Date(d.getFullYear(), quarter * 3, 1);
    };

    const getQuarterEndDate = (date) => {
      const d = new Date(date);
      const quarter = Math.floor(d.getMonth() / 3);
      return new Date(d.getFullYear(), (quarter + 1) * 3, 0);
    };

    // Ordenar vehículos por fecha de compra, usando la fecha actual para los que no tengan fecha
    const vehiclesByDate = vehicles
      .map(v => ({
        ...v,
        purchase_date: v.purchase_date || new Date().toISOString().split('T')[0]
      }))
      .sort((a, b) => new Date(a.purchase_date) - new Date(b.purchase_date));

    // Agrupar vehículos por trimestre
    const quarterlyData = vehiclesByDate.reduce((acc, vehicle) => {
      const purchaseDate = new Date(vehicle.purchase_date);
      const quarterStart = getQuarterStartDate(purchaseDate);
      const quarterKey = quarterStart.toISOString().split('T')[0];

      if (!acc[quarterKey]) {
        acc[quarterKey] = {
          date: quarterStart,
          endDate: getQuarterEndDate(purchaseDate),
          vehicles: [],
          totalValue: 0
        };
      }

      acc[quarterKey].vehicles.push(vehicle);
      acc[quarterKey].totalValue += Number(vehicle.total_price || vehicle.price || 0);

      return acc;
    }, {});

    // Convertir a array y calcular valores acumulados
    let accumulatedValue = 0;
    const investmentHistory = Object.values(quarterlyData)
      .sort((a, b) => a.date - b.date)
      .map(quarter => {
        accumulatedValue += quarter.totalValue ?? 0;
        return {
          date: quarter.date.toISOString().split('T')[0],
          endDate: quarter.endDate.toISOString().split('T')[0],
          value: Number((accumulatedValue ?? 0).toFixed(2)),
          vehicles: (quarter.vehicles || []).filter(v => v && typeof v.total_price === 'number').map(v => ({
            model: v.model || 'Sin modelo',
            manufacturer: v.manufacturer || 'Sin marca',
            price: v.total_price ? Number(v.total_price.toFixed(2)) : 0
          }))
        };
      });

    // Formatear fechas para la respuesta
    const formatDate = (dateString) => {
      if (!dateString) return null;
      const date = new Date(dateString);
      return date.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    };

    // Asegurarnos de que el best_lap_time se formatea correctamente
    const bestTimeResponse = bestTimeVehicle ? {
      id: bestTimeVehicle.vehicles.id,
      model: bestTimeVehicle.vehicles.model || 'Sin modelo',
      manufacturer: bestTimeVehicle.vehicles.manufacturer || 'Sin marca',
      best_lap_time: bestTimeVehicle.best_lap_time, // Mantener el valor original
      timing_date: formatDate(bestTimeVehicle.timing_date),
      circuit: bestTimeVehicle.circuit || 'No especificado',
      laps: bestTimeVehicle.laps || 'No especificado',
      lane: bestTimeVehicle.lane || 'No especificado'
    } : null;


    res.json({
      totalVehicles,
      modifiedVehicles,
      stockVehicles,
      totalInvestment,
      averageInvestmentPerVehicle,
      averagePriceIncrement,
      lastUpdate: formatDate(new Date()),
      highestIncrementVehicle: highestIncrementVehicle ? {
        ...highestIncrementVehicle,
        purchase_date: formatDate(highestIncrementVehicle.purchase_date)
      } : null,
      bestTimeVehicle: bestTimeResponse,
      performanceByType: typePerformance,
      investmentHistory
    });
  } catch (error) {
    console.error('Error al obtener métricas del dashboard:', error);
    res.status(500).json({ error: 'Error al obtener métricas del dashboard' });
  }
});

// Nuevo endpoint para obtener datos de gráficos y tablas
router.get('/charts', async (req, res) => {
  try {
    // 1. Gráfico de barras por tipo de coche
    const { data: vehiclesByType, error: vehiclesByTypeError } = await supabase
      .from('vehicles')
      .select('type, modified')
      .eq('user_id', req.user.id);

    if (vehiclesByTypeError) throw vehiclesByTypeError;

    // Procesar datos para el gráfico de barras
    const typeStats = vehiclesByType.reduce((acc, vehicle) => {
      if (!acc[vehicle.type]) {
        acc[vehicle.type] = {
          total: 0,
          modified: 0,
          stock: 0
        };
      }
      acc[vehicle.type].total++;
      if (vehicle.modified) {
        acc[vehicle.type].modified++;
      } else {
        acc[vehicle.type].stock++;
      }
      return acc;
    }, {});

    // 2. Gráfico circular (proporción modificados vs serie)
    const totalVehicles = vehiclesByType.length;
    const totalModified = vehiclesByType.filter(v => v.modified).length;
    const totalStock = totalVehicles - totalModified;

    // 3. Top 5 vehículos por mejor vuelta
    const { data: bestLaps, error: bestLapsError } = await supabase
      .from('vehicle_timings')
      .select(`
        best_lap_time,
        timing_date,
        circuit,
        vehicles (
          id,
          model,
          manufacturer
        )
      `)
      .eq('vehicles.user_id', req.user.id)
      .order('best_lap_time', { ascending: true })
      .limit(5);

    if (bestLapsError) throw bestLapsError;

    // 4. Top 5 vehículos con mayor coste
    const { data: topCostVehicles, error: topCostError } = await supabase
      .from('vehicles')
      .select('id, model, manufacturer, price, total_price')
      .eq('user_id', req.user.id)
      .gt('price', 0)
      .order('total_price', { ascending: false })
      .limit(5);

    if (topCostError) throw topCostError;

    // Procesar datos de costes
    const topCostVehiclesProcessed = topCostVehicles.map(vehicle => ({
      id: vehicle.id,
      model: vehicle.model,
      manufacturer: vehicle.manufacturer,
      basePrice: vehicle.price,
      totalPrice: vehicle.total_price,
      incrementPercentage: ((vehicle.total_price - vehicle.price) / vehicle.price) * 100
    }));

    // 5. Componentes más utilizados en modificaciones
    const { data: componentsData, error: componentsError } = await supabase
      .from('technical_specs')
      .select(`
        id,
        is_modification,
        components!inner (
          id,
          element,
          sku,
          price,
          component_type,
          url
        ),
        vehicles!inner (
          id,
          model,
          manufacturer
        )
      `)
      .eq('is_modification', true)
      .eq('vehicles.user_id', req.user.id);

    if (componentsError) throw componentsError;

    // Procesar datos de componentes agrupando por SKU y component_type
    const componentUsage = {};
    componentsData.forEach(spec => {
      const vehicleInfo = {
        id: spec.vehicles.id,
        model: spec.vehicles.model,
        manufacturer: spec.vehicles.manufacturer
      };

      spec.components.forEach(component => {
        // Usar combinación de SKU y component_type como clave
        const componentKey = component.sku 
          ? `${component.sku}-${component.component_type}`
          : `no-sku-${component.id}-${component.component_type}`;
        
        if (!componentUsage[componentKey]) {
          componentUsage[componentKey] = {
            id: component.id, // Mantener el ID del primer componente encontrado
            name: component.element,
            sku: component.sku,
            component_type: component.component_type,
            unitPrice: component.price,
            urls: new Set(), // Usar Set para evitar URLs duplicadas
            totalInvestment: 0,
            usageCount: 0,
            vehicles: []
          };
        }
        
        componentUsage[componentKey].usageCount++;
        componentUsage[componentKey].totalInvestment += component.price;
        
        // Añadir vehículo si no está ya en la lista
        if (!componentUsage[componentKey].vehicles.some(v => v.id === vehicleInfo.id)) {
          componentUsage[componentKey].vehicles.push(vehicleInfo);
        }

        // Añadir URL si existe y no está duplicada
        if (component.url) {
          componentUsage[componentKey].urls.add(component.url);
        }

        // Si encontramos un componente con la misma combinación SKU-tipo pero diferente nombre o precio,
        // actualizamos con la información más reciente
        if (component.element !== componentUsage[componentKey].name ||
            component.price !== componentUsage[componentKey].unitPrice) {
          componentUsage[componentKey].name = component.element;
          componentUsage[componentKey].unitPrice = component.price;
        }
      });
    });

    // Convertir Sets de URLs a arrays antes de enviar la respuesta
    const topComponents = Object.values(componentUsage)
      .map(component => ({
        ...component,
        urls: Array.from(component.urls)
      }))
      .sort((a, b) => b.totalInvestment - a.totalInvestment)
      .slice(0, 10); // Top 10 componentes

    // 6. Distribución de marcas
    const { data: vehiclesByBrand, error: brandsError } = await supabase
      .from('vehicles')
      .select('manufacturer')
      .eq('user_id', req.user.id);

    if (brandsError) throw brandsError;

    // Procesar datos de marcas
    const brandDistribution = vehiclesByBrand.reduce((acc, vehicle) => {
      const brand = vehicle.manufacturer;
      acc[brand] = (acc[brand] || 0) + 1;
      return acc;
    }, {});

    // 7. Distribución de tiendas
    const { data: vehiclesByStore, error: storesError } = await supabase
      .from('vehicles')
      .select('purchase_place')
      .eq('user_id', req.user.id);

    if (storesError) throw storesError;

    // Procesar datos de tiendas
    const storeDistribution = vehiclesByStore.reduce((acc, vehicle) => {
      const store = vehicle.purchase_place || 'No especificada';
      acc[store] = (acc[store] || 0) + 1;
      return acc;
    }, {});

    res.json({
      vehiclesByType: Object.entries(typeStats).map(([type, stats]) => ({
        type,
        total: stats.total,
        modified: stats.modified,
        stock: stats.stock
      })),
      modificationStats: {
        total: totalVehicles,
        modified: totalModified,
        stock: totalStock,
        modifiedPercentage: (totalModified / totalVehicles) * 100
      },
      bestLaps: bestLaps
        .filter(lap => lap.vehicles !== null) // Filtrar registros sin vehículo
        .map(lap => ({
          id: lap.vehicles.id,
          model: lap.vehicles.model || 'Sin modelo',
          manufacturer: lap.vehicles.manufacturer || 'Sin marca',
          bestTime: lap.best_lap_time,
          circuit: lap.circuit || 'No especificado',
          date: lap.timing_date
        })),
      topCostVehicles: topCostVehiclesProcessed,
      topComponents,
      brandDistribution: Object.entries(brandDistribution).map(([brand, count]) => ({
        name: brand,
        value: count
      })),
      storeDistribution: Object.entries(storeDistribution).map(([store, count]) => ({
        name: store,
        value: count
      }))
    });
  } catch (error) {
    console.error('Error al obtener datos de gráficos:', error);
    res.status(500).json({ error: 'Error al obtener datos de gráficos' });
  }
});

module.exports = router; 
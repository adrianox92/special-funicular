const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

// Verificar que las variables de entorno necesarias estén definidas
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
  console.error('Error: Las variables de entorno SUPABASE_URL y SUPABASE_KEY son requeridas.');
  console.error('Asegúrate de que el archivo .env existe en el directorio raíz del proyecto y contiene estas variables.');
  process.exit(1);
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function migrateTechnicalSpecs() {
  try {
    console.log('Iniciando migración de especificaciones técnicas...');

    // 1. Obtener todos los vehículos
    const { data: vehicles, error: vehiclesError } = await supabase
      .from('vehicles')
      .select('id');

    if (vehiclesError) throw vehiclesError;

    console.log(`Encontrados ${vehicles.length} vehículos`);

    for (const vehicle of vehicles) {
      console.log(`\nProcesando vehículo ${vehicle.id}...`);

      // 2. Obtener todas las especificaciones técnicas del vehículo
      const { data: specs, error: specsError } = await supabase
        .from('technical_specs')
        .select('*, components(*)')
        .eq('vehicle_id', vehicle.id);

      if (specsError) throw specsError;

      if (specs.length <= 2) {
        console.log(`El vehículo ${vehicle.id} ya tiene ${specs.length} especificaciones, saltando...`);
        continue;
      }

      console.log(`Encontradas ${specs.length} especificaciones para el vehículo ${vehicle.id}`);

      // 3. Separar componentes por tipo
      const modificationComponents = [];
      const technicalComponents = [];

      specs.forEach(spec => {
        if (spec.components && spec.components.length > 0) {
          if (spec.is_modification) {
            modificationComponents.push(...spec.components);
          } else {
            technicalComponents.push(...spec.components);
          }
        }
      });

      // 4. Crear las dos nuevas especificaciones
      const { data: newModSpec, error: modError } = await supabase
        .from('technical_specs')
        .insert([{
          vehicle_id: vehicle.id,
          is_modification: true,
          created_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (modError) throw modError;

      const { data: newTechSpec, error: techError } = await supabase
        .from('technical_specs')
        .insert([{
          vehicle_id: vehicle.id,
          is_modification: false,
          created_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (techError) throw techError;

      // 5. Mover los componentes a las nuevas especificaciones
      if (modificationComponents.length > 0) {
        const modCompsToInsert = modificationComponents.map(comp => {
          const { id, tech_spec_id, created_at, updated_at, ...rest } = comp;
          return {
            ...rest,
            id: uuidv4(), // Generar nuevo ID
            tech_spec_id: newModSpec.id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
        });
        const { error: modCompsError } = await supabase
          .from('components')
          .insert(modCompsToInsert);
        if (modCompsError) throw modCompsError;
      }

      if (technicalComponents.length > 0) {
        const techCompsToInsert = technicalComponents.map(comp => {
          const { id, tech_spec_id, created_at, updated_at, ...rest } = comp;
          return {
            ...rest,
            id: uuidv4(), // Generar nuevo ID
            tech_spec_id: newTechSpec.id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
        });
        const { error: techCompsError } = await supabase
          .from('components')
          .insert(techCompsToInsert);
        if (techCompsError) throw techCompsError;
      }

      // 6. Eliminar las especificaciones antiguas y sus componentes
      for (const spec of specs) {
        // Primero eliminar los componentes
        const { error: deleteCompsError } = await supabase
          .from('components')
          .delete()
          .eq('tech_spec_id', spec.id);
        if (deleteCompsError) throw deleteCompsError;

        // Luego eliminar la especificación
        const { error: deleteSpecError } = await supabase
          .from('technical_specs')
          .delete()
          .eq('id', spec.id);
        if (deleteSpecError) throw deleteSpecError;
      }

      // 7. Actualizar el precio total del vehículo
      const totalModificationPrice = modificationComponents.reduce((total, comp) => {
        return total + (comp.price || 0);
      }, 0);

      const { error: updatePriceError } = await supabase
        .from('vehicles')
        .update({ 
          total_price: totalModificationPrice,
          updated_at: new Date().toISOString()
        })
        .eq('id', vehicle.id);

      if (updatePriceError) throw updatePriceError;

      console.log(`Vehículo ${vehicle.id} migrado correctamente`);
      console.log(`- Componentes de modificación: ${modificationComponents.length}`);
      console.log(`- Componentes técnicos: ${technicalComponents.length}`);
      console.log(`- Precio total actualizado: ${totalModificationPrice}€`);
    }

    console.log('\nMigración completada exitosamente');
  } catch (error) {
    console.error('Error durante la migración:', error);
    process.exit(1);
  }
}

// Ejecutar la migración
migrateTechnicalSpecs(); 
# 🏁 Guía Completa del Sistema de Competiciones

## 📋 **Resumen del Sistema**

El sistema de competiciones permite organizar y gestionar competiciones de Scalextric de manera completa, desde la creación hasta el seguimiento de resultados. El flujo se divide en **tres pasos principales**:

1. **Crear la competición** (configuración básica)
2. **Gestionar participantes** (añadir competidores)
3. **Registrar tiempos** (seguimiento de resultados)

## 🎯 **Paso 1: Crear Competición**

### **Campos Requeridos**
- **Nombre**: Identificador único de la competición
- **Descripción**: Detalles sobre la competición
- **Fecha**: Cuándo se celebrará
- **Número de plazas**: Máximo de participantes
- **Número de rondas**: Cuántos tiempos debe tener cada participante

### **Sistema de Rondas**
- Cada participante debe completar **todas las rondas** para que la competición se considere finalizada
- El progreso se calcula automáticamente: `(tiempos_registrados / total_requerido) * 100`
- Una competición está **completada** cuando todos los participantes han registrado todos sus tiempos

## 👥 **Paso 2: Gestionar Participantes**

### **Tipos de Participantes**

#### **Vehículos Propios**
- Seleccionar de la colección personal
- Se incluye información completa del vehículo
- Imagen automática del vehículo

#### **Vehículos Externos**
- Introducir manualmente el modelo del vehículo
- Sin imagen automática
- Ideal para participantes que usan vehículos ajenos

### **Información del Participante**
- **Nombre del piloto**: Quién conduce
- **Vehículo**: Propio o externo
- **Información adicional**: Comentarios opcionales

### **Validaciones**
- No se puede exceder el número de plazas configurado
- No se pueden duplicar participantes
- Se puede editar o eliminar participantes en cualquier momento

## ⏱️ **Paso 3: Registrar Tiempos**

### **Nueva Funcionalidad: Gestión Completa de Tiempos**

#### **Campos de Tiempo**
- **Participante**: Seleccionar de la lista de participantes
- **Ronda**: Número de ronda (1, 2, 3, etc.)
- **Mejor Vuelta**: Tiempo de la vuelta más rápida
- **Tiempo Total**: Tiempo total de la sesión
- **Número de Vueltas**: Cuántas vueltas completó
- **Tiempo Promedio**: Promedio por vuelta
- **Carril**: Carril utilizado (opcional)
- **Piloto**: Nombre del piloto (opcional)
- **Circuito**: Circuito utilizado (opcional)

#### **Validaciones de Tiempos**
- No se puede registrar más de un tiempo por participante por ronda
- El número de ronda debe estar dentro del rango configurado
- Todos los campos de tiempo son obligatorios
- Se puede editar o eliminar tiempos existentes

### **Vistas de Tiempos**

#### **1. Vista por Rondas**
- Muestra cada ronda como una tarjeta separada
- Indica el estado de cada ronda:
  - 🟡 **Pendiente**: Sin tiempos registrados
  - 🟠 **Parcial**: Algunos participantes han registrado tiempo
  - 🟢 **Completa**: Todos los participantes han registrado tiempo
- Lista los tiempos de cada ronda en una tabla compacta

#### **2. Vista por Participantes**
- Muestra cada participante como una tarjeta
- Barra de progreso individual por participante
- Lista los tiempos registrados por cada participante
- Indica qué rondas faltan por completar

#### **3. Vista General (Tabla)**
- Tabla completa con todos los tiempos
- Información detallada de cada registro
- Acciones para editar o eliminar tiempos
- Ordenada por ronda y fecha

### **Seguimiento del Progreso**

#### **Panel de Progreso**
- **Barra de progreso visual**: Porcentaje de completitud
- **Estadísticas**:
  - Número de participantes
  - Número de rondas configuradas
  - Tiempos registrados vs. total requerido
  - Estado de la competición (En Progreso/Completada)

#### **Cálculo Automático**
```
Progreso = (Tiempos Registrados / Total Requerido) × 100
Total Requerido = Número de Participantes × Número de Rondas
```

## 🔧 **API Endpoints Implementados**

### **Gestión de Tiempos**
- `GET /api/competitions/:id/timings` - Obtener todos los tiempos
- `POST /api/competitions/:id/timings` - Registrar nuevo tiempo
- `PUT /api/competitions/:id/timings/:timingId` - Actualizar tiempo
- `DELETE /api/competitions/:id/timings/:timingId` - Eliminar tiempo

### **Progreso Mejorado**
- `GET /api/competitions/:id/progress` - Progreso detallado con:
  - Estadísticas por participante
  - Tiempos agrupados por ronda
  - Rondas completadas y pendientes por participante

## 🎨 **Interfaz de Usuario**

### **Navegación**
- **Competiciones** → **Participantes** → **Tiempos**
- Botón "Gestionar Tiempos" en la página de participantes
- Navegación fluida entre las diferentes vistas

### **Formularios**
- **Formulario de tiempo**: Modal con todos los campos necesarios
- **Validación en tiempo real**: Feedback inmediato al usuario
- **Selección inteligente**: Solo muestra rondas y participantes válidos

### **Feedback Visual**
- **Chips de estado**: Colores para indicar progreso
- **Barras de progreso**: Visualización del avance
- **Iconos informativos**: Para diferentes estados y acciones

## 📊 **Estructura de Datos**

### **Tabla `competition_timings`**
```sql
CREATE TABLE competition_timings (
  id uuid PRIMARY KEY,
  participant_id uuid REFERENCES competition_participants(id),
  round_number integer NOT NULL CHECK (round_number > 0),
  best_lap_time varchar(12) NOT NULL,
  total_time varchar(12) NOT NULL,
  laps integer NOT NULL,
  average_time varchar(12) NOT NULL,
  lane varchar(50),
  driver varchar(100),
  timing_date date DEFAULT CURRENT_DATE,
  circuit text,
  best_lap_timestamp numeric,
  total_time_timestamp numeric,
  average_time_timestamp numeric,
  setup_snapshot jsonb,
  created_at timestamp DEFAULT now()
);
```

### **Relaciones**
- **competition_timings** → **competition_participants** (participant_id)
- **competition_participants** → **competitions** (competition_id)
- **competition_participants** → **vehicles** (vehicle_id, opcional)

## 🚀 **Flujo de Trabajo Completo**

### **Ejemplo Práctico**

1. **Crear Competición**
   ```
   Nombre: "Copa de Invierno 2024"
   Descripción: "Competición de invierno con vehículos clásicos"
   Fecha: 15/12/2024
   Plazas: 8
   Rondas: 3
   ```

2. **Añadir Participantes**
   ```
   - Juan Pérez (Ferrari F40 - propio)
   - María García (Porsche 911 - propio)
   - Carlos López (BMW M3 - externo)
   - Ana Martín (Audi R8 - propio)
   ```

3. **Registrar Tiempos**
   ```
   Ronda 1:
   - Juan: 12.345s / 2:30.123 / 12 vueltas
   - María: 12.567s / 2:32.456 / 12 vueltas
   - Carlos: 12.789s / 2:35.789 / 12 vueltas
   - Ana: 12.234s / 2:28.567 / 12 vueltas
   
   Ronda 2:
   - Juan: 12.123s / 2:28.456 / 12 vueltas
   - María: 12.456s / 2:31.234 / 12 vueltas
   - Carlos: 12.678s / 2:34.567 / 12 vueltas
   - Ana: 12.012s / 2:26.789 / 12 vueltas
   
   Ronda 3:
   - Juan: 11.987s / 2:27.123 / 12 vueltas
   - María: 12.345s / 2:30.456 / 12 vueltas
   - Carlos: 12.567s / 2:33.789 / 12 vueltas
   - Ana: 11.876s / 2:25.234 / 12 vueltas
   ```

4. **Resultado Final**
   ```
   Progreso: 100% (12/12 tiempos registrados)
   Estado: Completada
   
   Clasificación (por mejor tiempo de ronda):
   1. Ana Martín - 11.876s
   2. Juan Pérez - 11.987s
   3. María García - 12.345s
   4. Carlos López - 12.567s
   ```

## 🎯 **Próximas Mejoras**

### **Funcionalidades Planificadas**
- [ ] **Clasificación automática** por mejores tiempos
- [ ] **Estadísticas avanzadas** (promedios, tendencias)
- [ ] **Exportación de resultados** a PDF/Excel
- [ ] **Sistema de puntos** por posiciones
- [ ] **Historial de competiciones** del participante
- [ ] **Comparación de rendimientos** entre competiciones

### **Mejoras de UX**
- [ ] **Modo oscuro** para la interfaz
- [ ] **Notificaciones** de progreso
- [ ] **Búsqueda y filtros** en tiempos
- [ ] **Gráficos de rendimiento** por participante
- [ ] **Modo offline** para registrar tiempos sin conexión

---

**¡El sistema de competiciones está ahora completamente funcional y listo para organizar tus carreras de Scalextric! 🏁** 

# Guía de Competiciones - Scalextric Collection

## 🏁 Sistema Completo de Competiciones

El sistema de competiciones ha sido completamente renovado con nuevas funcionalidades avanzadas para gestionar competiciones de Scalextric de manera profesional.

## 📋 Características Principales

### 1. Gestión de Competiciones
- **Creación de competiciones** con nombre, número de plazas y rondas
- **Enlaces únicos** (slugs) para cada competición
- **Configuración de circuitos** y detalles específicos
- **Estado de competición** (abierta/completa)

### 2. Inscripciones Públicas
- **Formulario público** accesible sin autenticación
- **Enlaces únicos** para compartir competiciones
- **Gestión de solicitudes** de inscripción
- **Aprobación/rechazo** de participantes
- **Conversión automática** de inscripciones a participantes oficiales

### 3. Categorías Personalizables
- **Creación de categorías** específicas (F1, GT, Rally, etc.)
- **Asignación de participantes** a categorías
- **Filtrado por categorías** en resultados
- **Gestión completa** de categorías

### 4. Reglas de Puntuación Avanzadas
- **Configuración de puntos** por posición
- **Tipos de puntuación:**
  - Por ronda: puntos en cada ronda individual
  - Final: puntos solo al final de la competición
- **Estructura personalizable** de puntos
- **Cálculo automático** de puntuaciones

## 🚀 Cómo Usar el Sistema

### Crear una Nueva Competición

1. **Accede a la sección de competiciones**
   - Ve a "Competiciones" en el menú principal
   - Haz clic en "Nueva Competición"

2. **Configura los datos básicos:**
   - **Nombre:** Nombre descriptivo de la competición
   - **Número de plazas:** Máximo de participantes
   - **Rondas:** Número de rondas de la competición
   - **Circuito:** (Opcional) Nombre del circuito

3. **Se generará automáticamente:**
   - Un enlace único (slug) para inscripciones públicas
   - La competición aparecerá en tu lista

### Configurar Categorías

1. **Ve a la pestaña "Categorías"**
   - En la página de gestión de la competición
   - Haz clic en "Añadir" para crear una nueva categoría

2. **Define las categorías:**
   - **F1:** Para coches de Fórmula 1
   - **GT:** Para coches Gran Turismo
   - **Rally:** Para coches de rally
   - **Clásicos:** Para coches clásicos
   - O cualquier categoría que necesites

### Configurar Reglas de Puntuación

1. **Ve a la pestaña "Reglas"**
   - Haz clic en "Añadir" para crear una nueva regla

2. **Configura el tipo de puntuación:**
   - **Por ronda:** Los puntos se asignan en cada ronda
   - **Final:** Los puntos se asignan solo al final

3. **Define la estructura de puntos:**
   - 1º lugar: 10 puntos
   - 2º lugar: 8 puntos
   - 3º lugar: 6 puntos
   - Y así sucesivamente...

### Gestionar Inscripciones Públicas

1. **Comparte el enlace público:**
   - Copia el enlace desde el botón "Enlace Público"
   - Compártelo con los participantes potenciales

2. **Los participantes se inscriben:**
   - Acceden al enlace público
   - Rellenan el formulario con sus datos
   - Seleccionan categoría (si está disponible)
   - Especifican su vehículo

3. **Gestiona las solicitudes:**
   - Ve a la pestaña "Inscripciones"
   - Revisa cada solicitud
   - Aprueba o rechaza según corresponda

### Aprobar Participantes

1. **Revisa la información:**
   - Nombre y email del solicitante
   - Vehículo propuesto
   - Categoría seleccionada

2. **Configura el vehículo final:**
   - Selecciona un vehículo de tu colección
   - O especifica un modelo personalizado

3. **Aprueba la solicitud:**
   - El participante se convierte en oficial
   - Aparece en la lista de participantes confirmados

## 📊 Gestión de Tiempos

### Registrar Tiempos por Ronda

1. **Accede a "Gestionar Tiempos"**
   - Solo disponible cuando la competición está completa
   - Se bloquea automáticamente cuando se completan todas las rondas

2. **Registra los tiempos:**
   - Selecciona la ronda
   - Introduce los tiempos de cada participante
   - El sistema valida la coherencia de los tiempos

3. **Visualiza los resultados:**
   - Vista por rondas individuales
   - Vista por participantes
   - Vista agregada con ranking final

### Exportar Resultados

1. **Una vez finalizada la competición:**
   - Descarga los datos en formato CSV
   - Genera reportes en PDF
   - Incluye estadísticas completas

## 🔧 Configuración Técnica

### Base de Datos

El sistema utiliza las siguientes tablas:

```sql
-- Competiciones principales
competitions (id, name, public_slug, organizer, num_slots, rounds, circuit_name)

-- Categorías por competición
competition_categories (id, competition_id, name)

-- Reglas de puntuación
competition_rules (id, competition_id, rule_type, description, points_structure)

-- Inscripciones públicas
competition_signups (id, competition_id, name, email, category_id, vehicle)

-- Participantes oficiales
competition_participants (id, competition_id, driver_name, vehicle_id, vehicle_model, category_id)

-- Tiempos registrados
competition_timings (id, competition_id, participant_id, round_number, time, lap_count)
```

### Endpoints API

#### Competiciones
- `POST /competitions` - Crear competición
- `GET /competitions/my-competitions` - Listar mis competiciones
- `GET /competitions/:id` - Obtener competición específica
- `PUT /competitions/:id` - Actualizar competición
- `DELETE /competitions/:id` - Eliminar competición

#### Categorías
- `POST /competitions/:id/categories` - Crear categoría
- `GET /competitions/:id/categories` - Listar categorías
- `DELETE /competitions/:id/categories/:categoryId` - Eliminar categoría

#### Reglas
- `POST /competitions/:id/rules` - Crear regla
- `GET /competitions/:id/rules` - Listar reglas
- `PUT /competitions/:id/rules/:ruleId` - Actualizar regla
- `DELETE /competitions/:id/rules/:ruleId` - Eliminar regla

#### Inscripciones Públicas
- `GET /competitions/public/:slug` - Obtener info de competición pública
- `POST /competitions/public/:slug/signup` - Inscripción pública
- `GET /competitions/:id/signups` - Listar inscripciones
- `POST /competitions/:id/signups/:signupId/approve` - Aprobar inscripción
- `DELETE /competitions/:id/signups/:signupId` - Rechazar inscripción

## 🎯 Mejores Prácticas

### Organización de Competiciones

1. **Planifica con anticipación:**
   - Define claramente las categorías
   - Establece reglas de puntuación claras
   - Comunica las reglas a los participantes

2. **Gestiona las inscripciones:**
   - Revisa regularmente las solicitudes
   - Responde rápidamente a las inscripciones
   - Mantén comunicación con los participantes

3. **Durante la competición:**
   - Registra los tiempos inmediatamente
   - Verifica la precisión de los datos
   - Mantén un ambiente organizado

### Configuración Técnica

1. **Categorías:**
   - Usa nombres descriptivos y claros
   - Agrupa vehículos similares
   - Considera el nivel de los participantes

2. **Reglas de puntuación:**
   - Mantén la estructura simple
   - Asegúrate de que sea justa
   - Comunica claramente las reglas

3. **Inscripciones:**
   - Comparte el enlace con suficiente anticipación
   - Proporciona información clara sobre la competición
   - Establece fechas límite claras

## 🚨 Solución de Problemas

### Problemas Comunes

1. **No se puede acceder al enlace público:**
   - Verifica que la competición tenga un slug válido
   - Asegúrate de que la URL sea correcta

2. **No se pueden aprobar inscripciones:**
   - Verifica que no se haya alcanzado el límite de participantes
   - Asegúrate de especificar un vehículo válido

3. **Errores en el registro de tiempos:**
   - Verifica que todos los participantes tengan tiempos registrados
   - Asegúrate de que los tiempos sean coherentes

### Soporte

Si encuentras problemas técnicos:
1. Revisa los logs del servidor
2. Verifica la configuración de la base de datos
3. Contacta al equipo de desarrollo

## 🔄 Actualizaciones Futuras

El sistema está diseñado para ser extensible. Próximas funcionalidades planificadas:

- **Sistema de ligas** con múltiples competiciones
- **Ranking histórico** de participantes
- **Estadísticas avanzadas** y análisis de rendimiento
- **Integración con sistemas externos** de timing
- **Notificaciones automáticas** por email
- **App móvil** para registro de tiempos en tiempo real

---

¡Disfruta organizando tus competiciones de Scalextric con este sistema completo y profesional! 🏁 
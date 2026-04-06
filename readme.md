# Scalextric Collection - Gestión de Competiciones

Una aplicación web completa para gestionar tu colección de coches Scalextric y organizar competiciones de manera profesional.

## PWA (Progressive Web App)

Esta aplicación está configurada como una **Progressive Web App (PWA)**, lo que significa que puedes instalarla en tu dispositivo móvil o computadora como una aplicación nativa.

### Características PWA

- **Instalable**: Puedes instalar la app en tu dispositivo desde el navegador
- **Funcionamiento offline**: La aplicación funciona sin conexión a internet
- **Experiencia nativa**: Se comporta como una aplicación móvil nativa
- **Actualizaciones automáticas**: Se actualiza automáticamente cuando hay nuevas versiones

### Funcionalidades de Tiempos y Carriles

- **Comparativa de Carriles**: Análisis detallado de rendimiento por carril en cada circuito
- **Filtrado por Circuito**: Selecciona cualquier circuito para analizar sus carriles
- **Análisis de Diferencias**: Compara tiempos entre carriles con métricas de diferencia y porcentaje
- **Ranking por Carril**: Clasificación detallada de vehículos en cada carril
- **Identificación de Rápidos**: Descubre qué vehículos son más rápidos en cada carril específico
- **Métricas de Rendimiento**: Estadísticas completas incluyendo tiempos promedio y mejores marcas

### Cómo Instalar la PWA

#### En Android (Chrome):

1. Abre la aplicación en Chrome
2. Verás un banner "Instalar aplicación" en la parte inferior
3. Toca "Instalar" y confirma
4. La app aparecerá en tu pantalla de inicio

#### En iOS (Safari):

1. Abre la aplicación en Safari
2. Toca el botón de compartir (cuadrado con flecha)
3. Selecciona "Añadir a pantalla de inicio"
4. Confirma la instalación

#### En Desktop (Chrome/Edge):

1. Abre la aplicación en el navegador
2. Verás un icono de instalación en la barra de direcciones
3. Haz clic en el icono y selecciona "Instalar"
4. La app se abrirá en una ventana independiente

### Vercel Web Analytics

The application includes [Vercel Web Analytics](https://vercel.com/docs/analytics/quickstart) for visitor insights and page view tracking. Analytics are enabled automatically when deployed to Vercel. Enable Web Analytics in your Vercel project dashboard under **Analytics** to start collecting data.

### Vercel Speed Insights

The application includes [Vercel Speed Insights](https://vercel.com/docs/speed-insights) for real-time performance metrics (Core Web Vitals: LCP, FID, CLS, INP, TTFB). Data is collected automatically when deployed to Vercel. Enable Speed Insights in your Vercel project dashboard under **Speed Insights** to start collecting performance data. If no data appears after 30 seconds, check for content blockers and try navigating between pages.

### Requisitos Técnicos PWA

- **HTTPS obligatorio**: La PWA requiere conexión segura en producción
- **Service Worker**: Para funcionamiento offline y cacheo
- **Manifest.json**: Configuración de la aplicación instalable
- **Iconos**: Múltiples tamaños para diferentes dispositivos

### Solución de Problemas PWA

Si no ves el botón de instalación:

1. **Verifica HTTPS**: Asegúrate de que el sitio use HTTPS en producción
2. **Limpia el cache**: Borra el cache del navegador y recarga
3. **Verifica el Service Worker**: Abre las herramientas de desarrollador → Application → Service Workers
4. **Revisa la consola**: Busca errores relacionados con el Service Worker
5. **Reinstala**: Si ya está instalada, desinstala y vuelve a instalar

###🆕 Nuevas Funcionalidades

#### Historial al cambiar una modificación (componente anterior)

**Description**: When you **edit** an existing modification row (same component slot, e.g. swap crown A for crown B), the app stores a snapshot of the previous values plus an **effective change date** before applying the update.

**Features**:

- **Edit in place**: Use “Editar” on the modification row; do not delete and re-add if you want a continuous history for that slot.
- **Date**: “Fecha del cambio” defaults to today; shown only when editing a modification. An informational alert explains that saving will record history when data actually changes.
- **API**: `PUT /api/vehicles/:id/technical-specs/:specId/components/:componentId` accepts optional `change_effective_date` (`YYYY-MM-DD`). `GET /api/vehicles/:id/technical-specs` includes each modification component with `change_history` (newest first).
- **UI**: Edit form (Modificaciones tab) and vehicle detail show prior values and dates.

**Database**: Run `backend/scripts/create-component-modification-history.sql` in the Supabase SQL Editor before using this feature.

**Files**:

- `backend/scripts/create-component-modification-history.sql`
- `backend/routes/vehicles.js`
- `frontend/src/data/componentTypes.js`
- `frontend/src/utils/formatUtils.js` — `formatModificationSnapshot`, `formatHistoryDate`
- `frontend/src/components/EditVehicle.jsx`
- `frontend/src/components/VehicleDetail.jsx`

#### Add Vehicle Form Validation

**Description**: Client-side validation for required fields when creating a new vehicle.

**Features**:

- **Required fields**: Modelo (Model), Fabricante (Manufacturer), Tipo (Type)
- **Validation on submit**: If any required field is empty, the form shows a clear message listing the missing fields
- **Visual feedback**: Empty required fields are highlighted with a red border when validation fails
- **UX**: Error message clears when the user edits any required field
- **Numeric fields**: Backend converts empty price/scale_factor to null to avoid DB errors; optional price can be left blank
- **API errors**: Frontend displays API error messages to the user (e.g. invalid numeric values); numeric errors are shown in user-friendly Spanish

**Files modified**:

- `frontend/src/components/AddVehicle.jsx` - Validation logic, error display, API error handling
- `backend/routes/vehicles.js` - Sanitize empty strings to null for numeric/optional fields
- `frontend/src/components/VehicleCard.jsx` - Show "Precio no disponible" when price is empty; hide labels (badges, date, place) when their values are empty

#### Bug Fix: Empty fields showing "null" in frontend and PDF

**Issue**: When fields like Anotaciones (notes), Referencia (reference), or Lugar de compra (purchase place) were empty, the frontend and PDF technical sheet displayed the literal text "null" instead of showing nothing or a dash.

**Fix**: Normalized display of empty values across the app:

- **Frontend**: Use `?? ''` for Input/Textarea values (reference, anotaciones, purchase_place) to avoid passing null to controlled components; added checks to hide reference/purchase_place when null or the string "null"
- **PDF**: Added `toDisplayString()` helper that converts null, undefined, and the string "null" to "-" for display in the technical sheet
- **Components updated**: VehicleDetail, EditVehicle, AddVehicle, VehicleCard, VehicleTable

**Files modified**:

- `frontend/src/components/VehicleDetail.jsx` - Input values, anotaciones visibility
- `frontend/src/components/EditVehicle.jsx` - Input/Textarea values
- `frontend/src/components/AddVehicle.jsx` - Input/Textarea values
- `frontend/src/components/VehicleCard.jsx` - Reference and purchase_place display
- `frontend/src/components/VehicleTable.jsx` - Reference and purchase_place display
- `frontend/src/utils/formatUtils.js` - Added `toDisplayValue()` utility
- `backend/src/utils/pdfGenerator.js` - `toDisplayString()` helper and drawInfoTable

#### Bug Fix: Delete Image in Vehicle Detail/Edit

**Issue**: When clicking the delete image icon in the vehicle detail or edit form, the confirmation dialog appeared briefly but the user was redirected to the vehicle list without being able to confirm the deletion.

**Cause**: The delete image button was inside a form and lacked `type="button"`, so it defaulted to `type="submit"`. Clicking it triggered form submission (and navigation in the edit form) before the user could confirm.

**Fix**: Added `type="button"` and `e.preventDefault()` to image delete buttons, and hardened the edit form submit handler so it only runs when the explicit `Actualizar` submit button is used (`name="save-vehicle"` + `submitter` guard).

**Files modified**:

- `frontend/src/components/VehicleDetail.jsx` - Delete image button and AlertDialogAction
- `frontend/src/components/EditVehicle.jsx` - Delete image button, dialog buttons and submit guard

#### Vehicle Card Fields: Museo, Taller and Anotaciones

**Description**: New boolean fields (Museo, Taller) and a free-text field (Anotaciones) for vehicle cards, following the same pattern as Modified and Digital.

**Features**:

- **Museo** (boolean): Indicates if the vehicle is part of a museum/display collection
- **Taller** (boolean): Indicates if the vehicle is in workshop/maintenance
- **Anotaciones** (text): Free-form textarea for user comments and notes on the vehicle card

**Usage**: Available in Add Vehicle form, Edit Vehicle form, Vehicle Detail view, exported PDF technical sheet, vehicle list badges, and collection filters.

**List view**: Museo and Taller appear as badges on vehicle cards (next to type and traction). Two new filters in the collection list allow filtering by Museo and Taller; both filters can be applied simultaneously (e.g. show only vehicles in museum AND in workshop).

**Database**: Run `backend/scripts/add-museo-taller-anotaciones-fields.sql` in Supabase SQL Editor to add the new columns.

#### Auto-modified flag when adding modifications

**Description**: The vehicle "Modificado" (modified) flag is now updated automatically based on modification components. No manual toggle required.

**Features**:

- **On add**: When you add a modification component to a vehicle (in the vehicle detail/edit form), the vehicle is automatically marked as modified (`modified = true`)
- **On remove**: When you delete the last modification component, the vehicle is automatically marked as stock (`modified = false`)
- **Derived from data**: The flag is derived from the actual modification components in the database, keeping it in sync with filters, badges, and dashboard statistics

**Files modified**:

- `backend/routes/vehicles.js` - `updateVehicleTotalPrice` now also updates the `modified` field based on modification components

**Files modified**:

- `backend/scripts/add-museo-taller-anotaciones-fields.sql` - Migration script
- `backend/routes/vehicles.js` - POST and PUT routes
- `frontend/src/components/AddVehicle.jsx` - Form fields
- `frontend/src/components/EditVehicle.jsx` - Form fields
- `frontend/src/components/VehicleDetail.jsx` - Read-only display
- `frontend/src/components/VehicleCard.jsx` - Museo/Taller badges in list
- `frontend/src/pages/VehicleList.jsx` - Museo/Taller filters (both can be applied at once)
- `backend/src/utils/pdfGenerator.js` - PDF technical sheet

#### Vehicle List: Grid/Table View and Configurable Pagination

**Description**: The vehicle collection list supports two view modes and configurable pagination. Users can switch between a card grid and a compact table view, and choose how many items to display per page (10, 25, 50, or 100).

**Features**:

- **Grid view**: Card layout with images, badges, and full details (default)
- **Table view**: Compact table with thumbnail, model, type, status badges, price, purchase info, odometer, and actions (PDF download, delete)
- **View toggle**: Icons in the header to switch between Grid and Table; preference is saved in localStorage
- **Configurable pagination**: Selector for items per page (10, 25, 50, 100); preference is saved in localStorage
- **Pagination bar**: Shows "Showing X–Y of Z vehicles", page navigation buttons, and page size selector
- **Filter pagination**: When any filter is active (manufacturer, type, modified, digital, Museo, Taller), all vehicles are loaded once and filtered client-side. Pagination applies to the filtered results with the same page size; if results fit in one page, pagination controls are hidden
- **Filter persistence**: Active filters are saved in localStorage; when navigating away (e.g. to vehicle detail) and returning, the same filters remain applied
- **CSV export**: Export vehicle collection to CSV with all fields; when filters are active, only filtered vehicles are exported
- **CSV columns**: ID, Model, Reference, Manufacturer, Type, Traction, Scale (1:X), Base Price, Total Price, Purchase Date, Purchase Place, Modified, Digital, Museo, Taller, Odometer, Annotations, Technical Specs, Modifications

**Files modified**:

- `frontend/src/pages/VehicleList.jsx` - View modes, toggle, pagination, page size selector, CSV export with filters
- `frontend/src/components/VehicleTable.jsx` - New compact table component for vehicle list
- `backend/routes/vehicles.js` - Export endpoint accepts filter query params (manufacturer, type, modified, digital, filterMuseo, filterTaller)

#### Vehicle Technical Sheet PDF - Redesign

**Description**: The downloadable vehicle technical sheet PDF has been redesigned for a clean, professional look.

**Features**:

- **Header**: Branded header with "Scalextric Collection · Ficha Técnica" and generation date on every page
- **Footer**: Page numbers, odometer, and generation date on every page
- **Color palette**: Dark header (#1a1a2e), accent color (#e94560) for section headers and badges
- **Badges**: Digital, Modificado, Museo, Taller shown as inline badges instead of table rows
- **Image**: Vehicle image with border; placeholder when image is missing or unavailable. Image priority matches vehicle list: three_quarters > left/right > first available
- **Price summary**: Box with base price, modifications cost, and total price
- **Tables**: Styled component tables with header background, alternating row colors, and 4 columns (Componente, Fabricante, Detalle, Precio)
- **New fields**: Purchase place, scale factor (1:XX), odometer (total_distance_meters)
- **Safe formatting**: No NaN or invalid prices; defensive price handling

**Files modified**:

- `backend/src/utils/pdfGenerator.js` - Complete redesign with helpers for header, footer, sections, tables, badges, and price summary

#### Vehicle List CSV Export - Extended Fields and Filtered Export

**Description**: The CSV export from the vehicle list has been updated with new fields and now respects active filters.

**Features**:

- **New columns**: Escala (1:X), Museo, Taller, Odómetro, Anotaciones
- **Filtered export**: When any filter is active (manufacturer, type, modified, digital, Museo, Taller), the CSV contains only the vehicles matching the current filters
- **Safe CSV escaping**: Text fields are properly escaped to avoid issues with commas and quotes in Excel/Sheets

**Files modified**:

- `frontend/src/pages/VehicleList.jsx` - Extended CSV headers and row mapping, filter params passed to export API
- `backend/routes/vehicles.js` - Export endpoint accepts filter query params

#### Vehicle Types: Hypercar, Grupo 5, Road Car

**Description**: Three new vehicle types added to the type selector when creating or editing a vehicle.

**New types**:

- **Hypercar**: For hypercar category vehicles
- **Grupo 5**: For Group 5 racing cars
- **Road Car**: For road/street legal cars

**Files modified**:

- `frontend/src/components/EditVehicle.jsx` - vehicleTypes array
- `frontend/src/components/AddVehicle.jsx` - Type select options
- `frontend/src/pages/VehicleList.jsx` - Type filter dropdown

#### Velocidad, Distancia y Odómetro

**Descripción**: Seguimiento de distancia recorrida y velocidad (en pista y equivalente a escala real) para cada sesión de tiempos.

**Características**:

- **Distancia por sesión**: Calculada automáticamente a partir de la longitud del carril del circuito y el número de vueltas
- **Velocidad en pista**: Velocidad real medida en el circuito (km/h)
- **Velocidad equivalente a escala**: Velocidad que tendría el coche real a tamaño natural (ej: 7.8 km/h en pista × 32 = 250 km/h equivalente para escala 1:32)
- **Odómetro por vehículo**: Distancia total acumulada de todas las sesiones (entrenamientos y competiciones)
- **Escala configurable**: Cada vehículo tiene un campo `scale_factor` (32 = 1:32, 43 = 1:43) para el cálculo de velocidad equivalente

**Requisitos**: Los circuitos deben tener `lane_lengths` definidos (metros por carril) y el timing debe especificar circuito y carril.

**API**: Los campos `total_distance_meters`, `avg_speed_kmh`, `avg_speed_scale_kmh`, `best_lap_speed_kmh`, `best_lap_speed_scale_kmh` están disponibles en las respuestas de timings y en la API de sincronización.

**Archivos**:

- `backend/scripts/add-speed-distance-fields.sql` - Migración de columnas
- `backend/scripts/backfill-speed-distance.sql` - Relleno de datos históricos
- `backend/lib/distanceCalculator.js` - Cálculo de distancia y velocidad

#### Comparativa de Carriles en Dashboard

**Descripción**: Nueva sección dedicada al análisis de rendimiento por carriles en el dashboard principal.

**Características**:

- **Selector de Circuito**: Filtra por cualquier circuito disponible en la base de datos
- **Resumen de Carriles**: Muestra estadísticas generales de cada carril (número de vehículos, mejor tiempo)
- **Comparativa de Tiempos**: Calcula diferencias entre carriles con métricas de porcentaje
- **Vehículos Más Rápidos**: Identifica el vehículo más rápido de cada carril
- **Ranking Detallado**: Tabla completa de posiciones por carril con todos los vehículos

**Uso**:

1. Ve al Dashboard principal
2. En la sección "Análisis de Tiempos por Carril"
3. Selecciona un circuito del dropdown
4. Analiza las comparativas y rankings por carril

**Archivos añadidos**:

- `frontend/src/components/LaneComparisonChart.jsx` - Componente principal de comparativa
- Integración en `frontend/src/pages/Dashboard.jsx`

#### Telemetry: Per-Lap Data, Consistency and Session Comparison

**Description**: Enhanced telemetry with individual lap storage, consistency metrics, and session comparison tools.

**Features**:

- **Per-lap storage**: Store each lap time individually via `lap_times` array in the sync API
- **Consistency score**: Coefficient of variation (std_dev/mean × 100) — lower = more consistent. Calculated when ≥3 laps are provided
- **Worst lap**: Time of the slowest lap in the session
- **Lap breakdown chart**: Bar chart showing each lap time with the best lap highlighted (in TimingSpecsModal)
- **Speed evolution chart**: Line chart showing avg_speed_kmh and best_lap_speed_kmh across sessions (in vehicle detail)
- **Session comparison modal**: Compare two sessions side-by-side with metrics table and lap-by-lap overlay chart when both have lap data

**API**:

- `POST /api/sync/timings` — Optional `lap_times: [{ lap_number?, time_seconds|lap_time_seconds, time_text? }]`. Backward compatible.
- `GET /api/timings/:id/laps` — Returns `{ laps: [{ lap_number, lap_time_seconds, lap_time_text }] }` for a session (JWT required)

**Database**: Run `backend/scripts/add-timing-laps-table.sql` in Supabase SQL Editor to create `timing_laps` table and add `consistency_score`, `worst_lap_timestamp` to `vehicle_timings`.

**Pilot public profile & supply voltage**: Run `backend/scripts/add-pilot-profile-voltage.sql` in Supabase SQL Editor to add `vehicle_timings.supply_voltage_volts`, table `pilot_public_profiles`, and RLS. Public URL: `/piloto/:slug`. API: `GET/PATCH /api/pilot-profile` (JWT), `GET /api/public/pilot/:slug` (public).

**Files**:

- `backend/scripts/add-timing-laps-table.sql` — Migration
- `backend/routes/sync.js` — Accepts lap_times, inserts into timing_laps
- `backend/routes/timings.js` — GET /:id/laps endpoint
- `frontend/src/components/charts/LapBreakdownChart.jsx`
- `frontend/src/components/charts/SpeedEvolutionChart.jsx`
- `frontend/src/components/SessionComparisonModal.jsx`

#### Session Performance Analysis

**Description**: Detailed performance analysis for each timing session with lap-by-lap evolution, statistics, and visualizations.

**Features**:

- **Evolution tab**: KPI cards (best lap, worst lap, mean, median, consistency %, best-worst diff), lap time evolution line chart with 3-lap moving average and reference lines (best/mean), delta vs best lap bar chart
- **Statistics tab**: First-half vs second-half comparison (mean, best lap), lap time distribution histogram, detailed lap table with delta vs best, delta vs mean, and best/worst indicators
- **Access points**: Available from the global timings table (group row and expanded session rows) and from the vehicle detail page (Tabla de Tiempos tab) via the BarChart3 icon button. The icon is only shown when that timing has individual lap data (`GET /api/timings/:id/laps` returns non-empty `laps`).

**Usage**:

1. From **Timings** page: Click the chart icon on any group or expanded session row
2. From **Vehicle detail** page: Go to "Tabla de Tiempos" tab and click the chart icon on any timing row

**Files**:

- `frontend/src/components/SessionPerformanceModal.jsx` — Main modal with tabs
- `frontend/src/components/charts/LapDeltaChart.jsx` — Delta vs best lap bar chart
- `frontend/src/components/TimingsList.jsx` — Performance button integration
- `frontend/src/components/EditVehicle.jsx` — Performance button in vehicle timings table

#### Setup Performance Analysis (Configuration Comparison)

**Description**: Analytics in the vehicle detail page that compare performance across different setup configurations. When a vehicle has timing sessions recorded with two or more distinct component configurations (reglajes), a new "Análisis Config." tab appears.

**Features**:

- **Conditional visibility**: The tab only appears when there are at least 2 different configurations among the vehicle's timing sessions (detected via `setup_snapshot` fingerprinting)
- **Configuration cards**: Each configuration group shows session count, date range, best lap, average lap, average speed, and key component changes vs previous config
- **Comparison table**: Side-by-side metrics with visual indicators for best values (green highlight and checkmark)
- **Bar chart**: Best lap and average lap per configuration
- **Timeline chart**: Performance evolution over time with vertical reference lines marking configuration changes
- **Component diff detection**: Automatically identifies which components changed between configurations (e.g. pinion, motor, crown)

**Usage**:

1. Go to vehicle detail (Edit Vehicle)
2. Ensure the vehicle has timing sessions with different setups (e.g. changed motor, pinion, or other components between sessions)
3. If 2+ distinct configurations exist, the "Análisis Config." tab appears
4. Open the tab to view performance comparison and evolution

**Files**:

- `frontend/src/components/SetupPerformanceAnalysis.jsx` — Main component with fingerprinting, grouping, cards, comparison table, and charts
- `frontend/src/components/EditVehicle.jsx` — Conditional 5th tab integration

#### Shadcn UI: Toast and AlertDialog

**Description**: All native browser `alert()` and `window.confirm()` dialogs have been replaced with Shadcn UI components for a consistent, accessible user experience.

**Features**:

- **Toast notifications (Sonner)**: Error, success, and warning messages now appear as non-blocking toast notifications in the top-right corner
- **AlertDialog**: Confirmation dialogs (e.g., delete vehicle, remove participant) use Shadcn's AlertDialog with proper styling and accessibility
- **Theme-aware**: Toasts respect the app's light/dark theme

**Components added**:

- `frontend/src/components/ui/alert-dialog.jsx` - AlertDialog for confirmations
- `frontend/src/components/ui/sonner.jsx` - Toast notifications (Toaster + toast from sonner package)

**Usage**: Import `toast` from `sonner` for notifications (`toast.error()`, `toast.success()`, `toast.warning()`). Use AlertDialog for confirmation flows.

#### Vehicle Image Lightbox

**Description**: In the vehicle detail page, clicking on any photograph in the gallery opens it in a lightbox at full/original size.

**Features**:

- Click on any vehicle image to view it enlarged
- Modal overlay with the image at maximum viewable size (up to 95% of viewport)
- Close by clicking the X button or outside the image
- Cursor indicates images are clickable

**Files modified**:

- `frontend/src/components/VehicleDetail.jsx` - Added Dialog lightbox for image viewing

### Problemas Resueltos

#### Simplificación de Tabla de Tiempos

**Problema**: La tabla de tiempos tenía lógica compleja de cambio de posiciones que podía causar confusión y problemas de rendimiento.

**Solución**: 

- Eliminada la lógica compleja de tracking de cambios de posición del backend
- Simplificado el ordenamiento para que sea únicamente por mejor tiempo de vuelta (de menor a mayor)
- Mantenida la funcionalidad de cálculo local de diferencias de tiempo entre posiciones
- Conservada la columna de posición con información de diferencias al líder y al anterior clasificado
- Removidos los imports innecesarios de iconos de flechas de cambio de posición

**Archivos modificados**:

- `frontend/src/components/TimingsList.jsx` - Simplificación de la lógica manteniendo diferencias de tiempo

#### Problema de Tracking de Posiciones

**Problema**: Cuando se añadía un nuevo tiempo que mejoraba la posición de un vehículo, solo se mostraba el `position_change` como -1 (bajada de posición) pero no se registraba correctamente la mejora de posiciones para otros vehículos.

**Causa**: La lógica del backend no preservaba correctamente el `previous_position` antes de actualizar `current_position`, causando que el cálculo del `position_change` fuera incorrecto.

**Solución**: 

- Corregimos la función `updateCircuitPositions` para obtener la posición actual desde la base de datos antes de modificarla
- Preservamos correctamente el `previous_position` antes de calcular el `position_change`
- Mejoramos la lógica de `getCircuitRanking` para usar los valores almacenados correctamente
- Creamos scripts de prueba y recálculo para verificar la funcionalidad

**Archivos modificados**:

- `backend/lib/positionTracker.js` - Lógica de cálculo de posiciones corregida
- `backend/test-position-tracking.js` - Script de prueba del sistema
- `backend/scripts/recalculate-positions.js` - Script para recalcular posiciones existentes

#### Problema de Navegación PWA

**Problema**: Los enlaces del menú no funcionaban después de implementar la PWA.

**Causa**: El Service Worker estaba interceptando todas las peticiones, incluyendo las navegaciones de React Router.

**Solución**: 

- Simplificamos el Service Worker para que solo maneje archivos estáticos
- Eliminamos la interceptación de peticiones de navegación
- Permitimos que React Router maneje la navegación normalmente

**Archivos modificados**:

- `frontend/public/service-worker.js` - Service Worker simplificado
- `frontend/src/App.jsx` - Estructura de rutas corregida
- `frontend/src/components/InstallPWAButton.jsx` - Botones de debug añadidos

#### Problema del Menú Móvil

**Problema**: El menú desplegable en dispositivos móviles no se podía cerrar haciendo clic en el botón toggle.

**Causa**: Conflicto entre el estado local de React y el comportamiento nativo de Bootstrap para el colapso del menú.

**Solución**:

- Implementamos un estado local sincronizado con Bootstrap
- Añadimos lógica para cerrar el menú al cambiar de ruta
- Implementamos detección de clics fuera del menú para cerrarlo automáticamente
- Mejoramos las transiciones CSS para una experiencia más fluida

**Archivos modificados**:

- `frontend/src/components/Navbar.jsx` - Lógica del menú móvil corregida
- `frontend/src/components/Navbar.css` - Estilos mejorados para móvil

### Herramientas de Debug

En modo desarrollo, se añaden botones de debug:

- ** Debug PWA**: Muestra diagnóstico completo de la PWA
- ** Test Nav**: Prueba la navegación programática

Para usar las herramientas de debug:

1. Abre la consola del navegador (F12)
2. Busca los botones de debug en la esquina inferior izquierda
3. Haz clic en "Debug PWA" para ver el estado completo
4. Usa "Test Nav" para probar la navegación

### Estado de la PWA

- Manifest.json configurado

## Sistema de Seguimiento de Posiciones

### Nueva Funcionalidad

La aplicación ahora incluye un **sistema avanzado de seguimiento de posiciones** que permite:

- **Posición en tiempo real**: Muestra la posición actual de cada vehículo en cada circuito
- **Actualización en cascada**: Cuando un vehículo mejora su tiempo, **todas las posiciones afectadas se recalculan automáticamente**
- **Detección inteligente de cambios**: El sistema detecta automáticamente si los cambios requieren recálculo (mejor tiempo, circuito, carril, vueltas)
- **Cambios de posición**: Indica si un vehículo subió o bajó de posición
- **Historial de posiciones**: Rastrea la evolución de las posiciones a lo largo del tiempo
- **Rankings por circuito**: Clasificaciones separadas para cada circuito
- **Feedback visual**: El usuario recibe notificaciones cuando las posiciones se actualizan automáticamente

### Características Técnicas

#### Base de Datos

- **Nuevos campos añadidos**:
  - `current_position`: Posición actual del vehículo en el circuito
  - `previous_position`: Posición anterior del vehículo en el circuito
  - `position_updated_at`: Fecha de la última actualización de posición
  - `position_change`: Diferencia de posición (positivo = subió, negativo = bajó)

#### Backend

- **Módulo de seguimiento**: `backend/lib/positionTracker.js`
- **Actualización automática**: Las posiciones se actualizan automáticamente al registrar nuevos tiempos
- **API enriquecida**: Los endpoints devuelven información completa de posiciones y cambios

#### Frontend

- **Nueva columna**: Columna dedicada a mostrar la posición y cambios
- **Indicadores visuales**: 
  - ^ Verde para subidas de posición
  - v Rojo para bajadas de posición
  - Badges de posición con colores diferenciados
- **Estilos responsivos**: Adaptado para dispositivos móviles y desktop

### Cómo Funciona

1. **Registro de tiempo**: Al registrar un nuevo tiempo en un circuito
2. **Cálculo automático**: El sistema recalcula todas las posiciones del circuito
3. **Detección de cambios**: Identifica qué vehículos cambiaron de posición
4. **Actualización en tiempo real**: La interfaz muestra inmediatamente los cambios
5. **Historial preservado**: Se mantiene un registro de todas las posiciones anteriores

### Implementación

#### Migración de Base de Datos

```bash
# Ejecutar el script de migración
cd backend
node scripts/migrate-add-position-tracking.js
```

#### Archivos Modificados

- `backend/scripts/add-position-tracking.sql` - Script SQL para añadir campos
- `backend/scripts/migrate-add-position-tracking.js` - Migración en JavaScript
- `backend/lib/positionTracker.js` - Lógica de seguimiento de posiciones
- `backend/routes/timings.js` - API enriquecida con información de posiciones
- `backend/routes/vehicles.js` - Actualización automática de posiciones
- `frontend/src/components/TimingsList.jsx` - Nueva columna de posición
- `frontend/src/components/TimingsList.css` - Estilos para la nueva funcionalidad

### Casos de Uso

#### Ejemplo 1: Subida de Posición

- **Antes**: Vehículo A en posición 5
- **Nuevo tiempo**: Mejor tiempo que mejora la posición
- **Resultado**: Vehículo A sube a posición 4, se muestra ^ +1

#### Ejemplo 2: Bajada de Posición

- **Antes**: Vehículo B en posición 2
- **Nuevo tiempo**: Otro vehículo mejora y le adelanta
- **Resultado**: Vehículo B baja a posición 3, se muestra v -1

#### Ejemplo 3: Sin Cambios

- **Antes**: Vehículo C en posición 1
- **Nuevo tiempo**: Mantiene el mejor tiempo
- **Resultado**: Vehículo C mantiene posición 1, sin indicador de cambio

### Monitoreo y Debug

#### Logs del Backend

```bash
# Ver actualizaciones de posiciones en tiempo real
tail -f backend/logs/app.log | grep "Actualizando posiciones"
```

#### Verificación de Datos

```sql
-- Verificar campos de posición en la base de datos
SELECT 
  vehicle_id, 
  circuit, 
  previous_position, 
  position_change, 
  position_updated_at
FROM vehicle_timings 
WHERE circuit IS NOT NULL 
ORDER BY position_updated_at DESC;
```

### Beneficios

1. **Transparencia**: Los usuarios pueden ver exactamente cómo evolucionan las posiciones
2. **Motivación**: Los cambios de posición proporcionan feedback inmediato
3. **Competitividad**: Fomenta la mejora continua de tiempos
4. **Análisis**: Permite analizar tendencias de rendimiento por circuito
5. **Experiencia**: Interfaz más rica y atractiva para los usuarios

### Futuras Mejoras

- **Notificaciones**: Alertas cuando un vehículo cambie de posición
- **Gráficos**: Visualización de la evolución de posiciones a lo largo del tiempo
- **Estadísticas**: Análisis de frecuencia de cambios de posición
- **Exportación**: Incluir información de posiciones en reportes PDF/CSV
- **Comparativas**: Comparar rendimiento entre diferentes períodos
- Service Worker registrado
- Iconos en múltiples tamaños
- Botón de instalación implementado
- Funcionamiento offline básico
- Actualizaciones automáticas

## Características Principales

### Interfaz de Usuario Profesional

- **Página principal atractiva**: Landing page minimalista y profesional para usuarios no logueados
- **Navbar moderno**: Diseño profesional con logo animado y navegación intuitiva
- **Indicadores visuales**: Página activa resaltada con animaciones suaves
- **Menú de usuario**: Dropdown con perfil, configuración y cerrar sesión
- **Notificaciones**: Badge de notificaciones con animación pulsante
- **Responsive design**: Adaptable a todos los dispositivos móviles y desktop
- **Efectos de scroll**: Navbar que cambia su apariencia al hacer scroll
- **Iconos modernos**: Navegación con iconos descriptivos de React Icons
- **Sistema de diseño completo**: Variables CSS, tipografía mejorada y componentes consistentes
- **Tarjetas de métricas profesionales**: Diseño moderno con gradientes, animaciones y efectos hover
- **Botones mejorados**: Efectos de brillo, sombras y transiciones suaves
- **Formularios elegantes**: Campos con bordes redondeados y estados de focus mejorados
- **Tablas modernas**: Headers con gradientes y filas con efectos hover
- **Modales profesionales**: Diseño limpio con sombras y bordes redondeados
- **Scrollbar personalizada**: Estilo moderno y coherente con el diseño
- **Animaciones globales**: Efectos de entrada y transiciones suaves en toda la aplicación
- **Paleta de colores profesional**: Gradientes y colores consistentes
- **Tipografía mejorada**: Jerarquía visual clara con diferentes pesos y tamaños

### Página Principal (Landing Page)

- **Diseño minimalista**: Interfaz limpia y profesional para usuarios no logueados
- **Hero section atractivo**: Título con gradiente, descripción clara y botones de acción
- **Elementos visuales**: Tarjetas flotantes con iconos representativos de las funcionalidades
- **Sección de características**: Grid de 6 funcionalidades principales con iconos y descripciones
- **Call-to-action**: Sección destacada para motivar el registro
- **Selector de tema ligero**: Botón flotante en la esquina superior derecha para cambiar entre dark/light sin mostrar la navbar completa
- **Footer unificado**: Se usa el componente global `Footer` para el pie de página también en la home pública
- **Navegación intuitiva**: Botones que llevan directamente al login/registro
- **Responsive design**: Adaptable a todos los tamaños de pantalla
- **Efectos visuales**: Animaciones suaves y efectos hover elegantes
- **Colores coherentes**: Paleta de colores consistente con el resto de la aplicación

### Gestión de Vehículos

- **Catálogo completo**: Registra todos tus coches Scalextric con detalles técnicos
- **Fotos múltiples**: Añade varias imágenes por vehículo con drag & drop por vista (delantera, perfiles, trasera, etc.)
- **Categorización**: Organiza por fabricante, tipo y tracción
- **Búsqueda avanzada**: Encuentra rápidamente cualquier vehículo
- **Estadísticas visuales**: Gráficos de distribución por marca y tipo
- **Gráficas de evolución de tiempos**: Visualiza la mejora de rendimiento de cada vehículo por circuito y carril
- **Análisis de rendimiento**: Compara tiempos de mejor vuelta y promedio a lo largo del tiempo
- **Seguimiento de progreso**: Identifica tendencias de mejora en diferentes circuitos

### Gestión de Circuitos

- **Alta de circuitos**: Crea y persiste circuitos con nombre y descripción
- **Número de carriles**: Define cuántos carriles tiene cada circuito
- **Longitud por carril**: Especifica la longitud en metros de cada carril
- **Integración con competiciones**: Asocia un circuito a cada competición
- **Integración con tiempos**: Los tiempos de vehículos y competiciones referencian circuitos
- **Filtrado por circuito**: Filtra tiempos por circuito en la tabla de tiempos

### Sistema de Competiciones

- **Creación de competiciones**: Configura eventos con múltiples rondas
- **Selector de circuito**: Asocia competiciones a circuitos predefinidos
- **Inscripciones públicas**: Enlaces públicos para que cualquiera se inscriba
- **Gestión de participantes**: Añade pilotos y asigna vehículos
- **Registro de tiempos**: Sistema completo de cronometraje por ronda (con selector de circuito)
- **Clasificaciones automáticas**: Rankings en tiempo real
- **Exportación de datos**: Descarga resultados en CSV

### Modo Presentación (Live TV View)

### Características del Modo Presentación

El Modo Presentación es una vista especial diseñada para proyectar competiciones en tiempo real en pantallas grandes, proyectores o televisores. **Actualizado con el nuevo sistema de diseño profesional**.

### Acceso al Modo Presentación

1. **Desde la vista pública**: Haz clic en el botón "Modo Presentación" en la página de estado
2. **URL directa**: `http://localhost:3000/competitions/presentation/nombre-competicion`
3. **Sin autenticación**: Acceso público directo

### Elementos de la Interfaz

#### Header de Competición

- **Nombre de la competición**: Título grande con icono de trofeo y gradiente profesional
- **Información de rondas**: Badge con icono de bandera y número de rondas
- **Categoría**: Badge con icono de usuarios si aplica
- **Estado de competición**: Badge con colores distintivos (En Curso, Finalizada, Pendiente)
- **Circuito**: Información del circuito con icono de bandera a cuadros
- **Diseño moderno**: Tarjeta con efectos de glassmorphism y sombras profesionales

#### Ranking en Vivo

- **Tabla profesional**: Diseño moderno con headers sticky y efectos hover
- **Posiciones destacadas**: Colores especiales para oro, plata y bronce
- **Información completa**: Piloto, equipo, vehículo, tiempo total, penalizaciones
- **Mejor vuelta**: Tiempo más rápido con color destacado
- **Diferencias**: Gap con líder y anterior en formato profesional
- **Tipografía monospace**: Tiempos con fuente Courier New para mejor legibilidad
- **Animaciones**: Efectos de hover y transiciones suaves

#### Mejor Vuelta Highlight

- **Diseño prominente**: Tarjeta con gradiente verde y efectos de sombra
- **Iconos descriptivos**: Iconos de React Icons para tiempo, piloto y vehículo
- **Información detallada**: Tiempo, piloto, equipo y vehículo del mejor tiempo
- **Badge especial**: Indicador "Mejor Vuelta" con icono de trofeo
- **Estados vacíos**: Mensaje elegante cuando no hay tiempos registrados

#### Progreso por Rondas

- **Grid visual**: Tabla con estado de cada participante por ronda
- **Iconos de estado**: 
  - Completada (verde con efecto de sombra)
  - ⏳ En progreso (amarillo con animación pulsante)
  - Pendiente (gris)
- **Tiempos por ronda**: Visualización de tiempos cuando están disponibles
- **Leyenda interactiva**: Explicación de iconos con efectos hover
- **Diseño responsive**: Adaptable a diferentes tamaños de pantalla

### Características del Nuevo Diseño

- **Sistema de variables CSS**: Colores, espaciados y tipografía consistentes
- **Efectos de glassmorphism**: Fondos con blur y transparencias
- **Gradientes profesionales**: Colores modernos y atractivos
- **Animaciones suaves**: Transiciones y efectos hover elegantes
- **Iconografía moderna**: React Icons en lugar de emojis
- **Tipografía mejorada**: Jerarquía visual clara y legible
- **Responsive design**: Adaptable a todos los tamaños de pantalla
- **Efectos de profundidad**: Sombras y bordes que crean sensación de capas
- **Paleta de colores coherente**: Uso consistente de colores en toda la aplicación

### Estados de Carga y Error

- **Loading profesional**: Spinner con colores del tema y mensaje descriptivo
- **Manejo de errores**: Alertas elegantes con información clara
- **Estados vacíos**: Mensajes informativos cuando no hay datos
- **Fondos dinámicos**: Gradientes y efectos visuales en todos los estados

### Características Técnicas

#### Diseño Fullscreen

- **100vh x 100vw**: Ocupa toda la pantalla
- **Sin scroll**: Todo el contenido visible sin desplazamiento
- **Texto grande**: Optimizado para lectura desde lejos
- **Contraste alto**: Fondo oscuro con texto claro

#### Auto-actualización

- **Polling cada 10 segundos**: Actualización automática de datos
- **Sin interacción requerida**: Funciona de forma autónoma
- **Indicadores visuales**: Estados de carga y error

#### Responsive Design

- **Adaptable**: Se ajusta a diferentes tamaños de pantalla
- **Layout flexible**: Cambia de horizontal a vertical según el espacio
- **Optimizado para TV**: Texto y elementos escalables

### Casos de Uso

#### Competiciones en Vivo

- **Proyección en eventos**: Mostrar progreso en tiempo real
- **Pantallas de información**: En salas de espera o áreas públicas
- **Streaming**: Para transmisiones en vivo

#### Análisis Post-competición

- **Revisión de resultados**: Visualización clara de clasificaciones
- **Presentaciones**: Para mostrar resultados a patrocinadores o público
- **Archivo**: Guardar capturas de pantalla para documentación

### Personalización

- **Paleta de colores**: Fondo degradado azul-morado
- **Acentos dorados**: Para elementos destacados
- **Animaciones**: Efectos sutiles para mejor experiencia visual
- **Tipografía**: Fuente optimizada para legibilidad

## API Endpoints

### Rutas Públicas

- `GET /api/public/:slug` - Información de competición para inscripción
- `GET /api/public/:slug/signup` - Inscripción pública
- `GET /api/public/:slug/status` - Estado público de la competición
- `GET /api/public-signup/:slug/presentation` - Datos específicos para modo presentación
- `GET /competitions/presentation/:slug` - Modo presentación (Live TV View)

### Rutas Protegidas

- `GET /api/timings` - Lista todos los tiempos del usuario (query: circuit, circuit_id)
- `GET /api/timings/:id/laps` - Vueltas individuales de una sesión (devuelve `{ laps }`)
- `GET /api/circuits` - Lista de circuitos del usuario
- `GET /api/circuits/:id` - Detalle de un circuito
- `POST /api/circuits` - Crear circuito (name, description, num_lanes, lane_lengths)
- `POST /api/circuits/find-or-create` - Buscar o crear circuito por nombre (devuelve `{ circuit, created }`)
- `PUT /api/circuits/:id` - Actualizar circuito
- `DELETE /api/circuits/:id` - Eliminar circuito (si no está en uso)
- `GET /api/competitions/my-competitions` - Mis competiciones
- `POST /api/competitions` - Crear competición (acepta circuit_id)
- `GET /api/competitions/:id` - Detalles de competición
- `GET /api/competitions/:id/participants` - Participantes
- `GET /api/competitions/:id/timings` - Tiempos registrados
- `POST /api/competitions/:id/timings` - Registrar tiempo

### Gestión de Reglas y Plantillas de Competición

- `GET /api/competition-rules/templates` - Obtener todas las plantillas de reglas
- `GET /api/competition-rules/competition/:competitionId` - Reglas asociadas a una competición
- `POST /api/competition-rules` - Crear nueva regla o plantilla
- `PUT /api/competition-rules/:id` - Editar una regla existente
- `DELETE /api/competition-rules/:id` - Eliminar una regla o plantilla
- `POST /api/competition-rules/apply-template/:templateId` - Clonar plantilla y asociar a competición

## Endpoints públicos añadido

### Obtener reglas de puntuación de una competición pública

- `GET /api/public-signup/:slug/rules`
  - Devuelve las reglas de puntuación asociadas a la competición identificada por el `public_slug`.
  - No requiere autenticación.
  - Respuesta: array de objetos con la estructura de las reglas (`rule_type`, `description`, `points_structure`, etc).

## API Keys e Integración

El sistema incluye **API keys por usuario** para conectar proyectos externos (por ejemplo, una app de gestión de tiempos de circuito) con esta aplicación.

### Cómo funciona

- Cada usuario tiene una **API key única** que se genera automáticamente al acceder por primera vez a la sección de perfil.
- La API key se usa enviando el header `X-API-Key` en las peticiones.
- Puedes ver, copiar y regenerar tu API key en **Mi Perfil** (menú de usuario).

### Endpoints de gestión de API keys

- `GET /api/api-keys/me` - Obtiene la API key del usuario (requiere JWT). Si no existe, la crea y devuelve el texto una sola vez. Si ya existía solo el hash en BD, devuelve `api_key: null` y `key_exists: true` (hay que regenerar desde Perfil o usar la clave guardada).
- `POST /api/api-keys/regenerate` - Regenera la API key (requiere JWT; la anterior deja de funcionar de inmediato).
- `POST /api/auth/api-key` - **Público (CORS permisivo)**: Envía `{ email, password }`. Misma lógica que `GET /api/api-keys/me` respecto a mostrar la clave solo al crear o si aún no migraste a hash.

### Endpoints de sincronización (API key)

Estos endpoints permiten a proyectos externos leer vehículos y registrar tiempos:

- `GET /api/sync/vehicles` - Lista los vehículos del usuario (id, model, manufacturer, type, traction, image). Query: `?page=1&limit=25`.
- `GET /api/sync/circuits` - Lista los circuitos del usuario (id, name, description, num_lanes, lane_lengths). Permite usar `circuit_id` en timings.
- `POST /api/sync/timings` - Crea un nuevo registro de tiempo. Body: `{ vehicle_id, best_lap_time, total_time, laps, average_time, lane?, circuit?, circuit_id?, timing_date?, lap_times? }`. Si envías `circuit` (nombre), se resuelve a `circuit_id` automáticamente (find-or-create). Opcional `lap_times: [{ lap_number?, time_seconds|lap_time_seconds, time_text? }]` para almacenar vueltas individuales y calcular consistencia.

**Ejemplo de uso desde otro proyecto:**

```
GET /api/sync/vehicles HTTP/1.1
X-API-Key: tu_api_key_aqui
```

### Migración de base de datos

Para crear la tabla `user_api_keys`, ejecuta:

```bash
cd backend
node scripts/migrate-add-api-keys.js
```

Si no tienes la función `exec_sql` en Supabase, ejecuta manualmente el SQL en `backend/scripts/add-api-keys.sql` desde el SQL Editor del dashboard.

Si tu tabla ya existía con la columna `api_key` en texto plano, ejecuta después `backend/scripts/migrate-user-api-keys-to-hash.sql` para pasar a almacenar solo `api_key_hash` (SHA-256).

### Tabla `circuits` (circuitos)

Si obtienes el error `relation "public.circuits" does not exist`, crea la tabla ejecutando en **Supabase SQL Editor**:

1. `backend/scripts/create-circuits-table.sql` – crea la tabla de circuitos (incluye UNIQUE user_id+name)
2. (Opcional) `backend/scripts/add-circuits-unique-constraint.sql` – añade UNIQUE (user_id, name) si la tabla ya existía sin ella
3. (Opcional) `backend/scripts/migrate-circuit-references.sql` – añade `circuit_id` a otras tablas si lo necesitas
4. (Opcional) `backend/scripts/populate-circuit-id-from-text.sql` – rellena `circuit_id` desde los circuitos en texto existentes (vehicle_timings, competitions, competition_timings)

**Backend:** `SUPABASE_KEY` debe ser la clave **anon** (pública). La clave **service_role** es **obligatoria** en `SUPABASE_SERVICE_ROLE_KEY` (Dashboard → Settings → API): el servidor no arranca sin ella y se usa para gestionar `user_api_keys` y validar `X-API-Key` frente al hash almacenado.

## Personalización y UI

### shadcn/ui + Tailwind CSS

The frontend uses **shadcn/ui** components with **Tailwind CSS** for styling:

- **Component library**: shadcn/ui (Radix UI primitives + Tailwind)
- **Styling**: Tailwind CSS with CSS variables for theming
- **Icons**: lucide-react
- **Theme**: Dark/Light mode toggle (persisted in localStorage)

### Theme Toggle

Users can switch between light and dark mode via the theme toggle button in the navbar. The preference is saved in localStorage.

### Key UI Components

- Layout: `Navbar`, `Footer` with responsive Sheet for mobile menu
- Forms: `Input`, `Label`, `Select`, `Switch`, `Button`
- Data display: `Card`, `Table`, `Badge`, `Tabs`
- Feedback: `Alert`, `Spinner`, `Dialog`, `Tooltip`
- Charts: Recharts (unchanged)

### Estilos CSS

Los estilos están organizados en:

- `frontend/src/index.css` - Tailwind directives + shadcn CSS variables
- `frontend/src/styles/competitions.css` - Estilos de competiciones (variables CSS, compatible con dark mode)

### Temas y Colores

- **Light/Dark**: CSS variables (`--background`, `--foreground`, `--primary`, etc.)
- **Primary**: oklch-based palette (adapts to theme)

## Deploy en Vercel

El proyecto incluye configuración para desplegar el frontend en Vercel:

- **vercel.json**: Define `rootDirectory: "frontend"` para que Vercel construya solo el frontend
- **postinstall**: Actualiza la base de datos de Browserslist (`caniuse-lite`) tras `npm install` para evitar warnings en el build

Si el build falla por memoria, añade en Vercel → Settings → Environment Variables: `NODE_OPTIONS=--max-old-space-size=4096`

## Contribución

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## Licencia

Este proyecto está bajo la Licencia MIT. Ver el archivo `LICENSE` para más detalles.

## Soporte

Si tienes problemas o preguntas:

1. Revisa la documentación en `COMPETITIONS_GUIDE.md`
2. Abre un issue en GitHub
3. Contacta al equipo de desarrollo

## Roadmap

### Próximas Funcionalidades

- Exportación PDF de resultados
- Notificaciones en tiempo real
- Sistema de puntuación personalizable
- Integración con redes sociales
- App móvil nativa
- Sistema de torneos
- Análisis avanzado de rendimiento

## Documentación Swagger de la API

La documentación interactiva de la API está disponible en:

```
http://localhost:5001/api-docs
```

Puedes explorar y probar los endpoints desde esa interfaz.

Si necesitas agregar o actualizar la documentación, añade anotaciones Swagger en los archivos de rutas dentro de `backend/routes/` siguiendo el formato OpenAPI 3.0.

### Endpoint de login para Swagger

Para facilitar las pruebas en Swagger, existe el endpoint:

```
POST /api/auth/login
```

Este endpoint permite obtener un token JWT usando email y contraseña de un usuario registrado en Supabase. **No debe usarse en producción ni en el frontend, solo para pruebas en Swagger.**

## Cambios recientes

### v1.10.0 - Módulo de Circuitos

- **Nueva tabla `circuits`**: Almacena circuitos con nombre, descripción, número de carriles y longitud por carril
- **Referencias `circuit_id`**: Las tablas `competitions`, `vehicle_timings` y `competition_timings` ahora referencian la tabla de circuitos
- **Página Circuitos**: Nueva sección en el menú para crear, editar y eliminar circuitos
- **Selector en competiciones**: Al crear competiciones se selecciona un circuito de la lista
- **Selector en tiempos**: Al registrar tiempos (competición o vehículo) se selecciona el circuito
- **Filtro en tabla de tiempos**: El filtro por circuito usa un dropdown con los circuitos definidos

### v1.10.1 - Circuitos multi-usuario

- **Restricción UNIQUE (user_id, name)**: Evita duplicados de circuitos con el mismo nombre por usuario
- **POST /api/circuits/find-or-create**: Endpoint para buscar o crear circuito por nombre (JWT)
- **GET /api/sync/circuits**: Lista circuitos del usuario vía API key (para apps externas)
- **POST /api/sync/timings**: Acepta `circuit_id` o `circuit` (nombre); si se envía nombre, se resuelve a `circuit_id` automáticamente (find-or-create)

**Migración de base de datos:**

```bash
cd backend
node scripts/migrate-create-circuits.js
```

Si no tienes `exec_sql` en Supabase, ejecuta manualmente en el SQL Editor:

1. `backend/scripts/create-circuits-table.sql`
2. `backend/scripts/migrate-circuit-references.sql`

**Archivos creados:**

- `backend/scripts/create-circuits-table.sql` - Crea tabla circuits
- `backend/scripts/migrate-circuit-references.sql` - Añade circuit_id a competitions, vehicle_timings, competition_timings
- `backend/scripts/populate-circuit-id-from-text.sql` - Rellena circuit_id desde circuit/circuit_name en texto
- `backend/scripts/migrate-create-circuits.js` - Script de migración
- `backend/routes/circuits.js` - API CRUD de circuitos
- `frontend/src/pages/Circuits.jsx` - Página de gestión de circuitos

### v1.9.0 - Migración a shadcn/ui (COMPLETADA)

- **Nuevo sistema de UI**: Migración de Bootstrap 5 a shadcn/ui + Tailwind CSS
- **Dark/Light mode**: Toggle de tema con persistencia en localStorage
- **Componentes migrados**: Navbar, Footer, LandingPage, Login, Dashboard, VehicleList, VehicleCard, AddVehicle, MetricCard
- **Layout responsive**: Sheet para menú móvil, NavigationMenu para desktop
- **CRACO**: Path alias `@/` configurado para imports limpios
- **Iconos**: lucide-react para iconografía consistente

**Stack de UI actual:**

- Tailwind CSS v3
- shadcn/ui (Button, Card, Badge, Input, Dialog, Table, Tabs, etc.)
- lucide-react
- Recharts (sin cambios)

**Nota**: Migración a shadcn/ui completada. Bootstrap CSS eliminado. Todos los componentes usan shadcn/ui. Iconos: lucide-react (incluyendo presentation: CompetitionHeader, RoundProgressGrid, BestLapHighlight). InstallPWAButton migrado a Button de shadcn. CompetitionPresentation (modo proyector) mantiene estilos propios con lucide-react.

### FASE 2 - Frontend: Editor Visual de Reglas (COMPLETADA)

Se ha implementado completamente el editor visual de reglas para las competiciones:

#### Nuevos Componentes Frontend

- **CompetitionRulesPanel.jsx** - Vista principal que reemplaza el antiguo sistema
- **RuleFormModal.jsx** - Modal para crear y editar reglas con formulario completo
- **TemplatesDrawer.jsx** - Drawer lateral para aplicar plantillas predefinidas

#### Características Implementadas

- **Aplicar plantillas**: Botón para aplicar sistemas de puntuación predefinidos
- **Editor visual de puntos**: Interfaz intuitiva para definir puntos por posición
- **Validaciones en tiempo real**: Verificación de campos requeridos y formatos
- **Soporte para bonus**: Opción de bonus por mejor vuelta de cada ronda
- **Búsqueda de plantillas**: Filtrado en tiempo real de plantillas disponibles
- **Estados de carga**: Spinners y mensajes durante operaciones
- **Validación de seguridad**: Deshabilitación de edición si hay tiempos registrados

#### Flujo de Trabajo

1. **Ver reglas existentes** - Lista visual con badges de tipo y bonus
2. **Aplicar plantilla** - Seleccionar de plantillas predefinidas
3. **Crear nueva regla** - Formulario completo con validaciones
4. **Editar regla existente** - Modificar puntos y descripción
5. **Eliminar regla** - Confirmación y actualización

### FASE 1 - Backend: API para gestionar reglas y plantillas (COMPLETADA)

Se ha implementado un sistema completo de gestión de reglas y plantillas para las competiciones:

#### Nuevos Endpoints

- `GET /api/competition-rules/templates` - Obtener todas las plantillas de reglas
- `GET /api/competition-rules/competition/:competitionId` - Reglas asociadas a una competición
- `POST /api/competition-rules` - Crear nueva regla o plantilla
- `PUT /api/competition-rules/:id` - Editar una regla existente
- `DELETE /api/competition-rules/:id` - Eliminar una regla o plantilla
- `POST /api/competition-rules/apply-template/:templateId` - Clonar plantilla y asociar a competición

#### Nuevos Campos en la Base de Datos

- `is_template` (boolean) - Indica si es una plantilla o regla de competición
- `created_by` (uuid) - Usuario que creó la regla/plantilla
- `use_bonus_best_lap` (boolean) - Indica si se aplica bonus por mejor vuelta
- `name` (text) - Nombre de la plantilla (solo para plantillas)

#### Plantillas Incluidas

- Sistema Estándar (1º=10, 2º=8, 3º=6, 4º=4, 5º=2)
- Sistema F1 (1º=25, 2º=18, 3º=15, 4º=12, 5º=10, 6º=8, 7º=6, 8º=4, 9º=2, 10º=1)
- Sistema Simple (1º=3, 2º=2, 3º=1)
- Sistema con Bonus (con punto extra por mejor vuelta)
- Puntuación Final (bonus para ganador general)
- Sistema de Eliminación (solo primeros 3)
- Sistema Extendido (para competiciones grandes)

---

**¡Disfruta organizando tus competiciones de Scalextric!**

## Actualizaciones Recientes

### v1.7.0 - Modo Presentación (Live TV View)

- **Nueva Vista Fullscreen**: Diseño optimizado para proyectores y pantallas grandes
- **Ranking en Vivo**: Clasificación actualizada automáticamente cada 10 segundos
- **Mejor Vuelta Destacada**: Visualización prominente del tiempo más rápido
- **Grid de Progreso por Rondas**: Vista visual del estado de cada participante
- **URL Dedicada**: Acceso directo via `/competitions/presentation/:slug`
- **Sin Controles de Usuario**: Interfaz limpia para presentaciones públicas
- **Diseño Responsive**: Adaptable a diferentes tamaños de pantalla
- **Auto-actualización**: Polling automático sin interacción requerida
- **Endpoint Backend Específico**: `/api/public-signup/:slug/presentation` optimizado para presentación

**Archivos Creados:**

- `frontend/src/pages/CompetitionPresentation.jsx` - Página principal del modo presentación
- `frontend/src/components/presentation/CompetitionHeader.jsx` - Header de competición
- `frontend/src/components/presentation/LiveRankingTable.jsx` - Tabla de ranking en vivo
- `frontend/src/components/presentation/RoundProgressGrid.jsx` - Grid de progreso por rondas
- `frontend/src/components/presentation/BestLapHighlight.jsx` - Destacado de mejor vuelta
- `frontend/src/pages/CompetitionPresentation.css` - Estilos fullscreen para presentación

**Archivos Modificados:**

- `frontend/src/App.jsx` - Nueva ruta para modo presentación
- `frontend/src/pages/CompetitionStatus.jsx` - Botón para acceder al modo presentación
- `backend/routes/publicCompetitions.js` - Nuevo endpoint `/presentation` con datos optimizados
- `readme.md` - Documentación completa del nuevo modo

**Características Técnicas:**

1. **Diseño Fullscreen**: 100vh x 100vw sin scroll
2. **Auto-actualización**: Polling cada 10 segundos
3. **Paleta Oscura**: Fondo degradado azul-morado con acentos dorados
4. **Posiciones Destacadas**: Oro, plata y bronce con colores especiales
5. **Estados Visuales**: Iconos para completado, en progreso y pendiente
6. **Responsive Design**: Layout adaptable a diferentes pantallas
7. **Endpoint Optimizado**: Datos transformados específicamente para presentación
8. **Documentación Swagger**: API documentada para el nuevo endpoint

### v1.4.0 - Corrección de Bug: Campo category_id en Participantes

- **Problema Resuelto**: El campo `category_id` ahora se guarda correctamente en la base de datos
- **Validación Mejorada**: Verificación de que la categoría existe antes de asignar participantes
- **Migración de Base de Datos**: Script para añadir el campo `category_id` a la tabla `competition_participants`
- **Backend Actualizado**: Rutas POST y PUT para participantes ahora procesan correctamente el `category_id`
- **Validación de Categorías**: Verificación de que la categoría pertenece a la competición correcta

**Archivos Modificados:**

- `backend/routes/competitions.js` - Rutas POST y PUT actualizadas
- `backend/scripts/add-category-id-to-participants.sql` - Script SQL para migración
- `backend/scripts/migrate-add-category-id.js` - Script de migración en JavaScript

**Cambios Técnicos:**

1. **Ruta POST /:id/participants**: Ahora incluye validación y procesamiento de `category_id`
2. **Ruta PUT /:id/participants/:participantId**: Actualizada para manejar `category_id`
3. **Validación de Categorías**: Verificación de que la categoría existe y pertenece a la competición
4. **Migración de Base de Datos**: Campo `category_id` añadido con referencia a `competition_categories`

### v1.5.0 - Refactorización del Sistema de Reglas: Bonus por Mejor Vuelta

- **Eliminación de Tipo de Regla**: Removido el tipo "Mejor tiempo por ronda" del selector
- **Nuevo Sistema de Bonus**: Implementado el campo `use_bonus_best_lap` para otorgar 1 punto adicional
- **Lógica Simplificada**: El bonus se aplica automáticamente a las reglas de tipo "Por ronda"
- **Cálculos Actualizados**: Backend modificado para usar el nuevo sistema de bonus
- **Plantillas Limpiadas**: Eliminada la plantilla "Mejor Vuelta por Ronda" y actualizadas las existentes
- **Documentación Actualizada**: Todas las guías actualizadas para reflejar los cambios

**Archivos Modificados:**

- `frontend/src/components/RuleFormModal.jsx` - Eliminada opción best_time_per_round
- `frontend/src/components/CompetitionRulesPanel.jsx` - Actualizada función de descripción
- `frontend/src/components/TemplatesDrawer.jsx` - Actualizada función de descripción
- `backend/routes/competitions.js` - Lógica de cálculo actualizada
- `backend/routes/publicCompetitions.js` - Lógica de cálculo actualizada
- `backend/scripts/insert-rule-templates.sql` - Plantillas actualizadas
- `backend/scripts/cleanup-best-time-rules.sql` - Script de limpieza
- `backend/scripts/migrate-cleanup-best-time-rules.js` - Script de migración

**Cambios Técnicos:**

1. **Frontend**: Eliminada opción "Mejor tiempo por ronda" del selector de tipos
2. **Backend**: Lógica de cálculo modificada para usar `use_bonus_best_lap`
3. **Base de Datos**: Limpieza de reglas existentes con tipo `best_time_per_round`
4. **Plantillas**: Actualizadas para usar el nuevo sistema de bonus
5. **Documentación**: Todas las guías actualizadas para reflejar los cambios

### v1.8.0 - Corrección de Navegación PWA en Mobile

- **Problema Resuelto**: El icono de la PWA en móviles ahora navega correctamente al dashboard (si estás logueado) o al login (si no lo estás)
- **Service Worker Mejorado**: Corregida la interceptación de peticiones que interferían con React Router
- **Navegación del Logo**: El logo ahora funciona correctamente tanto en navegadores como en PWA
- **Start URL Actualizada**: Manifest.json configurado con parámetro de tracking PWA
- **Herramientas de Debug**: Agregadas utilidades de diagnóstico PWA para desarrollo

**Problema Identificado:**

- Cuando se abría la PWA desde el icono del móvil, quedaba en una página en blanco
- El Service Worker interceptaba todas las peticiones de navegación, interfiriendo con React Router
- El logo no navegaba correctamente según el estado de autenticación

**Solución Implementada:**

1. **Service Worker Corregido**: Ahora solo intercepta archivos estáticos y permite que React Router maneje la navegación
2. **Navegación Inteligente del Logo**: Redirige a `/dashboard` si el usuario está logueado, o a `/` si no lo está
3. **Detección PWA**: Parámetro `?source=pwa` en start_url para identificar aberturas desde icono PWA
4. **Debug Mejorado**: Logging en consola para identificar problemas de navegación en desarrollo

**Archivos Modificados:**

- `frontend/public/service-worker.js` - Lógica de interceptación corregida para no interferir con navegación
- `frontend/public/manifest.json` - start_url actualizada con parámetro de tracking
- `frontend/src/App.jsx` - Detección PWA y logging de debug agregado
- `frontend/src/components/Navbar.jsx` - Navegación del logo mejorada con lógica de autenticación
- `frontend/src/utils/pwaDiagnostics.js` - Herramientas de diagnóstico PWA para desarrollo

**Cambios Técnicos:**

1. **Service Worker**: Solo intercepta peticiones con `request.mode === 'navigate'` para servir index.html
2. **Cache Strategy**: Archivos estáticos cacheados, navegación delegada a React Router
3. **Logo Navigation**: onClick handler que previene default y usa `navigate()` programáticamente
4. **PWA Detection**: URL params para detectar cuando se abre desde icono instalado
5. **Debug Tools**: Diagnóstico completo de PWA en modo desarrollo

### v1.6.0 - Corrección del Cálculo de Puntos en Tiempos Agregados

- **Problema Resuelto**: Los puntos en la pestaña "Tiempos Agregados" ahora se calculan correctamente
- **Cálculo Unificado**: Eliminado el cálculo de puntos en el frontend, ahora se obtiene del backend
- **Penalizaciones Consideradas**: Los puntos ahora consideran las penalizaciones aplicadas
- **Bonus por Mejor Vuelta**: El bonus por mejor vuelta se aplica correctamente
- **Consistencia**: Los puntos son idénticos entre `CompetitionTimings` y `CompetitionStatus`

**Archivos Modificados:**

- `frontend/src/pages/CompetitionTimings.jsx` - Eliminada función calculatePoints, puntos obtenidos del backend
- `backend/routes/competitions.js` - Endpoint /progress actualizado para incluir puntos en participant_stats

**Cambios Técnicos:**

1. **Frontend**: Eliminada función `calculatePoints` que calculaba puntos incorrectamente
2. **Backend**: Endpoint `/progress` ahora incluye `points` en `participant_stats`
3. **Cálculo Unificado**: Ambos componentes usan la misma lógica de cálculo del backend
4. **Penalizaciones**: Los puntos ahora consideran las penalizaciones aplicadas a los tiempos
5. **Bonus**: El bonus por mejor vuelta se aplica correctamente usando `use_bonus_best_lap`


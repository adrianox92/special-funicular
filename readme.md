# 🏁 Scalextric Collection - Gestión de Competiciones

Una aplicación web completa para gestionar tu colección de coches Scalextric y organizar competiciones de manera profesional.

## 📱 PWA (Progressive Web App)

Esta aplicación está configurada como una **Progressive Web App (PWA)**, lo que significa que puedes instalarla en tu dispositivo móvil o computadora como una aplicación nativa.

### ✨ Características PWA

- **Instalable**: Puedes instalar la app en tu dispositivo desde el navegador
- **Funcionamiento offline**: La aplicación funciona sin conexión a internet
- **Notificaciones push**: Recibe notificaciones de competiciones y actualizaciones
- **Experiencia nativa**: Se comporta como una aplicación móvil nativa
- **Actualizaciones automáticas**: Se actualiza automáticamente cuando hay nuevas versiones

### 📲 Cómo Instalar la PWA

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

### 🔧 Requisitos Técnicos PWA

- **HTTPS obligatorio**: La PWA requiere conexión segura en producción
- **Service Worker**: Para funcionamiento offline y cacheo
- **Manifest.json**: Configuración de la aplicación instalable
- **Iconos**: Múltiples tamaños para diferentes dispositivos

### 🛠️ Solución de Problemas PWA

Si no ves el botón de instalación:

1. **Verifica HTTPS**: Asegúrate de que el sitio use HTTPS en producción
2. **Limpia el cache**: Borra el cache del navegador y recarga
3. **Verifica el Service Worker**: Abre las herramientas de desarrollador → Application → Service Workers
4. **Revisa la consola**: Busca errores relacionados con el Service Worker
5. **Reinstala**: Si ya está instalada, desinstala y vuelve a instalar

### 🔧 Problemas Resueltos

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

### 🧪 Herramientas de Debug

En modo desarrollo, se añaden botones de debug:
- **🔍 Debug PWA**: Muestra diagnóstico completo de la PWA
- **🧪 Test Nav**: Prueba la navegación programática

Para usar las herramientas de debug:
1. Abre la consola del navegador (F12)
2. Busca los botones de debug en la esquina inferior izquierda
3. Haz clic en "Debug PWA" para ver el estado completo
4. Usa "Test Nav" para probar la navegación

### 📊 Estado de la PWA

- ✅ Manifest.json configurado

## 🏆 Sistema de Seguimiento de Posiciones

### ✨ Nueva Funcionalidad

La aplicación ahora incluye un **sistema avanzado de seguimiento de posiciones** que permite:

- **Posición en tiempo real**: Muestra la posición actual de cada vehículo en cada circuito
- **Cambios de posición**: Indica si un vehículo subió o bajó de posición
- **Historial de posiciones**: Rastrea la evolución de las posiciones a lo largo del tiempo
- **Rankings por circuito**: Clasificaciones separadas para cada circuito

### 🔧 Características Técnicas

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
  - ⬆️ Verde para subidas de posición
  - ⬇️ Rojo para bajadas de posición
  - Badges de posición con colores diferenciados
- **Estilos responsivos**: Adaptado para dispositivos móviles y desktop

### 📊 Cómo Funciona

1. **Registro de tiempo**: Al registrar un nuevo tiempo en un circuito
2. **Cálculo automático**: El sistema recalcula todas las posiciones del circuito
3. **Detección de cambios**: Identifica qué vehículos cambiaron de posición
4. **Actualización en tiempo real**: La interfaz muestra inmediatamente los cambios
5. **Historial preservado**: Se mantiene un registro de todas las posiciones anteriores

### 🚀 Implementación

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

### 🎯 Casos de Uso

#### Ejemplo 1: Subida de Posición
- **Antes**: Vehículo A en posición 5
- **Nuevo tiempo**: Mejor tiempo que mejora la posición
- **Resultado**: Vehículo A sube a posición 4, se muestra ⬆️ +1

#### Ejemplo 2: Bajada de Posición
- **Antes**: Vehículo B en posición 2
- **Nuevo tiempo**: Otro vehículo mejora y le adelanta
- **Resultado**: Vehículo B baja a posición 3, se muestra ⬇️ -1

#### Ejemplo 3: Sin Cambios
- **Antes**: Vehículo C en posición 1
- **Nuevo tiempo**: Mantiene el mejor tiempo
- **Resultado**: Vehículo C mantiene posición 1, sin indicador de cambio

### 🔍 Monitoreo y Debug

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

### 📈 Beneficios

1. **Transparencia**: Los usuarios pueden ver exactamente cómo evolucionan las posiciones
2. **Motivación**: Los cambios de posición proporcionan feedback inmediato
3. **Competitividad**: Fomenta la mejora continua de tiempos
4. **Análisis**: Permite analizar tendencias de rendimiento por circuito
5. **Experiencia**: Interfaz más rica y atractiva para los usuarios

### 🔮 Futuras Mejoras

- **Notificaciones**: Alertas cuando un vehículo cambie de posición
- **Gráficos**: Visualización de la evolución de posiciones a lo largo del tiempo
- **Estadísticas**: Análisis de frecuencia de cambios de posición
- **Exportación**: Incluir información de posiciones en reportes PDF/CSV
- **Comparativas**: Comparar rendimiento entre diferentes períodos
- ✅ Service Worker registrado
- ✅ Iconos en múltiples tamaños
- ✅ Botón de instalación implementado
- ✅ Funcionamiento offline básico
- ✅ Actualizaciones automáticas

## ✨ Características Principales

### 🎨 Interfaz de Usuario Profesional
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

### 🏠 Página Principal (Landing Page)
- **Diseño minimalista**: Interfaz limpia y profesional para usuarios no logueados
- **Hero section atractivo**: Título con gradiente, descripción clara y botones de acción
- **Elementos visuales**: Tarjetas flotantes con iconos representativos de las funcionalidades
- **Sección de características**: Grid de 6 funcionalidades principales con iconos y descripciones
- **Call-to-action**: Sección destacada para motivar el registro
- **Footer informativo**: Enlaces útiles y información de la plataforma
- **Navegación intuitiva**: Botones que llevan directamente al login/registro
- **Responsive design**: Adaptable a todos los tamaños de pantalla
- **Efectos visuales**: Animaciones suaves y efectos hover elegantes
- **Colores coherentes**: Paleta de colores consistente con el resto de la aplicación

### 🚗 Gestión de Vehículos
- **Catálogo completo**: Registra todos tus coches Scalextric con detalles técnicos
- **Fotos múltiples**: Añade varias imágenes por vehículo
- **Categorización**: Organiza por fabricante, tipo y tracción
- **Búsqueda avanzada**: Encuentra rápidamente cualquier vehículo
- **Estadísticas visuales**: Gráficos de distribución por marca y tipo
- **Gráficas de evolución de tiempos**: Visualiza la mejora de rendimiento de cada vehículo por circuito y carril
- **Análisis de rendimiento**: Compara tiempos de mejor vuelta y promedio a lo largo del tiempo
- **Seguimiento de progreso**: Identifica tendencias de mejora en diferentes circuitos

### 🏆 Sistema de Competiciones
- **Creación de competiciones**: Configura eventos con múltiples rondas
- **Inscripciones públicas**: Enlaces públicos para que cualquiera se inscriba
- **Gestión de participantes**: Añade pilotos y asigna vehículos
- **Registro de tiempos**: Sistema completo de cronometraje por ronda
- **Clasificaciones automáticas**: Rankings en tiempo real
- **Exportación de datos**: Descarga resultados en CSV

### 🖥️ Modo Presentación (Live TV View)

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
  - ✅ Completada (verde con efecto de sombra)
  - ⏳ En progreso (amarillo con animación pulsante)
  - ⏸️ Pendiente (gris)
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

## 🔧 API Endpoints

### Rutas Públicas
- `GET /api/public/:slug` - Información de competición para inscripción
- `GET /api/public/:slug/signup` - Inscripción pública
- `GET /api/public/:slug/status` - Estado público de la competición
- `GET /api/public-signup/:slug/presentation` - Datos específicos para modo presentación
- `GET /competitions/presentation/:slug` - Modo presentación (Live TV View)

### Rutas Protegidas
- `GET /api/competitions/my-competitions` - Mis competiciones
- `POST /api/competitions` - Crear competición
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

## Endpoints públicos añadidos

### Obtener reglas de puntuación de una competición pública

- `GET /api/public-signup/:slug/rules`
  - Devuelve las reglas de puntuación asociadas a la competición identificada por el `public_slug`.
  - No requiere autenticación.
  - Respuesta: array de objetos con la estructura de las reglas (`rule_type`, `description`, `points_structure`, etc).

## 🎨 Personalización

### Estilos CSS
Los estilos están organizados en:
- `frontend/src/styles/competitions.css` - Estilos de competiciones
- `frontend/src/App.css` - Estilos generales

### Temas y Colores
- **Primario**: Gradiente azul-morado (#667eea → #764ba2)
- **Secundario**: Amarillo dorado (#ffd700)
- **Éxito**: Verde (#28a745)
- **Advertencia**: Naranja (#ffc107)

## 🤝 Contribución

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📝 Licencia

Este proyecto está bajo la Licencia MIT. Ver el archivo `LICENSE` para más detalles.

## 🆘 Soporte

Si tienes problemas o preguntas:
1. Revisa la documentación en `COMPETITIONS_GUIDE.md`
2. Abre un issue en GitHub
3. Contacta al equipo de desarrollo

## 🚀 Roadmap

### Próximas Funcionalidades
- [ ] Exportación PDF de resultados
- [ ] Notificaciones en tiempo real
- [ ] Sistema de puntuación personalizable
- [ ] Integración con redes sociales
- [ ] App móvil nativa
- [ ] Sistema de torneos
- [ ] Análisis avanzado de rendimiento

## Documentación Swagger de la API

La documentación interactiva de la API está disponible en:

    http://localhost:5001/api-docs

Puedes explorar y probar los endpoints desde esa interfaz.

Si necesitas agregar o actualizar la documentación, añade anotaciones Swagger en los archivos de rutas dentro de `backend/routes/` siguiendo el formato OpenAPI 3.0.

### Endpoint de login para Swagger

Para facilitar las pruebas en Swagger, existe el endpoint:

    POST /api/auth/login

Este endpoint permite obtener un token JWT usando email y contraseña de un usuario registrado en Supabase. **No debe usarse en producción ni en el frontend, solo para pruebas en Swagger.**

## Cambios recientes

### ✅ FASE 2 - Frontend: Editor Visual de Reglas (COMPLETADA)

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

### ✅ FASE 1 - Backend: API para gestionar reglas y plantillas (COMPLETADA)

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

**¡Disfruta organizando tus competiciones de Scalextric! 🏁**

## 🔄 Actualizaciones Recientes

### v1.7.0 - Modo Presentación (Live TV View)
- ✅ **Nueva Vista Fullscreen**: Diseño optimizado para proyectores y pantallas grandes
- ✅ **Ranking en Vivo**: Clasificación actualizada automáticamente cada 10 segundos
- ✅ **Mejor Vuelta Destacada**: Visualización prominente del tiempo más rápido
- ✅ **Grid de Progreso por Rondas**: Vista visual del estado de cada participante
- ✅ **URL Dedicada**: Acceso directo via `/competitions/presentation/:slug`
- ✅ **Sin Controles de Usuario**: Interfaz limpia para presentaciones públicas
- ✅ **Diseño Responsive**: Adaptable a diferentes tamaños de pantalla
- ✅ **Auto-actualización**: Polling automático sin interacción requerida
- ✅ **Endpoint Backend Específico**: `/api/public-signup/:slug/presentation` optimizado para presentación

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
- ✅ **Problema Resuelto**: El campo `category_id` ahora se guarda correctamente en la base de datos
- ✅ **Validación Mejorada**: Verificación de que la categoría existe antes de asignar participantes
- ✅ **Migración de Base de Datos**: Script para añadir el campo `category_id` a la tabla `competition_participants`
- ✅ **Backend Actualizado**: Rutas POST y PUT para participantes ahora procesan correctamente el `category_id`
- ✅ **Validación de Categorías**: Verificación de que la categoría pertenece a la competición correcta

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
- ✅ **Eliminación de Tipo de Regla**: Removido el tipo "Mejor tiempo por ronda" del selector
- ✅ **Nuevo Sistema de Bonus**: Implementado el campo `use_bonus_best_lap` para otorgar 1 punto adicional
- ✅ **Lógica Simplificada**: El bonus se aplica automáticamente a las reglas de tipo "Por ronda"
- ✅ **Cálculos Actualizados**: Backend modificado para usar el nuevo sistema de bonus
- ✅ **Plantillas Limpiadas**: Eliminada la plantilla "Mejor Vuelta por Ronda" y actualizadas las existentes
- ✅ **Documentación Actualizada**: Todas las guías actualizadas para reflejar los cambios

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
- ✅ **Problema Resuelto**: El icono de la PWA en móviles ahora navega correctamente al dashboard (si estás logueado) o al login (si no lo estás)
- ✅ **Service Worker Mejorado**: Corregida la interceptación de peticiones que interferían con React Router
- ✅ **Navegación del Logo**: El logo ahora funciona correctamente tanto en navegadores como en PWA
- ✅ **Start URL Actualizada**: Manifest.json configurado con parámetro de tracking PWA
- ✅ **Herramientas de Debug**: Agregadas utilidades de diagnóstico PWA para desarrollo

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
- ✅ **Problema Resuelto**: Los puntos en la pestaña "Tiempos Agregados" ahora se calculan correctamente
- ✅ **Cálculo Unificado**: Eliminado el cálculo de puntos en el frontend, ahora se obtiene del backend
- ✅ **Penalizaciones Consideradas**: Los puntos ahora consideran las penalizaciones aplicadas
- ✅ **Bonus por Mejor Vuelta**: El bonus por mejor vuelta se aplica correctamente
- ✅ **Consistencia**: Los puntos son idénticos entre `CompetitionTimings` y `CompetitionStatus`

**Archivos Modificados:**
- `frontend/src/pages/CompetitionTimings.jsx` - Eliminada función calculatePoints, puntos obtenidos del backend
- `backend/routes/competitions.js` - Endpoint /progress actualizado para incluir puntos en participant_stats

**Cambios Técnicos:**
1. **Frontend**: Eliminada función `calculatePoints` que calculaba puntos incorrectamente
2. **Backend**: Endpoint `/progress` ahora incluye `points` en `participant_stats`
3. **Cálculo Unificado**: Ambos componentes usan la misma lógica de cálculo del backend
4. **Penalizaciones**: Los puntos ahora consideran las penalizaciones aplicadas a los tiempos
5. **Bonus**: El bonus por mejor vuelta se aplica correctamente usando `use_bonus_best_lap`
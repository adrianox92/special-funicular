# 🏁 Scalextric Collection - Gestión de Competiciones

Una aplicación web completa para gestionar tu colección de coches Scalextric y organizar competiciones de manera profesional.

## ✨ Características Principales

### 🎨 Interfaz de Usuario Profesional
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

### 🚗 Gestión de Vehículos
- **Catálogo completo**: Registra todos tus coches Scalextric con detalles técnicos
- **Fotos múltiples**: Añade varias imágenes por vehículo
- **Categorización**: Organiza por fabricante, tipo y tracción
- **Búsqueda avanzada**: Encuentra rápidamente cualquier vehículo
- **Estadísticas visuales**: Gráficos de distribución por marca y tipo

### 🏆 Sistema de Competiciones
- **Creación de competiciones**: Configura eventos con múltiples rondas
- **Inscripciones públicas**: Enlaces públicos para que cualquiera se inscriba
- **Gestión de participantes**: Añade pilotos y asigna vehículos
- **Registro de tiempos**: Sistema completo de cronometraje por ronda
- **Clasificaciones automáticas**: Rankings en tiempo real
- **Exportación de datos**: Descarga resultados en CSV

### 🖥️ Modo Presentación (Live TV View)
- **Vista fullscreen**: Diseño optimizado para proyectores y pantallas grandes
- **Ranking en vivo**: Clasificación actualizada automáticamente cada 10 segundos
- **Mejor vuelta destacada**: Visualización prominente del tiempo más rápido
- **Progreso por rondas**: Grid visual del estado de cada participante por ronda
- **Sin controles de usuario**: Interfaz limpia para presentaciones públicas
- **URL dedicada**: Acceso directo via `/competitions/presentation/:slug`
- **Diseño responsive**: Adaptable a diferentes tamaños de pantalla

### 📊 Análisis y Estadísticas
- **Dashboard interactivo**: Vista general de tu colección
- **Gráficos dinámicos**: Distribución de marcas, inversiones, modificaciones
- **Tendencias temporales**: Evolución de tu colección
- **Métricas de rendimiento**: Análisis de competiciones
- **Tendencias en tiempo real**: Cálculo automático de tendencias basado en datos históricos
- **Indicadores de progreso**: Comparación mes a mes de métricas clave
- **Análisis de rendimiento**: Evolución de tiempos y récords
- **Métricas de inversión**: Seguimiento de costes y valor de la colección

### 🌐 Vista Pública de Competiciones
- **Estado en tiempo real**: Seguimiento público del progreso de competiciones
- **Clasificación general**: Ranking actualizado automáticamente
- **Estadísticas detalladas**: Mejores vueltas, tiempos totales, progreso
- **Diseño responsive**: Accesible desde cualquier dispositivo
- **URLs públicas**: Enlaces directos para compartir con espectadores
- **Modo presentación**: Vista especial para proyectores y pantallas grandes

## 🚀 Tecnologías Utilizadas

### Frontend
- **React 18** - Biblioteca de interfaz de usuario
- **React Bootstrap** - Componentes UI responsivos
- **React Router** - Navegación entre páginas
- **Chart.js** - Gráficos interactivos
- **Axios** - Cliente HTTP

### Backend
- **Node.js** - Runtime de JavaScript
- **Express.js** - Framework web
- **Supabase** - Base de datos PostgreSQL y autenticación
- **Multer** - Manejo de archivos
- **JWT** - Autenticación de tokens

### Base de Datos
- **PostgreSQL** - Base de datos relacional
- **Supabase Auth** - Sistema de autenticación
- **Storage** - Almacenamiento de imágenes

## 📱 Características de la Vista Pública

### Estado "En Curso"
- **Indicador de progreso**: Porcentaje de completitud de la competición
- **Información general**: Nombre, circuito, número de participantes y rondas
- **Tabla de participantes**: 
  - Piloto y vehículo
  - Vueltas registradas por ronda
  - Tiempo acumulado (si disponible)
  - Estado de progreso individual

### Estado "Finalizada"
- **Clasificación general**: Ranking final con posiciones
- **Mejor vuelta global**: Tiempo más rápido de toda la competición
- **Estadísticas completas**: Tiempos totales, diferencias, vueltas
- **Opción de exportación**: Descarga de resultados en PDF (en desarrollo)

### Características Técnicas
- **URLs amigables**: Enlaces tipo `/competitions/status/nombre-competicion`
- **Actualización en tiempo real**: Datos siempre actualizados
- **Diseño responsive**: Optimizado para móviles y tablets
- **Sin autenticación requerida**: Acceso público directo

## 🛠️ Instalación y Configuración

### Prerrequisitos
- Node.js (v16 o superior)
- npm o yarn
- Cuenta en Supabase

### 1. Clonar el repositorio
```bash
git clone https://github.com/tu-usuario/scalextric-collection.git
cd scalextric-collection
```

### 2. Configurar variables de entorno
Crear archivo `.env` en la raíz del proyecto:
```env
SUPABASE_URL=tu_url_de_supabase
SUPABASE_KEY=tu_clave_anonima_de_supabase
JWT_SECRET=tu_secreto_jwt
```

### 3. Instalar dependencias
```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 4. Configurar la base de datos
Ejecutar los scripts SQL en Supabase:
- `add-slug-column.sql`
- `add-public-slug-column.sql`

### 5. Ejecutar migraciones
```bash
cd backend
node scripts/migrate-add-slug.js
node scripts/migrate-insert-templates.js
```

### 6. Iniciar la aplicación
```bash
# Backend (puerto 3001)
cd backend
npm start

# Frontend (puerto 3000)
cd frontend
npm start
```

## 📖 Uso de la Vista Pública

### Acceso a la Vista Pública
1. **Obtener el enlace**: Desde la página de competición, copia el enlace público
2. **Compartir**: Envía el enlace a participantes y espectadores
3. **Acceso directo**: URL tipo: `http://localhost:3000/competitions/status/nombre-competicion`

### Información Mostrada
- **Header**: Nombre de la competición, estado, circuito
- **Estadísticas**: Participantes, rondas, tiempos registrados, progreso
- **Mejor vuelta**: Tiempo más rápido de toda la competición
- **Clasificación**: Tabla ordenada por posición y tiempo total
- **Detalles**: Información individual de cada participante

### Estados de la Competición
- **En Curso**: Muestra progreso y tiempos parciales
- **Finalizada**: Muestra clasificación final y estadísticas completas

## 🖥️ Modo Presentación (Live TV View)

### Características del Modo Presentación
El Modo Presentación es una vista especial diseñada para proyectar competiciones en tiempo real en pantallas grandes, proyectores o televisores.

### Acceso al Modo Presentación
1. **Desde la vista pública**: Haz clic en el botón "Modo Presentación" en la página de estado
2. **URL directa**: `http://localhost:3000/competitions/presentation/nombre-competicion`
3. **Sin autenticación**: Acceso público directo

### Elementos de la Interfaz

#### Header de Competición
- **Nombre de la competición**: Título grande y prominente
- **Información de rondas**: Número total de rondas
- **Categoría**: Si aplica
- **Estado**: Badge con estado actual (En Curso/Finalizada/Pendiente)
- **Circuito**: Nombre del circuito si está configurado

#### Ranking en Vivo
- **Tabla de clasificación**: Ordenada por tiempo total + penalizaciones
- **Columnas**: Posición, Piloto, Vehículo, Tiempo Total, Penalización, Mejor Vuelta
- **Posiciones destacadas**: Oro, plata y bronce con colores especiales
- **Actualización automática**: Cada 10 segundos

#### Mejor Vuelta Destacada
- **Tiempo más rápido**: Visualización prominente del mejor tiempo
- **Información del piloto**: Nombre y equipo
- **Información del vehículo**: Modelo y marca
- **Badge especial**: Indicador visual de "Mejor Vuelta"

#### Grid de Progreso por Rondas
- **Vista de progreso**: Estado de cada participante por ronda
- **Iconos de estado**: 
  - ✅ Completada (verde)
  - ⏳ En progreso (naranja con animación)
  - ⏸️ Pendiente (gris)
- **Tiempos por ronda**: Muestra el tiempo registrado en cada ronda
- **Leyenda**: Explicación de los iconos de estado

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
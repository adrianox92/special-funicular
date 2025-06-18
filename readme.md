# 🏁 Scalextric Collection - Gestión de Competiciones

Una aplicación web completa para gestionar tu colección de coches Scalextric y organizar competiciones de manera profesional.

## ✨ Características Principales

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

### 📊 Análisis y Estadísticas
- **Dashboard interactivo**: Vista general de tu colección
- **Gráficos dinámicos**: Distribución de marcas, inversiones, modificaciones
- **Tendencias temporales**: Evolución de tu colección
- **Métricas de rendimiento**: Análisis de competiciones

### 🌐 Vista Pública de Competiciones
- **Estado en tiempo real**: Seguimiento público del progreso de competiciones
- **Clasificación general**: Ranking actualizado automáticamente
- **Estadísticas detalladas**: Mejores vueltas, tiempos totales, progreso
- **Diseño responsive**: Accesible desde cualquier dispositivo
- **URLs públicas**: Enlaces directos para compartir con espectadores

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

## 🔧 API Endpoints

### Rutas Públicas
- `GET /api/public/:slug` - Información de competición para inscripción
- `GET /api/public/:slug/signup` - Inscripción pública
- `GET /api/public/:slug/status` - Estado público de la competición

### Rutas Protegidas
- `GET /api/competitions/my-competitions` - Mis competiciones
- `POST /api/competitions` - Crear competición
- `GET /api/competitions/:id` - Detalles de competición
- `GET /api/competitions/:id/participants` - Participantes
- `GET /api/competitions/:id/timings` - Tiempos registrados
- `POST /api/competitions/:id/timings` - Registrar tiempo

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

## Nueva regla: Puntos por mejor tiempo por ronda

Ahora es posible añadir una regla de puntuación que otorga puntos adicionales al participante que consiga el mejor tiempo global de cada ronda. Esta regla se puede activar desde la gestión de reglas de la competición, seleccionando el tipo "Mejor tiempo por ronda" y definiendo cuántos puntos extra se otorgan por ronda.

- El sistema sumará estos puntos automáticamente al ranking de la competición.
- Se puede combinar con las reglas de puntuación estándar por ronda y final.

Para más detalles, consulta la sección de reglas en la gestión de competiciones.

---

**¡Disfruta organizando tus competiciones de Scalextric! 🏁**

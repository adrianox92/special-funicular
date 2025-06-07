# Scalextric Collection

Aplicación web para gestionar y mostrar una colección de coches Scalextric. Desarrollada con React y Bootstrap para una experiencia de usuario moderna y responsive.

## Características Implementadas

- 👤 Sistema de autenticación de usuarios:
  - Registro de usuarios
  - Inicio de sesión
  - Gestión de sesiones
  - Protección de rutas
- 📊 Dashboard principal:
  - Total de vehículos en la colección
  - Porcentaje de vehículos modificados
  - Inversión total en componentes
  - Promedio de incremento de precio
  - Vehículo con mayor incremento porcentual
  - Vehículo con mejor tiempo absoluto
- 🤖 Insights con IA:
  - Análisis automático de la colección
  - Generación de insights personalizados
  - Actualización semanal de recomendaciones
  - Sugerencias de mejora basadas en datos
- 🚗 Gestión completa de vehículos (crear, leer, actualizar, eliminar)
- 🖼️ Soporte para imágenes de vehículos
- 🔍 Sistema de filtrado avanzado:
  - Por fabricante
  - Por tipo de vehículo
  - Por estado de modificación
  - Por compatibilidad digital
- 📤 Exportación de datos:
  - Exportación a CSV de la colección completa
  - Incluye especificaciones técnicas y modificaciones
  - Descarga de fichas técnicas en PDF
- 🎨 Interfaz moderna y responsive usando Bootstrap
- 📱 Diseño adaptable a diferentes dispositivos
- 🧭 Navegación intuitiva con barra de navegación
- 💰 Gestión de modificaciones y precios:
  - Registro de componentes modificados
  - Cálculo automático del precio total
  - Visualización del incremento porcentual respecto al precio base
- 🎯 Interfaz mejorada:
  - Efectos hover en las tarjetas de vehículos
  - Visualización clara de precios originales y modificados
  - Indicadores visuales de estado de modificación
- ⏱️ Sistema de registro de tiempos:
  - Registro de vueltas y tiempos por vehículo
  - Cálculo automático de tiempos promedio
  - Filtrado por circuito, carril y fecha
  - Visualización de especificaciones técnicas en el momento del registro
- 📊 Tabla de tiempos general:
  - Ordenación por mejor tiempo
  - Cálculo de diferencias entre tiempos
  - Visualización de especificaciones técnicas históricas
- ✅ Insights con IA:
  - Análisis automático de la colección
  - Generación de insights personalizados
  - Actualización semanal de recomendaciones
  - Sugerencias de mejora basadas en datos

## Tecnologías Utilizadas

- React.js
- Bootstrap 5
- React Router DOM
- Axios para peticiones HTTP
- React Icons
- Supabase (Backend y Base de datos)

## Requisitos Previos

- Node.js (versión 14 o superior)
- npm (incluido con Node.js)
- Cuenta en Supabase (para el backend)

## Instalación

1. Clonar el repositorio:
```bash
git clone [URL_DEL_REPOSITORIO]
```

2. Instalar dependencias:
```bash
cd frontend
npm install
```

3. Configurar variables de entorno:
Crear un archivo `.env` en el directorio `frontend` con las siguientes variables:
```
REACT_APP_SUPABASE_URL=tu_url_de_supabase
REACT_APP_SUPABASE_ANON_KEY=tu_clave_anonima_de_supabase
```

4. Iniciar la aplicación en modo desarrollo:
```bash
npm start
```

La aplicación estará disponible en [http://localhost:3000](http://localhost:3000)

## Manejo Seguro de Variables de Entorno

Es crucial mantener seguras las claves API y otras credenciales. Sigue estas prácticas:

1. **Nunca subas archivos `.env` al repositorio**
   - Los archivos `.env` están incluidos en `.gitignore`
   - Si accidentalmente subiste un archivo `.env`, sigue estos pasos:
     ```bash
     git filter-branch --force --index-filter "git rm --cached --ignore-unmatch backend/.env" --prune-empty --tag-name-filter cat -- --all
     git push origin --force --all
     ```

2. **Usa archivos `.env.example` como plantilla**
   - Crea un archivo `.env.example` con la estructura pero sin valores reales
   - Comparte este archivo con el equipo
   - Los nuevos desarrolladores pueden copiarlo como `.env` y añadir sus valores

3. **Variables de entorno requeridas**
   ```
   # Supabase
   REACT_APP_SUPABASE_URL=tu_url_de_supabase
   REACT_APP_SUPABASE_ANON_KEY=tu_clave_anonima_de_supabase
   
   # OpenAI (para insights)
   OPENAI_API_KEY=tu_clave_de_openai
   ```

4. **Rotación de claves**
   - Si una clave se expone, rótala inmediatamente
   - Notifica al equipo para que actualicen sus archivos `.env`
   - Considera usar un gestor de secretos para entornos de producción

## Manejo de Archivos Grandes

Este proyecto utiliza Git para el control de versiones y tiene algunas consideraciones importantes:

- La carpeta `node_modules` está excluida del control de versiones (ver `.gitignore`)
- Los archivos de caché de desarrollo también están excluidos
- Si necesitas subir archivos grandes (>100MB), se recomienda usar Git LFS (Large File Storage)

Para evitar problemas con archivos grandes:
1. Nunca subas la carpeta `node_modules` al repositorio
2. Si necesitas subir archivos grandes, instala Git LFS:
   ```bash
   git lfs install
   git lfs track "*.pack"  # Para archivos específicos
   git add .gitattributes
   ```

## Scripts Disponibles

- `npm start`: Inicia la aplicación en modo desarrollo
- `npm test`: Ejecuta las pruebas
- `npm run build`: Construye la aplicación para producción
- `npm run eject`: Expulsa la configuración de Create React App

## Estado Actual del Proyecto

El proyecto se encuentra en desarrollo activo con las siguientes características implementadas:

- ✅ Sistema de autenticación de usuarios:
  - Registro e inicio de sesión
  - Protección de rutas
  - Gestión de sesiones
- ✅ Dashboard principal:
  - Métricas generales de la colección
  - Visualización de estadísticas clave
  - Indicadores de rendimiento
- ✅ Sistema de navegación con navbar
- ✅ Listado de vehículos con filtros
- ✅ Formulario de edición de vehículos
- ✅ Gestión de imágenes
- ✅ Interfaz responsive
- ✅ Sistema de modificaciones de vehículos:
  - Registro de componentes modificados
  - Especificaciones técnicas detalladas
  - Precios de componentes
- ✅ Gestión de precios:
  - Precio base del vehículo
  - Precio total con modificaciones
  - Visualización del incremento porcentual
- ✅ Mejoras en la interfaz:
  - Efectos visuales en las tarjetas
  - Indicadores de estado
  - Diseño mejorado de precios y modificaciones
- ✅ Sistema de registro de tiempos:
  - Registro de vueltas y tiempos
  - Cálculo automático de promedios
  - Validación de tiempos coherentes
  - Filtrado por circuito y carril
- ✅ Tabla de tiempos general:
  - Ordenación por mejor tiempo
  - Cálculo de diferencias
  - Visualización de especificaciones técnicas históricas
- ✅ Insights con IA:
  - Análisis automático de la colección
  - Generación de insights personalizados
  - Actualización semanal de recomendaciones
  - Sugerencias de mejora basadas en datos

## Próximas Características

- [ ] Gestión de colecciones personalizadas
- [ ] Estadísticas avanzadas de la colección:
  - [ ] Análisis de tiempos por circuito
  - [ ] Evolución de tiempos por vehículo
  - [ ] Gráficos de evolución de precios
  - [ ] Comparativa de rendimiento por tipo de vehículo
- [ ] Búsqueda avanzada
- [ ] Comparativa de precios entre vehículos similares
- [ ] Gráficos de evolución de tiempos
- [ ] Sistema de competiciones y rankings

## Contribución

Las contribuciones son bienvenidas. Por favor, asegúrate de:

1. Hacer fork del proyecto
2. Crear una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit de tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abrir un Pull Request

## Licencia

Este proyecto está bajo la Licencia MIT - ver el archivo LICENSE para más detalles.

## Dashboard

El dashboard proporciona una visión general de la colección con métricas clave y visualizaciones interactivas.

#### Métricas Principales (Fase 1)
- Total de vehículos en la colección
- Número de vehículos modificados
- Inversión total en componentes
- Promedio de incremento por vehículo
- Mayor incremento de precio
- Mejor tiempo de vuelta

#### Visualizaciones (Fase 2)
- **Gráfico de Barras Horizontales**: Distribución de vehículos por marca
  - Muestra la proporción de cada marca en la colección
  - Ordenado por cantidad de vehículos
  - Etiquetas con cantidad y porcentaje
  - Tooltips detallados
- **Gráfico de Barras Horizontales**: Distribución de vehículos por tienda de compra
  - Visualización de las tiendas donde se han adquirido los vehículos
  - Ordenado por cantidad de vehículos
  - Etiquetas con cantidad y porcentaje
  - Tooltips interactivos
- **Gráfico de Barras Apiladas**: Distribución de vehículos por tipo, mostrando la proporción de vehículos modificados vs. serie para cada tipo.
  - Barras apiladas para mejor comparación visual
  - Tooltips detallados al pasar el ratón
  - Ordenación por total de vehículos
  - Leyenda interactiva
- **Gráfico de Donut**: Proporción de vehículos modificados vs. serie en la colección
  - Visualización clara de la distribución
  - Etiquetas con porcentajes
  - Tooltips interactivos
- **Gráfico de Barras**: Rendimiento por tipo de vehículo
  - Comparativa de tiempos medios por tipo
  - Tooltips con detalles de los mejores tiempos
  - Etiquetas de tiempo formateadas
- **Gráfico de Línea**: Evolución de la inversión en la colección
  - Seguimiento trimestral del valor total
  - Tooltips con detalles de vehículos por trimestre
  - Etiquetas de valor formateadas en euros

#### Insights con IA (Fase 2)
- **Análisis Automático**: Generación de insights personalizados usando GPT-4
  - Análisis de distribución de la colección
  - Recomendaciones de crecimiento
  - Identificación de oportunidades de mejora
  - Actualización semanal automática
  - Cacheo de insights para optimizar costes
  - Integración con métricas existentes

## Gestión de Archivos

### Archivos Excluidos del Control de Versiones

Los siguientes archivos y directorios están excluidos del control de versiones por razones de tamaño y optimización:

- `node_modules/`: Directorio de dependencias de Node.js
- `.cache/`: Archivos de caché de desarrollo
- Archivos de caché específicos:
  - `frontend/node_modules/.cache/`
  - `frontend/.cache/`
  - `**/node_modules/.cache/`
  - `**/.cache/`

Estos archivos son generados automáticamente durante el desarrollo y no deben ser versionados. Para instalar las dependencias necesarias, ejecuta:

```bash
npm install
```

## Tipos de Vehículos

La aplicación soporta los siguientes tipos de vehículos:
- Rally
- GT
- LMP
- Clásico
- DTM
- F1
- Camiones
- Raid

## Tests

### Frontend

Los tests unitarios del frontend se encuentran en la carpeta `frontend/src/__tests__/`. Para ejecutar los tests del frontend:

```bash
cd frontend
npm test
```

#### Estructura de Tests del Frontend

- `pages/Dashboard.test.jsx`: Tests del componente Dashboard
  - Verifica el renderizado correcto del componente
  - Prueba el manejo de estados de carga
  - Verifica el manejo de errores de API
  - Comprueba el formateo correcto de valores monetarios y porcentajes
  - Verifica la actualización de datos

### Backend

Los tests unitarios del backend se encuentran en la carpeta `backend/__tests__/`. Para ejecutar los tests del backend:

```bash
cd backend
npm test
```

#### Estructura de Tests del Backend

- `routes/dashboard.test.js`: Tests de las rutas del Dashboard
  - Prueba el endpoint `/dashboard/metrics`
    - Verifica la obtención correcta de métricas
    - Prueba el manejo de errores de base de datos
  - Prueba el endpoint `/dashboard/charts`
    - Verifica la obtención correcta de datos para gráficos
    - Prueba el manejo de errores de base de datos

### Mocks

Los mocks necesarios para los tests se encuentran en:
- Frontend: Los mocks se definen directamente en los archivos de test
- Backend: `backend/__tests__/mocks/supabase.js`

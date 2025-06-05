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
  - Filtrado avanzado

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
- **Gráfico de Barras Apiladas**: Distribución de vehículos por tipo, mostrando la proporción de vehículos modificados vs. serie para cada tipo.
  - Barras apiladas para mejor comparación visual
  - Tooltips detallados al pasar el ratón
  - Ordenación por total de vehículos
  - Leyenda interactiva

- **Gráfico Circular**: Proporción de vehículos modificados vs. serie.
  - Etiquetas dentro del gráfico para mejor legibilidad
  - Tooltips con información detallada
  - Porcentajes calculados automáticamente
  - Leyenda en la parte inferior

- **Tabla de Costes**: Top 5 vehículos por coste.
  - Ordenación por columnas (precio base, total o incremento)
  - Gráficos de barras para visualizar incrementos
  - Badges para identificar vehículos modificados
  - Formato de moneda y porcentajes
  - Indicadores visuales de incremento (rojo para positivo, gris para negativo)

#### Tecnologías Utilizadas
- **Frontend**:
  - React con React Bootstrap para la interfaz
  - Recharts para visualizaciones interactivas
  - Componentes reutilizables y responsivos
  - Diseño moderno con sombras y efectos hover

- **Backend**:
  - Node.js con Express
  - PostgreSQL para almacenamiento
  - Endpoints optimizados para datos del dashboard
  - Cálculos estadísticos en tiempo real

#### Próximas Mejoras (Fase 3)
- Gráfico de tendencia temporal (sparkline) para evolución de vehículos
- Vista alternativa de Top Rentables (relación tiempo/precio)
- Filtros adicionales para análisis personalizado
- Exportación de datos y reportes

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

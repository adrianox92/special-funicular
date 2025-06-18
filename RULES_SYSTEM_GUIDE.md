# 🏆 Guía del Sistema de Reglas y Plantillas de Competición

Esta guía explica cómo funciona el nuevo sistema de reglas y plantillas para las competiciones de Scalextric.

## 📋 Índice

1. [Conceptos Básicos](#conceptos-básicos)
2. [Tipos de Reglas](#tipos-de-reglas)
3. [Plantillas Predefinidas](#plantillas-predefinidas)
4. [API Endpoints](#api-endpoints)
5. [Ejemplos de Uso](#ejemplos-de-uso)
6. [Configuración de la Base de Datos](#configuración-de-la-base-de-datos)

## 🎯 Conceptos Básicos

### ¿Qué son las Reglas?
Las reglas definen cómo se asignan los puntos en una competición. Cada regla tiene:
- **Tipo**: Define cuándo se aplica (por ronda, final, mejor vuelta)
- **Estructura de puntos**: Define cuántos puntos recibe cada posición
- **Descripción**: Explicación de la regla

### ¿Qué son las Plantillas?
Las plantillas son reglas reutilizables que puedes aplicar a múltiples competiciones. Incluyen:
- **Nombre**: Identificador de la plantilla
- **Descripción**: Explicación del sistema de puntuación
- **Estructura de puntos**: Configuración predefinida
- **Opciones adicionales**: Como bonus por mejor vuelta

## 🎮 Tipos de Reglas

### 1. Por Ronda (`per_round`)
Se aplica al final de cada ronda individual.

**Estructura de puntos:**
```json
{
  "1": 10,  // 1er lugar = 10 puntos
  "2": 8,   // 2do lugar = 8 puntos
  "3": 6,   // 3er lugar = 6 puntos
  "4": 4,   // 4to lugar = 4 puntos
  "5": 2    // 5to lugar = 2 puntos
}
```

### 2. Final (`final`)
Se aplica al final de toda la competición, basándose en el tiempo total acumulado.

**Estructura de puntos:**
```json
{
  "1": 50,  // Ganador = 50 puntos extra
  "2": 30,  // 2do lugar = 30 puntos extra
  "3": 20,  // 3er lugar = 20 puntos extra
  "4": 15,  // 4to lugar = 15 puntos extra
  "5": 10   // 5to lugar = 10 puntos extra
}
```

### 3. Bonus por Mejor Vuelta (`use_bonus_best_lap`)

Este campo es un **boolean** que se aplica a las reglas de tipo `per_round`. Cuando está activado:

- **Funcionamiento**: El participante con la mejor vuelta de cada ronda recibe **1 punto adicional**
- **Aplicación**: Se suma automáticamente a los puntos de posición de la ronda
- **Empates**: Si hay empate en la mejor vuelta, no se otorgan puntos extra
- **Combinación**: Se puede usar junto con cualquier estructura de puntos por ronda

**Ejemplo de uso:**
```json
{
  "rule_type": "per_round",
  "points_structure": {"1": 10, "2": 8, "3": 6},
  "use_bonus_best_lap": true
}
```

En este caso:
- 1º lugar: 10 puntos + 1 punto (si tiene mejor vuelta) = 11 puntos
- 2º lugar: 8 puntos + 1 punto (si tiene mejor vuelta) = 9 puntos
- 3º lugar: 6 puntos + 1 punto (si tiene mejor vuelta) = 7 puntos

## 📚 Plantillas Predefinidas

### Plantillas Disponibles

1. **Sistema Estándar**
   - **Tipo**: Por ronda
   - **Puntos**: 1º=10, 2º=8, 3º=6, 4º=4, 5º=2
   - **Bonus**: No

2. **Sistema F1**
   - **Tipo**: Por ronda
   - **Puntos**: 1º=25, 2º=18, 3º=15, 4º=12, 5º=10, 6º=8, 7º=6, 8º=4, 9º=2, 10º=1
   - **Bonus**: No

3. **Sistema Simple**
   - **Tipo**: Por ronda
   - **Puntos**: 1º=3, 2º=2, 3º=1
   - **Bonus**: No

4. **Sistema con Bonus**
   - **Tipo**: Por ronda
   - **Puntos**: 1º=10, 2º=8, 3º=6, 4º=4, 5º=2
   - **Bonus**: Sí (1 punto por mejor vuelta)

5. **Puntuación Final**
   - **Tipo**: Final
   - **Puntos**: 1º=50, 2º=30, 3º=20, 4º=15, 5º=10
   - **Bonus**: No

6. **Sistema de Eliminación**
   - **Tipo**: Por ronda
   - **Puntos**: 1º=5, 2º=3, 3º=1
   - **Bonus**: No

7. **Sistema Extendido**
   - **Tipo**: Por ronda
   - **Puntos**: 1º=15, 2º=12, 3º=10, 4º=8, 5º=6, 6º=4, 7º=2, 8º=1
   - **Bonus**: No

## 🔌 API Endpoints

### Obtener Plantillas
```http
GET /api/competition-rules/templates
Authorization: Bearer <token>
```

**Respuesta:**
```json
[
  {
    "id": "uuid",
    "name": "Sistema Estándar",
    "description": "Sistema de puntos clásico",
    "rule_type": "per_round",
    "points_structure": {"1": 10, "2": 8, "3": 6, "4": 4, "5": 2},
    "is_template": true,
    "use_bonus_best_lap": false,
    "created_at": "2024-01-01T00:00:00Z"
  }
]
```

### Obtener Reglas de una Competición
```http
GET /api/competition-rules/competition/{competitionId}
Authorization: Bearer <token>
```

### Crear Nueva Regla o Plantilla
```http
POST /api/competition-rules
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Mi Plantilla Personalizada",
  "description": "Sistema personalizado para mi competición",
  "rule_type": "per_round",
  "points_structure": {"1": 15, "2": 12, "3": 10, "4": 8, "5": 6},
  "is_template": true,
  "use_bonus_best_lap": true
}
```

### Aplicar Plantilla a Competición
```http
POST /api/competition-rules/apply-template/{templateId}
Authorization: Bearer <token>
Content-Type: application/json

{
  "competition_id": "uuid-de-la-competicion"
}
```

### Editar Regla
```http
PUT /api/competition-rules/{ruleId}
Authorization: Bearer <token>
Content-Type: application/json

{
  "description": "Descripción actualizada",
  "points_structure": {"1": 20, "2": 15, "3": 10}
}
```

### Eliminar Regla
```http
DELETE /api/competition-rules/{ruleId}
Authorization: Bearer <token>
```

## 💡 Ejemplos de Uso

### Ejemplo 1: Crear una Competición con Sistema F1

1. **Obtener plantilla F1:**
```bash
curl -X GET "http://localhost:5001/api/competition-rules/templates" \
  -H "Authorization: Bearer <token>"
```

2. **Aplicar plantilla a la competición:**
```bash
curl -X POST "http://localhost:5001/api/competition-rules/apply-template/{template-id}" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"competition_id": "uuid-de-competicion"}'
```

### Ejemplo 2: Crear Plantilla Personalizada

```bash
curl -X POST "http://localhost:5001/api/competition-rules" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Sistema de Eliminación Progresiva",
    "description": "Solo puntúan los primeros 5, con bonus por mejor vuelta",
    "rule_type": "per_round",
    "points_structure": {"1": 10, "2": 8, "3": 6, "4": 4, "5": 2},
    "is_template": true,
    "use_bonus_best_lap": true
  }'
```

### Ejemplo 3: Combinar Múltiples Reglas

Para una competición completa, puedes aplicar varias reglas:

1. **Regla por ronda** (puntos por posición en cada ronda)
2. **Regla de mejor vuelta** (bonus por mejor tiempo)
3. **Regla final** (bonus para el ganador general)

```bash
# Aplicar regla por ronda
curl -X POST "http://localhost:5001/api/competition-rules/apply-template/{template-per-round}" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"competition_id": "uuid-de-competicion"}'

# Aplicar regla de mejor vuelta
curl -X POST "http://localhost:5001/api/competition-rules/apply-template/{template-best-lap}" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"competition_id": "uuid-de-competicion"}'

# Aplicar regla final
curl -X POST "http://localhost:5001/api/competition-rules/apply-template/{template-final}" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"competition_id": "uuid-de-competicion"}'
```

## 🗄️ Configuración de la Base de Datos

### Campos Nuevos en `competition_rules`

```sql
ALTER TABLE competition_rules
ADD COLUMN is_template boolean NOT NULL DEFAULT false,
ADD COLUMN created_by uuid REFERENCES auth.users(id),
ADD COLUMN use_bonus_best_lap boolean DEFAULT false,
ADD COLUMN name text;
```

### Ejecutar Migración

```bash
cd backend
node scripts/migrate-insert-templates.js
```

## 🔧 Consideraciones Técnicas

### Validaciones
- Las plantillas requieren un nombre
- Las reglas de competición requieren un `competition_id`
- Solo el creador puede editar/eliminar plantillas
- Solo el organizador puede editar/eliminar reglas de competición

### Seguridad
- Todas las rutas están protegidas con autenticación JWT
- Verificación de permisos por usuario
- Validación de datos de entrada

### Rendimiento
- Las consultas están optimizadas con índices
- Paginación disponible para listas grandes
- Caché de plantillas frecuentemente usadas

## 🚀 Próximas Funcionalidades

- [ ] Editor visual de reglas
- [ ] Plantillas por categoría de vehículo
- [ ] Reglas condicionales
- [ ] Exportación/importación de plantillas
- [ ] Estadísticas de uso de plantillas
- [ ] Sistema de versionado de reglas

---

**¡Disfruta configurando tus competiciones con el nuevo sistema de reglas! 🏁** 
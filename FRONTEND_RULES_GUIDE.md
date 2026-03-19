# FASE 2 - Frontend: Editor Visual de Reglas

Esta guía documenta la implementación del frontend para el sistema de reglas y plantillas de competición.

## Componentes Implementados

### 1. CompetitionRulesPanel.jsx
**Vista principal** que reemplaza al antiguo `CompetitionRules.jsx`

#### Características:
- **Carga reglas específicas** de la competición (`/api/competition-rules/competition/:competitionId`)
- **Botón "Aplicar Plantilla"** que abre el drawer de plantillas
- **Botón "Nueva Regla"** que abre el modal de creación/edición
- **Lista visual** de reglas activas con badges de tipo y bonus
- **Validación de tiempos registrados** - deshabilita edición si hay tiempos
- **Gestión de errores** y estados de carga

#### Props:
```jsx
<CompetitionRulesPanel
  competitionId={competitionId}
  onRuleChange={() => {}}
/>
```

### 2. RuleFormModal.jsx
**Modal para crear/editar reglas** con formulario completo

#### Características:
- **Formulario dinámico** según el tipo de regla seleccionado
- **Editor visual de puntos** con inputs para cada posición
- **Validaciones en tiempo real** de campos requeridos
- **Soporte para bonus** por mejor vuelta
- **Estados de guardado** con spinner y mensajes de error

#### Props:
```jsx
<RuleFormModal
  show={showModal}
  onHide={() => setShowModal(false)}
  rule={editingRule} // null para crear nueva
  competitionId={competitionId}
  onSave={() => {}}
  disabled={timesRegistered > 0}
/>
```

### 3. TemplatesDrawer.jsx
**Drawer lateral** para mostrar y aplicar plantillas

#### Características:
- **Lista de plantillas** con búsqueda en tiempo real
- **Vista previa** de la estructura de puntos de cada plantilla
- **Botón "Aplicar"** que clona la plantilla a la competición
- **Información educativa** sobre qué son las plantillas
- **Estados de aplicación** con spinner

#### Props:
```jsx
<TemplatesDrawer
  show={showDrawer}
  onHide={() => setShowDrawer(false)}
  competitionId={competitionId}
  onTemplateApplied={() => {}}
  disabled={timesRegistered > 0}
/>
```

##  Flujo de Trabajo

### 1. Ver Reglas Existentes
```
Usuario → CompetitionParticipants → Tab "Reglas" → CompetitionRulesPanel
→ Carga reglas de /api/competition-rules/competition/:id
→ Muestra lista con badges de tipo y bonus
```

### 2. Aplicar Plantilla
```
Usuario → Botón "Aplicar Plantilla" → TemplatesDrawer
→ Carga plantillas de /api/competition-rules/templates
→ Usuario selecciona plantilla → Botón "Aplicar"
→ POST /api/competition-rules/apply-template/:id
→ Regla clonada y asociada a la competición
```

### 3. Crear Nueva Regla
```
Usuario → Botón "Nueva Regla" → RuleFormModal
→ Usuario completa formulario → Botón "Crear"
→ POST /api/competition-rules
→ Regla creada y asociada a la competición
```

### 4. Editar Regla Existente
```
Usuario → Botón "Editar" en regla → RuleFormModal
→ Usuario modifica formulario → Botón "Actualizar"
→ PUT /api/competition-rules/:id
→ Regla actualizada
```

### 5. Eliminar Regla
```
Usuario → Botón "Eliminar" en regla → Confirmación
→ DELETE /api/competition-rules/:id
→ Regla eliminada
```

##  Características de UX

### Validaciones de Seguridad
- **Tiempos registrados**: Si hay tiempos, se deshabilitan todas las acciones de edición
- **Confirmaciones**: Eliminación requiere confirmación explícita
- **Estados de carga**: Spinners y mensajes durante operaciones

### Feedback Visual
- **Badges de tipo**: Colores diferentes para cada tipo de regla
- **Badge de bonus**: Indica si la regla incluye bonus por mejor vuelta
- **Estructura de puntos**: Muestra claramente los puntos por posición
- **Estados de error**: Alertas rojas para errores de validación

### Navegación Intuitiva
- **Tabs organizados**: Reglas en pestaña separada
- **Drawer lateral**: Plantillas en panel deslizable
- **Modales centrados**: Formularios en ventanas modales
- **Botones contextuales**: Acciones cerca del contenido relevante

##  Integración con Backend

### Endpoints Utilizados
```javascript
// Cargar reglas de la competición
GET /api/competition-rules/competition/:competitionId

// Cargar plantillas disponibles
GET /api/competition-rules/templates

// Crear nueva regla
POST /api/competition-rules

// Actualizar regla existente
PUT /api/competition-rules/:id

// Eliminar regla
DELETE /api/competition-rules/:id

// Aplicar plantilla
POST /api/competition-rules/apply-template/:templateId
```

### Estructura de Datos
```javascript
// Regla de competición
{
  id: "uuid",
  competition_id: "uuid",
  rule_type: "per_round" | "final" | "best_time_per_round",
  description: "string",
  points_structure: {
    "1": 10,
    "2": 8,
    "3": 6
  },
  is_template: false,
  use_bonus_best_lap: true,
  created_by: "uuid",
  created_at: "timestamp"
}

// Plantilla
{
  id: "uuid",
  name: "Sistema F1",
  description: "Sistema inspirado en Fórmula 1",
  rule_type: "per_round",
  points_structure: {
    "1": 25,
    "2": 18,
    "3": 15
  },
  is_template: true,
  use_bonus_best_lap: false,
  created_by: "uuid",
  created_at: "timestamp"
}
```

##  Estilos y Diseño

### Colores de Badges
- **Por ronda**: `primary` (azul)
- **Final**: `success` (verde)

### Iconos Utilizados
- **Trophy**: Para reglas y plantillas
- **Magic**: Para aplicar plantillas
- **Copy**: Para aplicar plantilla
- **Cog**: Para indicar bonus
- **Plus**: Para crear nueva regla
- **Edit**: Para editar regla
- **Trash**: Para eliminar regla

##  Próximas Mejoras

### Funcionalidades Planificadas
- [ ] **Editor visual de puntos**: Drag & drop para reordenar posiciones
- [ ] **Vista previa**: Simulación de cómo se aplicarían los puntos
- [ ] **Plantillas personalizadas**: Crear y guardar plantillas propias
- [ ] **Importar/exportar**: Compartir reglas entre competiciones
- [ ] **Historial de cambios**: Versiones de reglas modificadas

### Mejoras de UX
- [ ] **Tutorial interactivo**: Guía para nuevos usuarios
- [ ] **Sugerencias inteligentes**: Recomendaciones de plantillas
- [ ] **Búsqueda avanzada**: Filtros por tipo y características
- [ ] **Accesibilidad**: Mejoras para lectores de pantalla

##  Testing

### Casos de Prueba Principales
1. **Crear regla desde cero** - Todos los tipos de regla
2. **Aplicar plantilla** - Verificar clonación correcta
3. **Editar regla existente** - Modificar puntos y descripción
4. **Eliminar regla** - Confirmación y actualización
5. **Validaciones** - Campos requeridos y formatos
6. **Estados de error** - Manejo de errores de red
7. **Tiempos registrados** - Deshabilitación de edición

### Herramientas de Testing
- **React Testing Library** para componentes
- **Jest** para unit tests
- **Cypress** para e2e tests
- **Storybook** para desarrollo de componentes

---

**¡El sistema de reglas está listo para usar!**
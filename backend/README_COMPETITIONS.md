# Backend - Gestión de Competiciones

## Estructura de Base de Datos

### Tabla `competitions`
```sql
CREATE TABLE public.competitions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  organizer uuid NULL,
  num_slots integer NOT NULL,
  created_at timestamp with time zone NULL DEFAULT now(),
  rounds integer NOT NULL DEFAULT 1,
  circuit_name text NULL,
  CONSTRAINT competitions_pkey PRIMARY KEY (id),
  CONSTRAINT competitions_organizer_fkey FOREIGN KEY (organizer) REFERENCES auth.users (id) ON DELETE CASCADE,
  CONSTRAINT competitions_num_slots_check CHECK ((num_slots > 0)),
  CONSTRAINT competitions_rounds_check CHECK ((rounds > 0))
);
```

### Tabla `competition_participants`
```sql
CREATE TABLE public.competition_participants (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  competition_id uuid NULL,
  vehicle_id uuid NULL,
  driver_name text NOT NULL,
  vehicle_model text NULL,
  registered_by uuid NULL,
  created_at timestamp with time zone NULL DEFAULT now(),
  CONSTRAINT competition_participants_pkey PRIMARY KEY (id),
  CONSTRAINT competition_participants_competition_id_fkey FOREIGN KEY (competition_id) REFERENCES competitions (id) ON DELETE CASCADE,
  CONSTRAINT competition_participants_registered_by_fkey FOREIGN KEY (registered_by) REFERENCES auth.users (id) ON DELETE SET NULL,
  CONSTRAINT competition_participants_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES vehicles (id) ON DELETE SET NULL,
  CONSTRAINT only_one_vehicle_source CHECK (
    (
      (
        (vehicle_id IS NOT NULL)
        AND (vehicle_model IS NULL)
      )
      OR (
        (vehicle_id IS NULL)
        AND (vehicle_model IS NOT NULL)
      )
    )
  )
);
```

##  API Endpoints

### Competiciones

#### `POST /api/competitions`
Crear una nueva competición
```json
{
  "name": "Competición de Prueba",
  "num_slots": 8,
  "rounds": 3,
  "circuit_name": "Circuito de Barcelona"
}
```

#### `GET /api/competitions/my-competitions`
Obtener todas las competiciones del usuario organizador

#### `GET /api/competitions/:id`
Obtener una competición específica con sus participantes

#### `PUT /api/competitions/:id`
Actualizar una competición
```json
{
  "name": "Nuevo nombre",
  "num_slots": 10,
  "rounds": 5,
  "circuit_name": "Nuevo circuito"
}
```

#### `DELETE /api/competitions/:id`
Eliminar una competición

### Participantes

#### `POST /api/competitions/:id/participants`
Añadir un participante a una competición

**Para vehículo de la colección:**
```json
{
  "vehicle_id": "uuid-del-vehiculo",
  "driver_name": "Nombre del Piloto"
}
```

**Para vehículo externo:**
```json
{
  "vehicle_model": "Modelo del vehículo",
  "driver_name": "Nombre del Piloto"
}
```

#### `GET /api/competitions/:id/participants`
Obtener todos los participantes de una competición

#### `PUT /api/competitions/:id/participants/:participantId`
Actualizar un participante

#### `DELETE /api/competitions/:id/participants/:participantId`
Eliminar un participante

### Vehículos para Competiciones

#### `GET /api/competitions/vehicles`
Obtener vehículos del usuario para seleccionar en competiciones

### Inscripciones de miembros (JWT)

#### `POST /api/competitions/:id/signups`

Un usuario autenticado (típicamente miembro del club) solicita plaza en una
competición. El cuerpo admite uno u otro campo para el vehículo:

```json
{
  "category_id": "uuid-categoría",
  "vehicle_id": "uuid-vehículo-del-miembro",   // vehículo de SU colección
  "name": "Nombre opcional"
}
```

o bien:

```json
{
  "category_id": "uuid-categoría",
  "vehicle": "Modelo escrito a mano",
  "name": "Nombre opcional"
}
```

Si se envía `vehicle_id`, el backend verifica que pertenece al usuario
autenticado. Si no se envía `vehicle`, se genera automáticamente un texto
descriptivo con el fabricante/modelo del vehículo seleccionado.

#### `POST /api/competitions/:id/signups/:signupId/approve`

Convierte la solicitud en participante oficial. Prioridad del vehículo asignado:

1. `vehicle_id` explícito enviado por el organizador (sustituye la elección del miembro).
2. `vehicle_model` explícito enviado por el organizador (texto libre).
3. `signup.vehicle_id` si el miembro había elegido uno de su colección.
4. `signup.vehicle` (texto libre introducido por el miembro).

El organizador no necesita asignar un vehículo de su propia colección cuando el
miembro ya ha elegido uno: basta con llamar al endpoint sin cuerpo.

### Clubes (JWT `Authorization: Bearer …`)

Base: `/api/clubs`. Requiere el mismo middleware de usuario que el resto de la API.

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/clubs` | Crear club (`name`, opcional `license_installations_max`) |
| `GET` | `/api/clubs/mine` | Lista de clubs del usuario (propietario o miembro) |
| `GET` | `/api/clubs/:id` | Detalle (solo miembros) |
| `GET` | `/api/clubs/:id/members` | Miembros |
| `POST` | `/api/clubs/:id/invite` | Invitación (`expires_in_days` opcional); respuesta incluye `join_url` |
| `POST` | `/api/clubs/join/:token` | Unirse con token |
| `DELETE` | `/api/clubs/:id/members/:userId` | Abandonar (`userId` = yo) o expulsar (admin) |

Al crear o editar competición en la web se puede enviar `club_id` opcional (organizador debe ser miembro).

### Sincronización de competiciones (API key `X-API-Key`)

Montado bajo **`/api/sync`** junto al resto de sync; el middleware resuelve `req.user` desde la clave de sincronización.

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/sync/competitions` | Competiciones del usuario (organizador) y de sus clubs |
| `GET` | `/api/sync/competitions/:id` | Detalle: participantes, categorías, reglas, timings |
| `POST` | `/api/sync/competitions` | Crear competición con UUID opcional `id`, `club_id`, `circuit_id`, etc. |
| `PUT` | `/api/sync/competitions/:id` | Parche metadatos / `external_status` (`DRAFT`/`RUNNING`/`FINISHED`); conflicto si `updated_at` cliente &lt; servidor |
| `POST` | `/api/sync/competitions/:id/participants` | `{ "participants": [{ "id"?, "driver_name", "vehicle_id"?, "vehicle_model"? }] }` |
| `POST` | `/api/sync/competitions/:id/timings` | `{ "timings": [{ "participant_id", "round_number", "best_lap_time", "total_time", "laps", … }] }` formato `mm:ss.mmm`; *media* derivada de `total_time` y `laps` |

**Mapeo rondas (web) ↔ mangas (Slot Race Manager)** — ver también comentario en el cliente `ds200-manager` `src/core/syncService.js`:

- **Simultáneo:** suele usarse **1 manga = 1 ronda** (`heat_number` → `round_number`).
- **Rally:** muchas mangas (pilotos × carriles); `competitions.rounds` en la web debe ser coherente con el plan de mangas; si `round_number` supera `rounds`, la API rechaza el timing.

### Licencia modo club

`POST /api/license/register` acepta `club_id` opcional: el cupo de instalaciones activas usa `clubs.license_installations_max` y filtra filas en `app_installations` por ese club. Ver `backend/routes/license.js`.

##  Validaciones

### Crear Competición
-  Nombre requerido y no vacío
-  Número de plazas > 0
-  Número de rondas > 0
-  Circuito opcional

### Añadir Participante
-  Nombre del piloto requerido
-  Solo una fuente de vehículo (colección O externo)
-  Vehículo de colección debe existir y pertenecer al usuario
-  No exceder número de plazas disponibles

### Actualizar Competición
-  No reducir plazas por debajo de participantes actuales
-  No reducir rondas si ya hay tiempos registrados
-  Validaciones de campos individuales

##  Seguridad

-  Autenticación requerida en todos los endpoints (excepto `/test`)
-  Verificación de propiedad de competiciones
-  Verificación de propiedad de vehículos
-  Validación de permisos de usuario

##  Notas de Implementación

1. **Middleware de Autenticación**: Todas las rutas usan el middleware de Supabase
2. **Cascada de Eliminación**: Al eliminar una competición, se eliminan automáticamente todos los participantes
3. **Validación de Vehículos**: Los vehículos externos y de colección son mutuamente excluyentes
4. **Conteo de Participantes**: Se incluye automáticamente en las consultas de competiciones

##  Flujo de Trabajo

1. **Crear Competición** → `POST /api/competitions`
2. **Añadir Participantes** → `POST /api/competitions/:id/participants`
3. **Gestionar Tiempos** → Endpoints de timing (implementados en otro archivo)
4. **Ver Resultados** → Endpoints de progreso y estadísticas 
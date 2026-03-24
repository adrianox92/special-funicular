# API de Sincronización - Guía de Integración

Documentación para conectar proyectos externos (por ejemplo, una app de gestión de tiempos de circuito) con Scalextric Collection.

## Requisitos previos

1. **Cuenta de usuario** en Scalextric Collection
2. **API Key** generada desde tu perfil

---

## 1. Obtener tu API Key

### Opción A: Desde la interfaz web

1. Inicia sesión en Scalextric Collection
2. Ve a **Mi Perfil** (menú de usuario → Perfil)
3. En la sección "API Key", verás tu clave
4. Haz clic en **Copiar** para copiarla al portapapeles
5. Si necesitas regenerarla (la anterior dejará de funcionar), usa **Regenerar**

### Opción B: Mediante API (con JWT)

Si ya tienes un token JWT de sesión:

```http
GET /api/api-keys/me
Authorization: Bearer <tu_jwt_token>
```

**Respuesta:**

```json
{
  "api_key": "sc_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "created_at": "2025-03-13T12:00:00.000Z"
}
```

Si no tienes API key, se crea automáticamente en esta petición.

### Opción C: Login con credenciales para obtener API Key

Para aplicaciones externas que no tienen JWT, puedes obtener la API key enviando email y contraseña. Este endpoint es **público** (CORS permisivo) para permitir llamadas desde cualquier origen.

```http
POST /api/auth/api-key
Content-Type: application/json

{
  "email": "tu@email.com",
  "password": "tu_contraseña"
}
```

**Respuesta 200:**

```json
{
  "api_key": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "created_at": "2025-03-16T12:00:00.000Z"
}
```

Si el usuario no tiene API key, se crea automáticamente. Errores: `400` (campos faltantes), `401` (credenciales inválidas).

---

## 2. Base URL


| Entorno    | URL base                                                             |
| ---------- | -------------------------------------------------------------------- |
| Local      | `http://localhost:5001`                                              |
| Producción | `https://tu-dominio.com` (o la URL donde esté desplegado tu backend) |


---

## 3. Autenticación

Todas las peticiones a los endpoints de sincronización requieren el header:

```
X-API-Key: <tu_api_key>
```

**Importante:** El header es case-insensitive (`x-api-key` también funciona).

---

## 4. Endpoints disponibles

### 4.1 Listar vehículos

Obtiene la lista de vehículos del usuario autenticado.

```http
GET /api/sync/vehicles?page=1&limit=25
X-API-Key: <tu_api_key>
```

**Query parameters:**


| Parámetro | Tipo   | Default | Descripción          |
| --------- | ------ | ------- | -------------------- |
| `page`    | number | 1       | Número de página     |
| `limit`   | number | 25      | Vehículos por página |


**Respuesta 200:**

```json
{
  "vehicles": [
    {
      "id": "uuid-del-vehiculo",
      "model": "Ferrari 488",
      "manufacturer": "Scalextric",
      "type": "GT",
      "traction": "RWD",
      "image": "https://...url-imagen.../image.jpg"
    }
  ],
  "pagination": {
    "total": 42,
    "page": 1,
    "limit": 25,
    "totalPages": 2
  }
}
```

**Errores:**

- `401` - No se proporcionó API key o es inválida
- `500` - Error interno del servidor

---

### 4.2 Listar circuitos

Obtiene la lista de circuitos del usuario autenticado. Útil para que una app externa conozca los IDs de circuitos antes de enviar un tiempo, y así poder usar `circuit_id` directamente en vez de un nombre de texto.

```http
GET /api/sync/circuits
X-API-Key: <tu_api_key>
```

**Respuesta 200:**

```json
{
  "circuits": [
    {
      "id": "uuid-del-circuito",
      "name": "Circuito Barcelona",
      "description": "Circuito de 2 carriles",
      "num_lanes": 2,
      "lane_lengths": [12.5, 13.0]
    }
  ]
}
```

**Errores:**

- `401` - No se proporcionó API key o es inválida
- `500` - Error interno del servidor

---

### 4.3 Registrar tiempo

Crea un nuevo registro de tiempo para un vehículo.

```http
POST /api/sync/timings
X-API-Key: <tu_api_key>
Content-Type: application/json

{
  "vehicle_id": "uuid-del-vehiculo",
  "best_lap_time": "01:23.456",
  "total_time": "05:12.345",
  "laps": 4,
  "average_time": "01:18.086",
  "lane": "1",
  "circuit": "Circuito Barcelona",
  "circuit_id": "uuid-del-circuito",
  "timing_date": "2025-03-13"
}
```

**Campos del body:**


| Campo           | Tipo          | Requerido | Descripción                                                    |
| --------------- | ------------- | --------- | -------------------------------------------------------------- |
| `vehicle_id`    | string (UUID) | Sí         | ID del vehículo (debe pertenecer al usuario)                   |
| `best_lap_time` | string        | Sí         | Mejor vuelta en formato `mm:ss.mmm`                            |
| `total_time`    | string        | Sí         | Tiempo total en formato `mm:ss.mmm`                            |
| `laps`          | number        | Sí         | Número de vueltas                                              |
| `average_time`  | string        | Sí         | Tiempo promedio por vuelta en formato `mm:ss.mmm`              |
| `lane`          | string        | No         | Número de carril (ej: "1", "2")                                |
| `circuit`       | string        | No         | Nombre del circuito (si no existe, se crea automáticamente)    |
| `circuit_id`    | string (UUID) | No         | ID del circuito (prioridad sobre `circuit` si ambos se envían) |
| `timing_date`   | string        | No         | Fecha en formato `YYYY-MM-DD` (default: hoy)                   |
| `best_lap_timestamp` | number | No | Mejor vuelta en segundos (float) |
| `total_time_timestamp` | number | No | Tiempo total en segundos (float) |
| `average_time_timestamp` | number | No | Tiempo promedio en segundos (float) |
| `scale_factor` | number | No | Escala del coche para velocidad equivalente (32 = 1:32). Si no se envía, se usa el del vehículo |
| `lap_times` | array | No | Array de vueltas individuales. Cada elemento: `{ lap_number?, time_seconds|lap_time_seconds, time_text? }`. Si se envía con ≥3 vueltas válidas, se calcula `consistency_score` y `worst_lap_timestamp` |


**Resolución de circuito:**

- `**circuit_id`** (prioridad): Si se envía, el backend verifica que pertenezca al usuario. Si es válido, el timing se guarda con ese circuito.
- `**circuit**` (nombre): Si se envía y no hay `circuit_id`, el backend busca un circuito con ese nombre para el usuario. Si existe, lo usa. Si no existe, lo crea automáticamente con `num_lanes=1` y `lane_lengths=[]`.
- **Ambos**: `circuit_id` tiene prioridad; `circuit` se ignora para la resolución.
- **Ninguno**: El timing se guarda sin circuito asociado.

**Formato de tiempos:** `mm:ss.mmm` (ejemplo: `01:23.456` = 1 min 23.456 seg)

**Cálculo automático:** Si el circuito tiene `lane_lengths` y se especifica `lane`, el backend calcula automáticamente: `total_distance_meters`, `avg_speed_kmh`, `avg_speed_scale_kmh`, `best_lap_speed_kmh`, `best_lap_speed_scale_kmh`. La velocidad escala es la equivalente a tamaño real (ej: 7.8 km/h en pista × 32 = 250 km/h para 1:32).

**Vueltas individuales (lap_times):** Si envías `lap_times` con al menos 3 vueltas válidas (`time_seconds` > 0), el backend almacena cada vuelta en `timing_laps` y calcula `consistency_score` (coeficiente de variación, menor = más consistente) y `worst_lap_timestamp` (tiempo de la peor vuelta en segundos). Ejemplo: `"lap_times": [{ "lap_number": 1, "time_seconds": 12.5 }, { "lap_number": 2, "time_seconds": 12.3 }, ... ]`

**Respuesta 201:**

```json
{
  "id": "uuid-del-timing",
  "vehicle_id": "uuid-del-vehiculo",
  "best_lap_time": "01:23.456",
  "total_time": "05:12.345",
  "laps": 4,
  "average_time": "01:18.086",
  "lane": "1",
  "circuit": "Circuito Barcelona",
  "timing_date": "2025-03-13",
  "setup_snapshot": "[...]",
  "created_at": "2025-03-13T12:00:00.000Z",
  "total_distance_meters": 52.0,
  "avg_speed_kmh": 7.8,
  "avg_speed_scale_kmh": 249.6,
  "best_lap_speed_kmh": 8.2,
  "best_lap_speed_scale_kmh": 262.4,
  "consistency_score": 4.2,
  "worst_lap_timestamp": 12.8
}
```

**Errores:**

- `400` - Campos requeridos faltantes
- `401` - API key inválida
- `404` - Vehículo no encontrado, o circuito no encontrado (si se envió `circuit_id` inválido)
- `500` - Error interno del servidor

**Notificaciones push:** Si el usuario activó Web Push en **Mi Perfil** y el servidor tiene claves VAPID configuradas, al registrar aquí un tiempo que **mejore** su mejor vuelta previa (mismo `vehicle_id`, `circuit_id`, `lane` y `laps`) puede recibir una notificación en el navegador. También es posible un aviso al **subir posiciones** en el ranking del circuito. Requiere `circuit_id` en el timing para la lógica de récord personal. Detalles: tabla `push_subscriptions`, variables `VAPID_*` y sección *Notificaciones push* en el readme del repositorio.

---

## 5. Endpoint find-or-create (JWT)

Para integraciones que usan autenticación JWT (no API key), existe un endpoint para buscar o crear un circuito por nombre:

```http
POST /api/circuits/find-or-create
Authorization: Bearer <tu_jwt_token>
Content-Type: application/json

{
  "name": "Circuito Barcelona",
  "description": "Opcional",
  "num_lanes": 2,
  "lane_lengths": [12.5, 13.0]
}
```

**Respuesta 200 (encontrado):** `{ "circuit": { ... }, "created": false }`  
**Respuesta 200 (creado):** `{ "circuit": { ... }, "created": true }`

---

## 6. Ejemplos de integración

### JavaScript / Fetch

```javascript
const API_BASE = 'http://localhost:5001';  // o tu URL de producción
const API_KEY = 'sc_tu_api_key_aqui';

// Listar circuitos (para usar circuit_id en createTiming)
async function getCircuits() {
  const res = await fetch(`${API_BASE}/api/sync/circuits`, {
    headers: { 'X-API-Key': API_KEY },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// Listar vehículos
async function getVehicles(page = 1, limit = 25) {
  const res = await fetch(
    `${API_BASE}/api/sync/vehicles?page=${page}&limit=${limit}`,
    {
      headers: { 'X-API-Key': API_KEY },
    }
  );
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// Registrar tiempo
async function createTiming(data) {
  const res = await fetch(`${API_BASE}/api/sync/timings`, {
    method: 'POST',
    headers: {
      'X-API-Key': API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// Uso: con circuit_id (opción recomendada si ya conoces circuitos)
const { circuits } = await getCircuits();
const circuit = circuits.find(c => c.name === 'Mi circuito');
await createTiming({
  vehicle_id: (await getVehicles()).vehicles[0].id,
  best_lap_time: '01:23.456',
  total_time: '05:12.345',
  laps: 4,
  average_time: '01:18.086',
  lane: '1',
  circuit_id: circuit?.id,  // o circuit: 'Mi circuito' si no existe en la lista
});

// Uso: con nombre de circuito (find-or-create automático)
await createTiming({
  vehicle_id: (await getVehicles()).vehicles[0].id,
  best_lap_time: '01:23.456',
  total_time: '05:12.345',
  laps: 4,
  average_time: '01:18.086',
  lane: '1',
  circuit: 'Mi circuito',
});
```

### Python

```python
import requests

API_BASE = "http://localhost:5001"
API_KEY = "sc_tu_api_key_aqui"

headers = {"X-API-Key": API_KEY}

# Listar vehículos
r = requests.get(f"{API_BASE}/api/sync/vehicles", headers=headers)
vehicles = r.json()

# Registrar tiempo
data = {
    "vehicle_id": vehicles["vehicles"][0]["id"],
    "best_lap_time": "01:23.456",
    "total_time": "05:12.345",
    "laps": 4,
    "average_time": "01:18.086",
    "lane": "1",
    "circuit": "Mi circuito",
}
r = requests.post(f"{API_BASE}/api/sync/timings", json=data, headers=headers)
timing = r.json()
```

### cURL

```bash
# Listar vehículos
curl -H "X-API-Key: sc_tu_api_key_aqui" \
  "http://localhost:5001/api/sync/vehicles?page=1&limit=25"

# Registrar tiempo
curl -X POST \
  -H "X-API-Key: sc_tu_api_key_aqui" \
  -H "Content-Type: application/json" \
  -d '{"vehicle_id":"uuid","best_lap_time":"01:23.456","total_time":"05:12.345","laps":4,"average_time":"01:18.086"}' \
  "http://localhost:5001/api/sync/timings"
```

---

## 7. CORS

Las rutas `/api/sync/*` y `POST /api/auth/api-key` tienen **CORS permisivo**: aceptan peticiones desde cualquier origen. La seguridad se garantiza mediante la API key (`X-API-Key`) o las credenciales (email/password en el login para API key), por lo que no necesitas configurar orígenes adicionales para tu aplicación externa.

---

## 8. Seguridad

- **No compartas tu API key** en código público o repositorios

---

## 9. Error: `relation "public.circuits" does not exist`

Si ves este error, la tabla `circuits` no existe en tu base de datos. Ejecuta en **Supabase SQL Editor** el contenido de `backend/scripts/create-circuits-table.sql`:

```sql
CREATE TABLE IF NOT EXISTS public.circuits (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name       text NOT NULL,
  description text,
  num_lanes  integer NOT NULL DEFAULT 1,
  lane_lengths jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz DEFAULT now(),
  CONSTRAINT circuits_user_id_name_unique UNIQUE (user_id, name)
);
CREATE INDEX IF NOT EXISTS idx_circuits_user_id ON public.circuits(user_id);
CREATE INDEX IF NOT EXISTS idx_circuits_name ON public.circuits(name);
ALTER TABLE public.circuits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own circuits" ON public.circuits FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own circuits" ON public.circuits FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own circuits" ON public.circuits FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own circuits" ON public.circuits FOR DELETE USING (auth.uid() = user_id);
```

Si ya tienes datos con circuitos en texto (`vehicle_timings.circuit`, `competitions.circuit_name`, `competition_timings.circuit`), ejecuta también:

1. `backend/scripts/migrate-circuit-references.sql` – añade la columna `circuit_id`
2. `backend/scripts/populate-circuit-id-from-text.sql` – crea circuitos y rellena `circuit_id` desde el texto

- Usa variables de entorno para almacenar la API key
- Si crees que la key ha sido comprometida, regenérala desde tu perfil

---

## Resumen rápido


| Qué necesitas | Dónde obtenerlo                                                                                     |
| ------------- | --------------------------------------------------------------------------------------------------- |
| API Key       | Perfil → sección API Key, `GET /api/api-keys/me` (JWT), o `POST /api/auth/api-key` (email/password) |
| Base URL      | `http://localhost:5001` (dev) o tu URL de producción                                                |
| Header        | `X-API-Key: <tu_api_key>`                                                                           |



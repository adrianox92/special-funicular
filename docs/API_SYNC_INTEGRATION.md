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

---

## 2. Base URL

| Entorno | URL base |
|---------|----------|
| Local | `http://localhost:5001` |
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

| Parámetro | Tipo | Default | Descripción |
|-----------|------|---------|-------------|
| `page` | number | 1 | Número de página |
| `limit` | number | 25 | Vehículos por página |

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

### 4.2 Registrar tiempo

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
  "timing_date": "2025-03-13"
}
```

**Campos del body:**

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `vehicle_id` | string (UUID) | ✅ | ID del vehículo (debe pertenecer al usuario) |
| `best_lap_time` | string | ✅ | Mejor vuelta en formato `mm:ss.mmm` |
| `total_time` | string | ✅ | Tiempo total en formato `mm:ss.mmm` |
| `laps` | number | ✅ | Número de vueltas |
| `average_time` | string | ✅ | Tiempo promedio por vuelta en formato `mm:ss.mmm` |
| `lane` | string | ❌ | Número de carril (ej: "1", "2") |
| `circuit` | string | ❌ | Nombre del circuito |
| `timing_date` | string | ❌ | Fecha en formato `YYYY-MM-DD` (default: hoy) |
| `best_lap_timestamp` | number | ❌ | Mejor vuelta en segundos (float) |
| `total_time_timestamp` | number | ❌ | Tiempo total en segundos (float) |
| `average_time_timestamp` | number | ❌ | Tiempo promedio en segundos (float) |

**Formato de tiempos:** `mm:ss.mmm` (ejemplo: `01:23.456` = 1 min 23.456 seg)

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
  "created_at": "2025-03-13T12:00:00.000Z"
}
```

**Errores:**
- `400` - Campos requeridos faltantes
- `401` - API key inválida
- `404` - Vehículo no encontrado (o no pertenece al usuario)
- `500` - Error interno del servidor

---

## 5. Ejemplos de integración

### JavaScript / Fetch

```javascript
const API_BASE = 'http://localhost:5001';  // o tu URL de producción
const API_KEY = 'sc_tu_api_key_aqui';

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

// Uso
const { vehicles } = await getVehicles();
await createTiming({
  vehicle_id: vehicles[0].id,
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

## 6. CORS

Las rutas `/api/sync/*` tienen **CORS permisivo**: aceptan peticiones desde cualquier origen. La seguridad se garantiza mediante la API key (`X-API-Key`), por lo que no necesitas configurar orígenes adicionales para tu aplicación externa.

---

## 7. Seguridad

- **No compartas tu API key** en código público o repositorios
- Usa variables de entorno para almacenar la API key
- Si crees que la key ha sido comprometida, regenérala desde tu perfil

---

## Resumen rápido

| Qué necesitas | Dónde obtenerlo |
|---------------|-----------------|
| API Key | Perfil → sección API Key (o `GET /api/api-keys/me` con JWT) |
| Base URL | `http://localhost:5001` (dev) o tu URL de producción |
| Header | `X-API-Key: <tu_api_key>` |

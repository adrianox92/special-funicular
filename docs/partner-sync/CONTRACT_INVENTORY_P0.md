# Inventario de contrato P0 — Partner Sync (`/api/sync/*`)

**Estado:** kickoff P0 (PRD Partner Sync API v1, D0)  
**Fecha:** 2026-09-24  
**Alcance:** congelar lo que usan los dos clientes de producción, **sin cambiar** runtime, paths, headers ni campos required.  
**Público:** este documento es **interno**. No citar los nombres de cliente en Developers / Swagger / marketing (D13). Marca pública: **Slot Database API**.

| Cliente interno | GitHub (referencia) | Alias en producto |
|-----------------|---------------------|-------------------|
| **SlotLapTimer** | `adrianox92/SlotLapTimer` | Slot Lap Counter / Slot Lap Timer |
| **ds200-manager** | `adrianox92/ds200-manager` | DS-200 Manager / Slot Race Manager |

---

## 0. Cómo se construyó este inventario

Fuentes, en orden:

1. Validadores y handlers de **este repo**: `backend/routes/sync.js`, `backend/routes/syncCompetitions.js`, `backend/lib/vehicleTimingInsert.js`, `backend/lib/clubGuestMembers.js`, `backend/lib/clientApp.js`, `backend/middleware/apiKeyAuth.js`.
2. Guía interna `docs/API_SYNC_INTEGRATION.md` (parcial: solo garaje; omite club y competitions).
3. Comentarios de producto en este repo que **atribuyen** un path a un cliente (p. ej. guest timings → Slot Lap Timer; competitions sync → Slot Race Manager).
4. Intento de lectura **read-only** de los repos cliente con `gh` / GitHub API (2026-09-24).

### 0.1 Acceso a código cliente — resultado

| Repo | Resultado |
|------|-----------|
| `adrianox92/SlotLapTimer` | `404 Not Found` (`gh api repos/…`, `list_commits`, code search) |
| `adrianox92/ds200-manager` | `404 Not Found` (mismo conjunto) |
| `gh repo list adrianox92` | Solo repos **públicos**; ninguno de los dos aparece |

El token de esta sesión no puede leer esos repos (privados o no visibles). **No se modificó ningún cliente.** Los payloads de abajo son el **mínimo que el servidor acepta hoy** + lo que este monorepo atribuye a cada app. Donde el código cliente no se pudo ver, el grado es **U** (unknown) y hace falta captura en vivo.

### 0.2 Grados de evidencia

| Grado | Significado |
|-------|-------------|
| **A** | Comentario o ruta en *este* repo atribuye el endpoint a ese cliente |
| **B** | UI / copy de este repo describe que esa app consume el campo o el flujo |
| **C** | Inferido del contrato `/api/sync` compartido (el cliente *puede* llamarlo; no hay prueba en fuente) |
| **U** | El código cliente no muestra la llamada; hace falta captura HAR / log de escritorio |

Si cliente y servidor discrepan, **se documenta la discrepancia**. No se “arregla” el cliente ni se cambia el handler.

---

## 1. Auth común (as-built)

**Header de sync (único required):**

```
X-API-Key: <api_key de usuario>
```

- Middleware: `backend/middleware/apiKeyAuth.js` lee `req.headers['x-api-key']` (HTTP es case-insensitive; `X-API-Key` y `x-api-key` son el mismo header).
- **No** se acepta Bearer JWT en `/api/sync/*` (salvo `POST /api/sync/test-notification`, que es JWT web y **no** es contrato partner).
- **No** hay header `Authorization` required en sync.
- Error sin key: `401` `{ "error": "No se proporcionó API key. Usa el header X-API-Key." }`
- Error key inválida: `401` `{ "error": "API key inválida o expirada" }`

**Headers aditivos (opcionales, no required):**

| Header | Valores conocidos | Efecto |
|--------|-------------------|--------|
| `X-Client-App` | `lap-timer`, `slot-race-manager` (también snake_case) | `recorded_from` en `POST /api/sync/timings` (`backend/lib/clientApp.js`) |
| `X-Client-Version` | string libre | Solo telemetría / contexto; no cambia validación |
| `Content-Type` | `application/json` | Bodies POST/PUT |

**Bootstrap de key (fuera de `/api/sync`, usado por apps de escritorio):**

- Perfil web (copiar / regenerar).
- `POST /api/auth/api-key` `{ email, password }` — copy de Slot Race Manager: “cada piloto inicia sesión con correo y contraseña desde la app”.
- `GET /api/api-keys/me` (JWT) — no es el camino típico de las apps nativas.

**No observado en sync:** `Authorization: Bearer`, API keys de club, `Idempotency-Key` (Should P6 / D15).

---

## 2. SlotLapTimer — contrato observado / inferido

**Modo principal:** personal / casa (key del piloto) + club admin para invitados.  
**Header de cliente esperado (si lo envían):** `X-Client-App: lap-timer` → `recorded_from = lap_timer`. **U** si la app lo manda de verdad.

### 2.1 Endpoints

| Método | Path | Evidencia | ¿Lo usa? | Fixture |
|--------|------|-----------|----------|---------|
| `GET` | `/api/sync/vehicles` | C — picker de `vehicle_id` (deep link web envía `vehicle_id`) | Probable | `slotlaptimer/get-vehicles.json` |
| `GET` | `/api/sync/circuits` | C — deep link / baseline usan `circuit_id` | Probable | `slotlaptimer/get-circuits.json` |
| `POST` | `/api/sync/circuits` | C — find-or-create; **no** está en `API_SYNC_INTEGRATION.md` | Posible | `slotlaptimer/post-circuits.json` |
| `POST` | `/api/sync/timings` | **A/B** — contrato garaje + guided + `sync_meta`; copy “entrenamiento guiado” | **Sí (crítico)** | `slotlaptimer/post-timings-garage.json`, `slotlaptimer/post-timings-guided.json` |
| `GET` | `/api/sync/timings` | **A** — `vehicles.js`: “misma lógica que GET /api/sync/timings en Lap Timer” | **Sí (crítico)** | `slotlaptimer/get-timings-baseline.json` |
| `GET` | `/api/sync/clubs/admin` | C — necesario para modo club | Posible | `slotlaptimer/get-clubs-admin.json` |
| `GET` | `/api/sync/clubs/:id/circuits` | C — guest timing exige `circuit_id` de club | Posible | `slotlaptimer/get-club-circuits.json` |
| `GET` | `/api/sync/clubs/:id/guest-members` | C — roster de invitados | Posible | `slotlaptimer/get-guest-members.json` |
| `POST` | `/api/sync/clubs/:id/guest-members/:guestId/timings` | **A** — comentario en `sync.js`: “desde Slot Lap Timer” | **Sí (crítico)** | `slotlaptimer/post-guest-timings.json` |
| `GET` | `/api/sync/competitions/:id` | **B** — UI: `laps_per_round` / `round_stages` “Slot Lap Timer fijará ese número de vueltas” | Probable (lectura) | `slotlaptimer/get-competition-detail.json` |
| `POST` | `/api/sync/competitions/:id/timings` | C/U — el handler de copia personal etiqueta `recorded_from: 'lap_timer'`, pero el archivo se titula Slot Race Manager | **Conflicto — ver §5** | *(no se atribuye como crítico de este cliente)* |
| `GET` | `/api/sync/clubs/:id/members` | — | **No existe** (hueco D10) | — |

### 2.2 Bodies mínimos (críticos)

**`POST /api/sync/timings` (garaje)** — required servidor (`insertVehicleTimingFromSyncBody`):

```json
{
  "vehicle_id": "<uuid>",
  "best_lap_time": "00:12.345",
  "total_time": "02:03.210",
  "laps": 10,
  "average_time": "00:12.321"
}
```

Opcionales que la app **probablemente** envía (grado B/C: deep link + guided + laps individuales):

- `circuit_id` (prioridad sobre `circuit`)
- `lane` (string, p. ej. `"1"`)
- `timing_date` (`YYYY-MM-DD`)
- `best_lap_timestamp` / `total_time_timestamp` / `average_time_timestamp` (segundos float)
- `session_type`: `HEAT` \| `TRAINING`
- `lap_times`: `[{ "lap_number"?, "time_seconds"|"lap_time_seconds", "time_text"? }]` (también camelCase)
- `guided_session`: `{ baseline_lap_seconds, target_improvement_ms, laps_on_target, total_laps?, best_improvement_ms? }` o campos planos / camelCase
- `supply_voltage_volts` / `voltage`
- `reaction_time_ms` / `reactionTime` / `reactionTimeMs`
- `scale_factor`, `recorded_from`

**`GET /api/sync/timings`** — query required: `vehicle_id`. Opcional: `circuit_id`, `lane`, `limit` (1–100, default 25).  
Sin `vehicle_id` → `400` `{ "error": "vehicle_id es requerido" }`.

**`POST .../guest-members/:guestId/timings`** — required: `circuit_id`, `best_lap_time`.  
Opcional: `vehicle_id` (rellena `vehicle_model`/`vehicle_type` si faltan), `laps`, `lane`, `timing_date`, `best_lap_timestamp`, `consistency_score`, `notes`.  
**No** exige `total_time` ni `average_time` (discrepa del POST de garaje).

### 2.3 Campos de respuesta de los que depende (inferido)

| Path | Campos que no se pueden quitar / renombrar sin romper (stable) |
|------|----------------------------------------------------------------|
| `GET /vehicles` | `vehicles[]`: `id`, `model`, `manufacturer`, `type`, `traction`, `image`; `pagination.{total,page,limit,totalPages}` |
| `GET /circuits` | `circuits[]`: `id`, `name`, `description`, `num_lanes`, `lane_lengths` |
| `POST /circuits` | objeto circuito plano (`id`, `name`, …); status `200` existente / `201` creado — **no** `{ circuit, created }` |
| `POST /timings` | fila `vehicle_timings` + `sync_meta.{previous_best_lap_seconds, delta_vs_pb_seconds, is_personal_best}`; status `201` |
| `GET /timings` | `timings[]`: `id`, `vehicle_id`, `best_lap_time`, `best_lap_timestamp`, `lane`, `circuit_id`, `circuit`, `timing_date`, `laps`; `meta.{rawCount,filteredCount,laneFallback}` |
| `GET /clubs/admin` | `clubs[]`: `id`, `name`, `slug` |
| `GET /clubs/:id/circuits` | `circuits[]` (mismos campos de circuito) |
| `GET .../guest-members` | `guest_members[]`: `id`, `club_id`, `name`, `email`, `linked_user_id`, `created_at`, `linked_user_email` |
| `POST .../guest-members/.../timings` | fila `club_guest_timings` (`id`, `club_id`, `guest_member_id`, `circuit_id`, `best_lap_time`, …); status `201` |
| `GET /competitions/:id` | `laps_per_round`, `rounds`, `circuit_id`, `circuit_name`, `round_stages[]` (`round_number`, `circuit_id`, `laps_per_round`) — **B** |

### 2.4 Huecos / unknown (hace falta captura live)

- ¿Envían `X-Client-App` / `X-Client-Version`?
- ¿Usan `circuit_id` o solo `circuit` (nombre, find-or-create)?
- ¿Mandan `lap_times` y con qué alias (`time_seconds` vs `lap_time_seconds` vs camelCase)?
- ¿El body guided va anidado o plano?
- ¿Llaman `POST /circuits` o resuelven el circuito solo al crear el timing?
- ¿Leen `GET /competitions/:id` o solo reciben `laps_per_round` embebido en otro payload / deep link?
- ¿Empujan timings de manga a `POST /competitions/:id/timings` o solo a garaje + guests?
- Paginación real de `GET /vehicles` (`limit`).
- Formato exacto de `lane` (`"1"` vs `1`).
- Si consumen `sync_meta` o ignoran campos extra (aditivo es seguro; quitar `sync_meta` no está demostrado como breaking, pero el POST lo añade siempre).

---

## 3. ds200-manager — contrato observado / inferido

**Modo principal:** club / estación + competiciones (Rally / Simultáneo). Alias interno en servidor: **Slot Race Manager**.  
**Header de cliente esperado (si lo envían):** `X-Client-App: slot-race-manager`. **U**.

El servidor apunta explícitamente al fichero cliente `ds200-manager/src/core/syncService.js` (`backend/README_COMPETITIONS.md`). Ese fichero **no se pudo leer** aquí.

Copy de `SlotRaceManagerPage.jsx` (grado B):

- Cada piloto obtiene acceso con email+password desde el escritorio → `POST /api/auth/api-key`.
- Coches locales se emparejan con vehículos de la cuenta → `GET /api/sync/vehicles`.
- Se envían **mangas y entrenamientos** con detalle de cada vuelta.
- Cola offline: reintento posterior (misma forma de body).

### 3.1 Endpoints

| Método | Path | Evidencia | ¿Lo usa? | Fixture |
|--------|------|-----------|----------|---------|
| `GET` | `/api/sync/vehicles` | **B** — emparejar coches locales | **Sí** | `ds200-manager/get-vehicles.json` |
| `GET` | `/api/sync/circuits` | C — `circuit_id` en create/update competition | Probable | `ds200-manager/get-circuits.json` |
| `POST` | `/api/sync/timings` | **B** — “entrenamientos” a la cuenta | Probable (crítico si el copy es cierto) | `ds200-manager/post-timings-training.json` |
| `GET` | `/api/sync/competitions` | **A** — `syncCompetitions.js` “para Slot Race Manager” | **Sí** | `ds200-manager/get-competitions.json` |
| `POST` | `/api/sync/competitions` | **A** | **Sí (crítico)** | `ds200-manager/post-competition.json` |
| `GET` | `/api/sync/competitions/:id` | **A** | **Sí** | `ds200-manager/get-competition-detail.json` |
| `PUT` | `/api/sync/competitions/:id` | **A** — `external_status` DRAFT/RUNNING/FINISHED; `updated_at` 409 | **Sí (crítico)** | `ds200-manager/put-competition.json` |
| `GET` | `/api/sync/competitions/:id/progress` | **A** | Probable | `ds200-manager/get-competition-progress.json` |
| `POST` | `/api/sync/competitions/:id/participants` | **A** | **Sí (crítico)** | `ds200-manager/post-participants.json` |
| `POST` | `/api/sync/competitions/:id/timings` | **A** + mapeo `heat_number` → `round_number` | **Sí (crítico)** | `ds200-manager/post-competition-timings.json` |
| `GET` | `/api/sync/clubs/admin` | C — copy “modo club” + `club_id` en create | Posible | `ds200-manager/get-clubs-admin.json` |
| `GET` | `/api/sync/clubs/:id/guest-members` | C/U | Unknown | — |
| `GET` | `/api/sync/clubs/:id/members` | — | **No existe** (D10) | — |

**Adyacente (no `/api/sync`, no fixture P0):** `POST /api/license/register` `{ installation_id, label?, club_id? }` con `X-API-Key` — licencia Slot Race Manager.

### 3.2 Bodies mínimos (críticos)

**`POST /api/sync/competitions`** — express-validator:

```json
{
  "name": "Copa club",
  "num_slots": 8,
  "rounds": 4
}
```

Opcional: `id` (UUID cliente), `club_id`, `circuit_id`, `circuit_name`, `laps_per_round`.

**`PUT /api/sync/competitions/:id`** — todos opcionales: `name`, `num_slots`, `rounds`, `circuit_id`, `circuit_name`, `external_status` ∈ `DRAFT|RUNNING|FINISHED`, `status` ∈ `closed`, `laps_per_round`, `updated_at`.  
Si `updated_at` cliente < servidor → `409` `{ "error": "conflict", "message": "…" }`.

**`POST /api/sync/competitions/:id/participants`:**

```json
{
  "participants": [
    { "driver_name": "Ada", "vehicle_id": "<uuid>" },
    { "driver_name": "Bob", "vehicle_model": "Externo" }
  ]
}
```

Reglas: `driver_name` required; **solo uno** de `vehicle_id` o `vehicle_model` (si ninguno → servidor pone `vehicle_model: "Externo"`); `id?` UUID; `start_order?`.  
`vehicle_id` debe ser del **dueño de la API key** (no del piloto remoto).

**`POST /api/sync/competitions/:id/timings`:**

```json
{
  "timings": [
    {
      "participant_id": "<uuid>",
      "round_number": 1,
      "best_lap_time": "00:08.210",
      "total_time": "01:22.100",
      "laps": 10
    }
  ]
}
```

- `average_time` **no** es required: el servidor la **deriva** de `total_time` + `laps` (`mm:ss.mmm` estricto `/^(\d{2}):(\d{2})\.(\d{3})$/`).
- `round_number` no puede superar `competitions.rounds` (Rally: el plan de mangas debe caber).
- Mapeo documentado: `heat_number` (cliente) → `round_number` (API). El body **aceptado** usa `round_number`, no `heat_number`.
- Opcional: `lane`, `driver`, `timing_date`, timestamps, `setup_snapshot`, `circuit`, `circuit_id`, `penalty_seconds`, `lap_times`.
- Respuesta `201`: `{ "created": [...], "updated": [...] }` (upsert por `participant_id` + `round_number`).

**`POST /api/sync/timings` (entrenamiento personal, si el copy es cierto):** mismo required que SlotLapTimer. Fixture con `session_type: "TRAINING"` y `X-Client-App: slot-race-manager`.

### 3.3 Campos de respuesta de los que depende (inferido)

| Path | Stable (no quitar / renombrar) |
|------|--------------------------------|
| `GET /competitions` | `{ competitions: [...] }` + `id`, `name`, `rounds`, `num_slots`, `club_id`, `circuit_id`, `circuit_name`, `laps_per_round`, `external_status`, `participants_count` |
| `POST /competitions` | fila competición (`id`, `public_slug`, `organizer`, …); `201` |
| `GET /competitions/:id` | competición + `participants`, `categories`, `rules`, `timings`, `round_stages` |
| `PUT /competitions/:id` | fila actualizada; `409` en conflicto |
| `GET .../progress` | `competition_id`, `participants_count`, `rounds`, `times_registered`, `total_required_times`, `times_remaining`, `is_completed`, `progress_percentage`, `times_by_round`, `participant_stats`, `category_rankings` |
| `POST .../participants` | `{ participants: [...] }` con `id`, `driver_name`, `vehicle_id` / `vehicle_model`, `start_order`; `201` |
| `POST .../timings` | `{ created, updated }`; `201` |

### 3.4 Huecos / unknown

- Contenido real de `src/core/syncService.js` (mapeo heat/round, cola offline, retries).
- ¿Un solo API key de admin o N keys (una por piloto) como dice el copy de marketing? El copy y D8 (1 key de admin) **discrepan a nivel producto**; el runtime actual es 1 key = 1 user.
- ¿Crean la competición en la app (`POST`) o solo hacen pull de una creada en la web (`GET`)?
- ¿Envían `id` cliente (UUID) para idempotencia informal?
- ¿Usan `updated_at` en el PUT?
- ¿Mandan `lap_times` en timings de manga?
- ¿`lane` string vs number?
- ¿Llaman progress o calculan ranking en local?
- Club paths: ¿usan `club_id` en create o solo organizer personal?

---

## 4. Mapeo cliente → path → fixture

Raíz: `tests/fixtures/partner-sync/`  
Índice: `tests/fixtures/partner-sync/manifest.json`

| Cliente | Path crítico | Fixture |
|---------|--------------|---------|
| SlotLapTimer | `GET /api/sync/vehicles` | `slotlaptimer/get-vehicles.json` |
| SlotLapTimer | `GET /api/sync/circuits` | `slotlaptimer/get-circuits.json` |
| SlotLapTimer | `POST /api/sync/circuits` | `slotlaptimer/post-circuits.json` |
| SlotLapTimer | `GET /api/sync/timings` | `slotlaptimer/get-timings-baseline.json` |
| SlotLapTimer | `POST /api/sync/timings` (mínimo) | `slotlaptimer/post-timings-garage.json` |
| SlotLapTimer | `POST /api/sync/timings` (guided + laps) | `slotlaptimer/post-timings-guided.json` |
| SlotLapTimer | `GET /api/sync/clubs/admin` | `slotlaptimer/get-clubs-admin.json` |
| SlotLapTimer | `GET /api/sync/clubs/:id/circuits` | `slotlaptimer/get-club-circuits.json` |
| SlotLapTimer | `GET /api/sync/clubs/:id/guest-members` | `slotlaptimer/get-guest-members.json` |
| SlotLapTimer | `POST /api/sync/clubs/:id/guest-members/:guestId/timings` | `slotlaptimer/post-guest-timings.json` |
| SlotLapTimer | `GET /api/sync/competitions/:id` | `slotlaptimer/get-competition-detail.json` |
| ds200-manager | `GET /api/sync/vehicles` | `ds200-manager/get-vehicles.json` |
| ds200-manager | `GET /api/sync/circuits` | `ds200-manager/get-circuits.json` |
| ds200-manager | `POST /api/sync/timings` (training) | `ds200-manager/post-timings-training.json` |
| ds200-manager | `GET /api/sync/competitions` | `ds200-manager/get-competitions.json` |
| ds200-manager | `POST /api/sync/competitions` | `ds200-manager/post-competition.json` |
| ds200-manager | `GET /api/sync/competitions/:id` | `ds200-manager/get-competition-detail.json` |
| ds200-manager | `PUT /api/sync/competitions/:id` | `ds200-manager/put-competition.json` |
| ds200-manager | `GET /api/sync/competitions/:id/progress` | `ds200-manager/get-competition-progress.json` |
| ds200-manager | `POST /api/sync/competitions/:id/participants` | `ds200-manager/post-participants.json` |
| ds200-manager | `POST /api/sync/competitions/:id/timings` | `ds200-manager/post-competition-timings.json` |
| ds200-manager | `GET /api/sync/clubs/admin` | `ds200-manager/get-clubs-admin.json` |
| ambos | `401` sin `X-API-Key` | `shared/unauthorized-missing-key.json` |

Smoke local (sin prod): `backend/__tests__/partner-sync/contractFixtures.test.js`  
Checklist live: `docs/partner-sync/SMOKE_CHECKLIST.md`

---

## 5. Discrepancias (no se “arreglan” en P0)

1. **`docs/API_SYNC_INTEGRATION.md` vs runtime:** la guía solo documenta vehicles / circuits GET / timings POST. El runtime también expone `POST /circuits`, `GET /timings` (con `vehicle_id` **required**), clubes y competitions. La guía **no** es la fuente de verdad completa.
2. **`POST /api/sync/circuits` vs JWT `POST /api/circuits/find-or-create`:** sync devuelve el **objeto circuito** y `200`/`201`. JWT devuelve `{ circuit, created }`. Un cliente que espere el wrapper JWT en sync fallaría. **U** si algún cliente lo espera.
3. **`POST /api/sync/timings` response:** la guía no lista `sync_meta`; el handler **siempre** lo añade. Aditivo → no breaking. No quitar.
4. **`average_time`:** required en garaje; **derivado** (y no accepted-as-source) en timings de competición. Un cliente que reutilice el mismo body en ambos paths no puede omitir `average_time` en garaje.
5. **Guest timings vs garaje:** guest no pide `total_time` / `average_time` / `vehicle_id`; sí pide `circuit_id`.
6. **Atribución de competitions:** `syncCompetitions.js` se documenta para Slot Race Manager; la copia a historial personal usa `recorded_from: 'lap_timer'` hardcoded; la UI de vueltas por ronda habla de Slot Lap Timer. **Tres historias distintas sobre el mismo path.** Hasta captura live: SlotLapTimer = lector de `laps_per_round` (B); ds200-manager = escritor de competitions/timings (A).
7. **`heat_number` vs `round_number`:** el comentario de `ds200-manager` habla de mapear `heat_number` → `round_number`. El validador **solo** acepta `round_number`. Si el cliente enviara `heat_number` sin mapear, la API respondería `400` (express-validator). Se asume que el cliente ya mapea; **no se añade alias**.
8. **1 key vs N keys:** marketing de Slot Race Manager (“cada piloto vincula su cuenta”) vs D8 (1 key de admin). Runtime = 1 key = 1 `user_id`. `vehicle_id` de participante debe ser del dueño de la key, lo que choca con “N garajes” si solo hay 1 key de estación. Documentado; no se cambia.
9. **D10:** `GET /api/sync/clubs/:id/members` **no está implementado**. Equivalente JWT: `GET /api/clubs/:id/members`. P1.
10. **Formato de tiempos:** competitions exigen `mm:ss.mmm` estricto para derivar media. Garaje no revalida el string con esa regex (solo “truthy”). Un cliente que mande `"8.21"` puede pasar garaje y fallar competitions.

---

## 6. Contrato servidor congelado (allowlist P0)

Nada de esto se elimina ni se hace required si hoy es optional.

**Garaje:** `GET /vehicles`, `GET|POST /circuits`, `GET|POST /timings`  
**Club:** `GET /clubs/admin`, `GET /clubs/:id/circuits`, `GET /clubs/:id/guest-members`, `POST /clubs/:id/guest-members/:guestId/timings`  
**Competitions:** `GET|POST /competitions`, `GET|PUT /competitions/:id`, `GET /competitions/:id/progress`, `POST /competitions/:id/participants`, `POST /competitions/:id/timings`

**Fuera de P0 (no implementar aquí):** OpenAPI, Swagger, Developers, D10 members, idempotency, key de club.

---

## 7. Qué capturar en las apps de escritorio (cierre de U)

Para cada cliente, un HAR o log de una sesión real:

1. Headers exactos (`X-API-Key`, ¿`X-Client-App`?, ¿otros?).
2. Cada `GET/POST/PUT` bajo `/api/sync` (method + path + query).
3. Body JSON crudo de `POST /timings`, `POST .../guest-members/.../timings`, `POST /competitions`, `POST .../participants`, `POST .../timings`.
4. Primeras claves que leen de la respuesta (no hace falta el JSON entero).
5. Un fallo 4xx (key mala, vehicle 404, round fuera de rango) para ver si parsean `{ error }` o `{ errors }`.

Hasta esa captura, las fixtures son **golden del servidor** (mínimo aceptado + shape de respuesta), no un dump de producción.

---

## 8. Nota P1 (stub, no implementar)

- OpenAPI 3 del allowlist §6.
- `GET /api/sync/clubs/:id/members` (D10) — **no existe**; no inventar fixture 200.
- No citar SlotLapTimer / ds200-manager en copy público.

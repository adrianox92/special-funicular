# Inventario de contrato P0 — Partner Sync (`/api/sync/*`)

**Estado:** P0 con evidencia **A** de fuente cliente (2026-09-24)  
**Alcance:** congelar lo que usan los dos clientes de producción, **sin cambiar** runtime, paths, headers ni campos required.  
**Público:** este documento es **interno**. No citar los nombres de cliente en Developers / Swagger / marketing (D13). Marca pública: **Slot Database API**.

| Cliente interno | GitHub (referencia) | Fuente cliente | Alias en producto |
|-----------------|---------------------|----------------|-------------------|
| **SlotLapTimer** | `adrianox92/SlotLapTimer` | `src/services/api.ts` | Slot Lap Counter / Slot Lap Timer |
| **ds200-manager** | `adrianox92/ds200-manager` | `src/core/syncService.js` | DS-200 Manager / Slot Race Manager |

---

## 0. Cómo se construyó este inventario

Fuentes, en orden:

1. **Fuente cliente (2026-09-24)** — `SlotLapTimer/src/services/api.ts` y `ds200-manager/src/core/syncService.js` (lectura humana; el token de este agente sigue sin 404-access a esos repos).
2. Validadores y handlers de **este repo**: `backend/routes/sync.js`, `backend/routes/syncCompetitions.js`, `backend/lib/vehicleTimingInsert.js`, `backend/lib/clubGuestMembers.js`, `backend/lib/clientApp.js`, `backend/middleware/apiKeyAuth.js`.
3. Guía interna `docs/API_SYNC_INTEGRATION.md` (parcial: solo garaje).

**No se modificó ningún cliente ni ningún handler de sync.**

### 0.1 Grados de evidencia

| Grado | Significado |
|-------|-------------|
| **A** | La llamada / el header / el body aparece en fuente cliente (`api.ts` o `syncService.js`) |
| **B** | UI / copy de este monorepo describe el flujo, sin línea de cliente |
| **C** | Inferido del contrato `/api/sync` compartido |
| **U** | No aparece en la fuente actual; haría falta HAR de un build más viejo o de prod |

Si cliente y servidor discrepan, **se documenta**. No se “arregla” el cliente ni se cambia el handler.

---

## 1. Auth — verdades de header (A)

**Required en servidor (ambos):** `X-API-Key`.

| Header | SlotLapTimer (`api.ts`) | ds200-manager (`syncService.js`) | Servidor |
|--------|-------------------------|----------------------------------|----------|
| `X-API-Key` | **Sí, en cada sync** | **Sí** | Required. Sin él → `401` |
| `Content-Type: application/json` | **Sí, en cada sync** | **Sí** | Bodies POST/PUT |
| `X-Client-App` | **`lap-timer`** (confirmado) | **No lo envía** | Opcional. Mapea a `recorded_from` |
| `X-Client-Version` | **`<APP_VERSION>`** (nombre exacto `X-Client-Version`) | **No lo envía** | Opcional; no valida |

- Middleware: `req.headers['x-api-key']` (case-insensitive).
- **No** Bearer JWT en `/api/sync/*` (salvo `POST /api/sync/test-notification`, JWT web, no partner).
- Error sin key: `401` `{ "error": "No se proporcionó API key. Usa el header X-API-Key." }`
- Error key inválida: `401` `{ "error": "API key inválida o expirada" }`

**D15 (aditivo, no lo envían los clientes actuales):**

- `Idempotency-Key` — opcional en POST/PUT. Sin header = semántica actual.
- `429` + `Retry-After` — rate limit por API key (default 600/min). Los clientes actuales no lo manejan; el techo es alto a propósito.
- Varias keys personales + key de club: mismos header `X-API-Key` y paths. Una key de club no abre garaje personal.

**Bootstrap de key (fuera de `/api/sync`):**

- SlotLapTimer: key de Perfil (no confirmado un login email/password en `api.ts` para sync).
- ds200-manager: login con credenciales → `api_key` (**A**, `POST /api/auth/api-key`).

**Consecuencia D0:** un `POST /timings` de ds200-manager **no** lleva `X-Client-App`, así que `recorded_from` cae en el default del servidor (`web`) salvo que el body mande `recorded_from`. No se añade el header en el cliente desde este PR.

---

## 2. SlotLapTimer — `src/services/api.ts` (A)

**Modo:** personal / casa + club invitados + **escritura de timings de competición** (no solo lectura).  
Headers en cada llamada: `X-API-Key`, `Content-Type: application/json`, `X-Client-App: lap-timer`, `X-Client-Version: <APP_VERSION>`.

### 2.1 Endpoints

| Método | Path | Evidencia | ¿Lo usa? | Fixture |
|--------|------|-----------|----------|---------|
| `GET` | `/api/sync/vehicles` | **A** | Sí | `slotlaptimer/get-vehicles.json` |
| `GET` | `/api/sync/circuits` | **A** | Sí | `slotlaptimer/get-circuits.json` |
| `POST` | `/api/sync/circuits` | **A** | Sí | `slotlaptimer/post-circuits.json` |
| `POST` | `/api/sync/timings` | **A** — `TimingPayload` | **Sí (crítico)** | `slotlaptimer/post-timings-garage.json`, `post-timings-guided.json` |
| `GET` | `/api/sync/timings` | **A** — query `vehicle_id&circuit_id&lane&limit&session_type` | **Sí (crítico)** | `slotlaptimer/get-timings-baseline.json` |
| `GET` | `/api/sync/clubs/admin` | **A** | Sí | `slotlaptimer/get-clubs-admin.json` |
| `GET` | `/api/sync/clubs/:id/circuits` | **A** | Sí | `slotlaptimer/get-club-circuits.json` |
| `GET` | `/api/sync/clubs/:id/guest-members` | **A** | Sí | `slotlaptimer/get-guest-members.json` |
| `POST` | `/api/sync/clubs/:id/guest-members/:guestId/timings` | **A** — `GuestMemberTimingPayload` | **Sí (crítico)** | `slotlaptimer/post-guest-timings.json` |
| `GET` | `/api/sync/competitions` | **A** | Sí | `slotlaptimer/get-competitions.json` |
| `GET` | `/api/sync/competitions/:id` | **A** | Sí | `slotlaptimer/get-competition-detail.json` |
| `GET` | `/api/sync/competitions/:id/progress` | **A** | Sí | `slotlaptimer/get-competition-progress.json` |
| `POST` | `/api/sync/competitions/:id/timings` | **A** — `{ timings: CompetitionTimingPayload[] }` | **Sí (crítico)** | `slotlaptimer/post-competition-timings.json` |
| `PUT` | `/api/sync/competitions/:id` | **A** — `{ external_status, status? }` | Sí | `slotlaptimer/put-competition.json` |
| `GET` | `/api/sync/clubs/:id/members` | — | **P1 D10** (`backend/routes/sync.js`) | — |

Paths en cliente a veces se escriben `/sync/...`; el mount real es `/api/sync/...`.

### 2.2 Bodies (A)

**`POST /api/sync/timings` — `TimingPayload`**

Required (alineado con servidor): `vehicle_id`, `best_lap_time`, `total_time`, `laps`, `average_time`.

Opcional que el tipo envía: `lane`, `circuit_id`, `circuit`, `timing_date`, `lap_times`, `best_lap_timestamp`, `total_time_timestamp`, `average_time_timestamp`, `session_type` (`HEAT`\|`TRAINING`), `supply_voltage_volts`, `guided_session`.

`lap_times` (cliente): `{ lap_number, time_seconds, time_text }`.

**`GET /api/sync/timings`:** `vehicle_id` (required servidor) + `circuit_id`, `lane`, `limit`, `session_type`.  
El servidor **ignora** `session_type` en este GET (discrepancia §5). Sin `vehicle_id` → `400`.

**`POST .../guest-members/:guestId/timings` — `GuestMemberTimingPayload`**

- Cliente **requiere:** `circuit_id`, `best_lap_time`, `laps`.
- Servidor **requiere:** `circuit_id`, `best_lap_time` (`laps` es optional).
- Opcional cliente: campos de vehículo (`vehicle_id` / `vehicle_model` / `vehicle_type`).
- No envía `total_time` / `average_time`.

**`POST /competitions/:id/timings` — `CompetitionTimingPayload`**

Cada fila: `participant_id`, `round_number` (**no** `heat_number`), `best_lap_time`, `total_time`, `laps`; opcional `average_time`, `lane`, `driver`, timestamps, `lap_times`.

**`PUT /competitions/:id`:** `{ external_status, status? }`.

### 2.3 Respuestas stable (las que el cliente necesita para seguir)

| Path | No quitar / renombrar |
|------|------------------------|
| `GET /vehicles` | `vehicles[]`: `id`, `model`, `manufacturer`, `type`, `traction`, `image`; `pagination.{total,page,limit,totalPages}` |
| `GET /circuits` | `circuits[]`: `id`, `name`, `description`, `num_lanes`, `lane_lengths` |
| `POST /circuits` | objeto circuito plano (`id`, `name`, …); `200`/`201` — **no** `{ circuit, created }` |
| `POST /timings` | fila + `sync_meta.{previous_best_lap_seconds, delta_vs_pb_seconds, is_personal_best}`; `201` |
| `GET /timings` | `timings[]` + `meta.{rawCount,filteredCount,laneFallback}` |
| Club GETs | `clubs[]` / `circuits[]` / `guest_members[]` |
| Guest POST | fila `club_guest_timings`; `201` |
| `GET /competitions` | `{ competitions: [...] }` |
| `GET /competitions/:id` | `laps_per_round`, `rounds`, `circuit_*`, `participants`, `round_stages`, `timings` |
| `GET .../progress` | `competition_id`, counts, `times_by_round`, `participant_stats`, `category_rankings` |
| `POST .../timings` | `{ created, updated }`; `201` |
| `PUT /competitions/:id` | fila actualizada |

### 2.4 Residual (HAR opcional)

- Valor real de `APP_VERSION` en prod.
- Si keys de Perfil vs keys generadas por otra vía difieren por app.
- Campos solo presentes en builds antiguos (no en `api.ts` actual).
- Si leen `sync_meta` o ignoran extras (aditivo es seguro).

---

## 3. ds200-manager — `src/core/syncService.js` (A)

**Modo:** escritorio / estación + competiciones (Rally / Simultáneo) + entrenamiento a garaje.  
Headers: **`X-API-Key` + `Content-Type` solamente.** No manda `X-Client-App` ni `X-Client-Version` (no inventar `slot-race-manager` en fixtures).

### 3.1 Endpoints

| Método | Path | Evidencia | ¿Lo usa? | Fixture |
|--------|------|-----------|----------|---------|
| `GET` | `/api/sync/vehicles` | **A** | Sí | `ds200-manager/get-vehicles.json` |
| `GET` | `/api/sync/circuits` | **A** | Sí | `ds200-manager/get-circuits.json` |
| `POST` | `/api/sync/circuits` | **A** | Sí | `ds200-manager/post-circuits.json` |
| `POST` | `/api/sync/timings` | **A** — `buildTimingPayload` + `pushTiming` | **Sí (crítico)** | `ds200-manager/post-timings-training.json` |
| `GET` | `/api/sync/competitions` | **A** | Sí | `ds200-manager/get-competitions.json` |
| `POST` | `/api/sync/competitions` | **A** | **Sí (crítico)** | `ds200-manager/post-competition.json` |
| `GET` | `/api/sync/competitions/:id` | **A** | Sí | `ds200-manager/get-competition-detail.json` |
| `PUT` | `/api/sync/competitions/:id` | **A** | **Sí (crítico)** | `ds200-manager/put-competition.json` |
| `GET` | `/api/sync/competitions/:id/progress` | **C** — no citado en el extracto de `syncService.js` | Posible | `ds200-manager/get-competition-progress.json` |
| `POST` | `/api/sync/competitions/:id/participants` | **A** — `{ participants }` | **Sí (crítico)** | `ds200-manager/post-participants.json` |
| `POST` | `/api/sync/competitions/:id/timings` | **A** — `buildCompetitionSyncTimingRows` | **Sí (crítico)** | `ds200-manager/post-competition-timings.json` |
| `GET` | `/api/sync/clubs/admin` | **U** — no está en las llamadas confirmadas | No en fuente actual | — |
| `GET` | `/api/sync/clubs/:id/members` | — | **P1 D10** (`backend/routes/sync.js`) | — |

**Adyacente (A, no `/api/sync`):** login credenciales → `api_key`. `POST /api/license/register` sigue siendo adyacente (licencia), no re-confirmado en este extracto.

### 3.2 Bodies (A)

**`POST /api/sync/timings` — `buildTimingPayload` + `pushTiming` (entrenamiento real)**

`vehicle_id`, `best_lap_time`, `total_time`, `laps`, `average_time`, `*_timestamp`, `timing_date`; opcional `lane`, `circuit_id`, `circuit`, `lap_times` como `{ lap_number, time_seconds, time_text }`, `session_type` `HEAT`\|`TRAINING`, `supply_voltage_volts`, `reaction_time_ms`.

**`POST /competitions/:id/timings` — `buildCompetitionSyncTimingRows`**

Emite `participant_id`, `round_number` (= número de manga / heat, **ya mapeado**), `best_lap_time`, `total_time`, `laps`, `lane`, timestamps, `timing_date`; opcional `penalty_seconds`.  
**No** emite `driver`. **No** emite `heat_number` en el wire.

**`POST /competitions/:id/participants`:** `{ participants: [...] }`.

**`POST /competitions` / `PUT /:id`:** create + patch (detalle de campos de create = los que ya valida el servidor).

### 3.3 Respuestas stable

Igual que §2.3 para vehicles/circuits/timings/competitions. `recorded_from` en un POST de DS **no** será `slot_race_manager` con el cliente actual.

### 3.4 Residual (HAR opcional)

- ¿Una key o N keys por piloto en prod? (copy vs D8; runtime = 1 key = 1 user).
- Campos solo en builds viejos.
- Si `GET .../progress` se llama en algún build (no listado en el extracto).
- Club paths: no aparecen en `syncService.js` actual.

---

## 4. Mapeo cliente → path → fixture

Raíz: `tests/fixtures/partner-sync/` · `manifest.json`

| Cliente | Path | Fixture |
|---------|------|---------|
| SlotLapTimer | `GET /vehicles` | `slotlaptimer/get-vehicles.json` |
| SlotLapTimer | `GET\|POST /circuits` | `slotlaptimer/get-circuits.json`, `post-circuits.json` |
| SlotLapTimer | `GET /timings` | `slotlaptimer/get-timings-baseline.json` |
| SlotLapTimer | `POST /timings` | `slotlaptimer/post-timings-garage.json`, `post-timings-guided.json` |
| SlotLapTimer | Club admin / circuits / guests | `get-clubs-admin.json`, `get-club-circuits.json`, `get-guest-members.json` |
| SlotLapTimer | `POST .../guest-members/:id/timings` | `slotlaptimer/post-guest-timings.json` |
| SlotLapTimer | `GET /competitions`, `GET /:id`, `GET /:id/progress` | `get-competitions.json`, `get-competition-detail.json`, `get-competition-progress.json` |
| SlotLapTimer | `POST /:id/timings` | `slotlaptimer/post-competition-timings.json` |
| SlotLapTimer | `PUT /:id` | `slotlaptimer/put-competition.json` |
| ds200-manager | `GET /vehicles` | `ds200-manager/get-vehicles.json` |
| ds200-manager | `GET\|POST /circuits` | `ds200-manager/get-circuits.json`, `post-circuits.json` |
| ds200-manager | `POST /timings` (training) | `ds200-manager/post-timings-training.json` |
| ds200-manager | competitions CRUD + participants + timings | `get-competitions.json`, `post-competition.json`, `get-competition-detail.json`, `put-competition.json`, `post-participants.json`, `post-competition-timings.json` |
| ds200-manager | `GET .../progress` | `ds200-manager/get-competition-progress.json` (C) |
| ambos | `401` sin key | `shared/unauthorized-missing-key.json` |

Smoke: `cd backend && npm run test:partner-sync`  
Checklist: `docs/partner-sync/SMOKE_CHECKLIST.md`

---

## 5. Discrepancias (no se “arreglan” en P0)

1. **`docs/API_SYNC_INTEGRATION.md` vs runtime:** la guía omite `POST /circuits`, `GET /timings` (`vehicle_id` required), clubes y competitions.
2. **`POST /api/sync/circuits` vs JWT find-or-create:** sync devuelve el objeto circuito (`200`/`201`), no `{ circuit, created }`. Ambos clientes llaman el path sync (**A**); no se asume el wrapper JWT.
3. **`sync_meta`:** el handler lo añade siempre; la guía no lo lista. Aditivo.
4. **`average_time`:** required en garaje; **derivado** en timings de competición. SLT puede mandar `average_time` opcional en `CompetitionTimingPayload`; el servidor no lo usa como fuente.
5. **Guest:** cliente SLT exige `laps`; servidor no. Cliente no manda `total_time`/`average_time`.
6. **Competitions las escriben ambos.** SLT: `POST /:id/timings` + `PUT` status (**A**). DS: create/list/detail/participants/timings (**A**). El handler de copia personal sigue etiquetando `recorded_from: 'lap_timer'` hardcoded aunque el push lo haga DS.
7. **`round_number`:** ambos clientes envían `round_number` en el wire. DS mapea heat → `round_number` en `buildCompetitionSyncTimingRows`. El servidor no acepta `heat_number`.
8. **`GET /timings?session_type`:** SLT lo manda; el handler **no lee** `session_type`. No se cambia el runtime.
9. **`X-Client-App`:** SLT sí (`lap-timer`); DS no. Los POST de DS se graban como `recorded_from=web` salvo body explícito.
10. **1 key vs N keys:** copy de Slot Race Manager vs D8. Runtime = 1 key = 1 `user_id`.
11. **D10:** `GET /api/sync/clubs/:id/members` implementado en P1 (admin/owner, API key). Los clientes actuales aún no lo llaman.
12. **Formato de tiempos:** competitions exigen `mm:ss.mmm` estricto para derivar media; garaje solo “truthy”.

---

## 6. Contrato servidor congelado (allowlist P0)

Nada de esto se elimina ni se hace required si hoy es optional.

**Garaje:** `GET /vehicles`, `GET|POST /circuits`, `GET|POST /timings`  
**Club:** `GET /clubs/admin`, `GET /clubs/:id/circuits`, `GET /clubs/:id/guest-members`, `POST /clubs/:id/guest-members/:guestId/timings`  
**Club (P1 aditivo):** `GET /clubs/:id/members` (D10)  
**Competitions:** `GET|POST /competitions`, `GET|PUT /competitions/:id`, `GET /competitions/:id/progress`, `POST /competitions/:id/participants`, `POST /competitions/:id/timings`

**Fuera de P0:** Swagger UI, Developers, idempotency, key de club.  
**P1:** OpenAPI en `docs/openapi/slot-database-api.v1.yaml` + D10 members.

---

## 7. Residual (HAR opcional)

La fuente cliente actual ya cierra headers, paths y builders. Queda:

1. Si las API keys de producción se emiten / rotan distinto por app.
2. Campos solo en builds antiguos (no en `api.ts` / `syncService.js` de 2026-09-24).
3. Si algún build de DS llama `GET .../progress` o rutas club.
4. Cómo parsean `{ error }` vs `{ errors }` en 4xx.

---

## 8. Nota P1

- OpenAPI 3: `docs/openapi/slot-database-api.v1.yaml` (marca pública Slot Database API; sin nombres de cliente).
- `GET /api/sync/clubs/:id/members` (D10) — implementado (admin/owner). Sin fixture de cliente 200 (los clientes actuales no lo llaman).
- `guest-members` sigue igual.

---

## 9. Nota P4

CI anti-divergencia: `docs/partner-sync/CI.md`. Workflow **Slot Database API** corre `npm run test:partner-sync` (OpenAPI válido + smokes + drift de rutas). No cambia el runtime.

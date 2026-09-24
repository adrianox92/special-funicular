# Smoke checklist — Partner Sync (interno, 2 clientes)

Usar **después** de cualquier cambio en `backend/routes/sync.js`, `syncCompetitions.js` o insert/validators de timings.  
Nombres de cliente solo aquí / CI. No en Developers.

## Local (obligatorio en P0)

```bash
cd backend && npm run test:partner-sync
# D10 + OpenAPI: npm test -- --testPathPattern='sync-club-members|clubMembers|openapiSpec|partner-sync'
```

Schema-checkea `tests/fixtures/partner-sync/**` contra el contrato congelado (sin pegar a prod). OpenAPI: `docs/openapi/slot-database-api.v1.yaml`.

- [ ] El test `contractFixtures` está verde
- [ ] `git diff` de handlers sync está **vacío** (P0 es docs + fixtures)
- [ ] Fixtures SLT llevan `X-Client-App: lap-timer` + `X-Client-Version`
- [ ] Fixtures DS **no** llevan `X-Client-App` / `X-Client-Version`

## Live (cuando haya key de prueba; no bloquea P0)

Base: `https://slotdatabase.es` (D14: no hay staging partner). Header: `X-API-Key`.

### SlotLapTimer (garaje + guest + competitions)

- [ ] `GET /api/sync/vehicles` → 200, `vehicles[0].id`
- [ ] `GET /api/sync/circuits` → 200
- [ ] `POST /api/sync/circuits` → 200/201
- [ ] `GET /api/sync/timings?vehicle_id=<id>&session_type=TRAINING` → 200, `timings` + `meta`
- [ ] `POST /api/sync/timings` (`slotlaptimer/post-timings-garage.json`) → 201 + `sync_meta`
- [ ] `GET /api/sync/clubs/admin` → 200 (si la key es admin)
- [ ] `POST /api/sync/clubs/:id/guest-members/:guestId/timings` (incluye `laps`) → 201
- [ ] `GET /api/sync/competitions` + `GET /:id` + `GET /:id/progress` → 200
- [ ] `POST /competitions/:id/timings` (`slotlaptimer/post-competition-timings.json`) → 201 `{ created, updated }`
- [ ] `PUT /competitions/:id` `{ external_status }` → 200
- [ ] Sin header → 401 `{ error }`

### ds200-manager (training + competiciones)

- [ ] `GET|POST /api/sync/circuits` → 200/201
- [ ] `POST /api/sync/timings` (`ds200-manager/post-timings-training.json`) → 201 (sin `X-Client-App`)
- [ ] `GET /api/sync/competitions` → 200
- [ ] `POST /api/sync/competitions` → 201
- [ ] `POST .../participants` → 201 `{ participants }`
- [ ] `POST .../timings` (round ≤ rounds, sin `driver`) → 201 `{ created, updated }`
- [ ] `POST .../timings` con `round_number` > rounds → 400
- [ ] `PUT ...` → 200 (409 si `updated_at` viejo)
- [ ] `GET .../progress` → 200 (si el build lo llama)

## Captura residual

HAR opcional: keys distintas por app en prod, campos de builds viejos. Si un check live no coincide, **no “arreglar” el cliente** — anotar en inventario §5/§7.

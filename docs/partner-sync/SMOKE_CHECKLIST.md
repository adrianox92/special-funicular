# Smoke checklist — Partner Sync (interno, 2 clientes)

Usar **después** de cualquier cambio en `backend/routes/sync.js`, `syncCompetitions.js` o insert/validators de timings.  
Nombres de cliente solo aquí / CI. No en Developers.

## Local (obligatorio en P0)

```bash
cd backend && npm test -- --testPathPattern=partner-sync
```

Eso schema-checkea `tests/fixtures/partner-sync/**` contra el contrato congelado (sin pegar a prod).

- [ ] El test `contractFixtures` está verde
- [ ] `git diff` de handlers sync está **vacío** (P0 es docs + fixtures)

## Live (cuando haya key de prueba; no bloquea P0)

Base: `https://slotdatabase.es` (D14: no hay staging partner). Header: `X-API-Key`.

### SlotLapTimer (garaje + guest)

- [ ] `GET /api/sync/vehicles` → 200, `vehicles[0].id`
- [ ] `GET /api/sync/circuits` → 200
- [ ] `GET /api/sync/timings?vehicle_id=<id>` → 200, `timings` + `meta`
- [ ] `POST /api/sync/timings` con fixture `slotlaptimer/post-timings-garage.json` → 201 + `sync_meta`
- [ ] `GET /api/sync/clubs/admin` → 200 (si la key es admin)
- [ ] `POST /api/sync/clubs/:id/guest-members/:guestId/timings` → 201
- [ ] Sin header → 401 `{ error }`

### ds200-manager (competiciones)

- [ ] `GET /api/sync/competitions` → 200
- [ ] `POST /api/sync/competitions` → 201
- [ ] `POST .../participants` → 201 `{ participants }`
- [ ] `POST .../timings` (round ≤ rounds) → 201 `{ created, updated }`
- [ ] `POST .../timings` con `round_number` > rounds → 400
- [ ] `PUT ...` con `updated_at` viejo → 409 `error: conflict`
- [ ] `GET .../progress` → 200

## Captura residual

Si un check live no coincide con la fixture, **no “arreglar” el cliente**. Abrir nota en el inventario §5/§7 y añadir el body real como fixture extra.

# CI — Slot Database API / partner-sync (P4)

GitHub Actions workflow: `.github/workflows/partner-sync.yml`  
Public name: **Slot Database API**. Job: **OpenAPI drift + partner-sync smoke**.

Runs on every `pull_request` and on `push` to `staging`. Vercel preview alone is not this gate.

## What CI enforces

`cd backend && npm run test:partner-sync` (offline, mock env — no live prod keys):

1. **OpenAPI 3 validity** — `docs/openapi/slot-database-api.v1.yaml` must parse via `@apidevtools/swagger-parser`. Invalid spec fails the job.
2. **Canonical file** — `resolveOpenApiSpecPath()` (the file `/api/docs` and `/api/docs/openapi.yaml` serve) is the same repo YAML.
3. **Route drift** — every documented `/api/sync/*` operation exists on `backend/routes/sync.js` / `syncCompetitions.js`, and every public API-key sync route is in the YAML.  
   Internal exception: `POST /api/sync/test-notification` (JWT Profile probe, not the partner key surface).
4. **Contract smokes** — fixtures under `tests/fixtures/partner-sync/` vs the frozen P0 rules (`contractFixtures`).
4b. **D15 Should** — `d15Should.test.js` (Idempotency-Key in spec + optional fixture, rate-limit default, club-key scope).
5. **Docs surface** — `/api/docs` HTML + YAML bytes match the repo file (`partnerDocs`).
6. **D13 / D14** — no internal client product names in the public spec; servers are production + local only.

## Local

```bash
cd backend
npm ci
npm run test:partner-sync
```

That is the same command CI runs. After changing sync handlers, the OpenAPI YAML, fixtures, or `/api/docs`, keep this green before merging to `staging`.

Live partner checks (optional, not CI) stay in `SMOKE_CHECKLIST.md`.

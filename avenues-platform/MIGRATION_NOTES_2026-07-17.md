# Migration Notes — 17 July 2026

Three additive database tables were introduced: `api_keys`, `rate_limits`, and
`episodes`. **Nothing was run against your database** — apply the changes
yourself with the steps below. All changes are additive (no existing tables or
columns are modified), so there is no data-loss risk.

## 0. Prerequisites (do these first)

1. **Rotate the Neon Postgres password** (the old one was committed in `.env`)
   and update `DATABASE_URL` / `DIRECT_URL` in your local `.env` and Vercel env.
2. Regenerate `NEXTAUTH_SECRET`: `openssl rand -base64 32`.

## 1. Apply the schema

```bash
cd avenues-platform
npm install            # picks up xlsx 0.20.3 from the committed lockfile
npx prisma db push     # creates api_keys, rate_limits, episodes (additive)
npx prisma generate
```

(Equivalent raw SQL is in `prisma/migration_2026-07-17_apikeys_ratelimits_episodes.sql`
if you prefer to run it manually.)

## 2. Create a per-org API key for the file watcher

While signed in as an ADMIN, call:

```bash
curl -X POST https://<your-app>/api/admin/apikeys \
  -H "Content-Type: application/json" \
  -H "Cookie: <your session cookie>" \
  -d '{"name": "file-watcher"}'
```

The response contains `rawKey` — **shown once only**. Put it in the watcher's
`.env.watcher` as its `X-API-Key`. The key is bound to your organization; the
`X-Org-Id` header is now optional (and rejected if it names another org).

The legacy shared `INGEST_API_KEY` env secret still works during migration
(bound via `INGEST_ORG_ID`). Once the watcher uses the new key, delete
`INGEST_API_KEY` from your environment to complete the cutover.

Revoke a key: `DELETE /api/admin/apikeys?id=<keyId>` (admin, org-scoped).
List keys: `GET /api/admin/apikeys`.

## 3. Backfill the episodes table

```bash
npx tsx scripts/backfill-episodes.ts            # append-only, idempotent
# or, to rebuild a year from corrected uploads:
npx tsx scripts/backfill-episodes.ts --replace --year 2026
```

From now on, Location ingests (file watcher and browser sync) dual-write into
`episodes` automatically. Patient names / national IDs / medical-aid numbers
are **not** copied into this table — only operational fields.

## 4. Try the new aggregation endpoint

```
GET /api/episodes?year=2026&groupBy=month
GET /api/episodes?year=2026&groupBy=doctor
GET /api/episodes?year=2026&groupBy=medAid&month=6
```

Returns `{ totals, groups: [{ key, episodes, revenue, avgLos }] }`, aggregated
in SQL. Next phase (when you're ready): point the dashboard pages at this
endpoint instead of crunching `rawRows` client-side.

## 5. Rate limiting

Login and registration now use a durable, DB-backed fixed-window limiter
(`rate_limits` table): login 10 attempts / 15 min per email, registration
5 / 15 min per IP. It fails open to the in-memory limiter only if the DB is
unreachable. Optional housekeeping: periodically
`DELETE FROM rate_limits WHERE "resetAt" < now() - interval '1 day';`

## Streamlit app restructure

`dashboard_app.py` went from ~4,890 to ~1,470 lines (page config, access gate,
sidebar and tab layout). All computation now lives in the `mil_dashboard/`
package:

| Module | Contents |
|---|---|
| `config.py` | constants, paths, data registry defaults, shared logger |
| `helpers.py` | table/styling helpers |
| `metrics.py` | all finance/quality/ward/staff computations |
| `ds.py` | episode features, readmission model, anomaly tiles |
| `loaders.py` | CSV loading, header detection, registry, cached bundle |
| `ui.py` | theme + command-center rendering |
| `universal.py` | Universal Analytics workspace |

Run it exactly as before: `streamlit run dashboard_app.py` (keep
`mil_dashboard/` next to it). All 10 tabs pass automated smoke tests with and
without data.

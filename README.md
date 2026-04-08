# Tass Tracker Financial

Base operativa Fase 0–2 con motor analítico `tass-v1.0.0` (daily), jobs y UI mínima usable.

## Qué ya está implementado
- Watchlist usable (listar + agregar/quitar por ticker).
- Stock detail usable (metadata + quote real + último analysis snapshot).
- Jobs base:
  - `quotes-refresh` (reconciliación incremental de barras recientes + `quotes_latest`)
  - `metadata-refresh`
  - `analysis-refresh` (motor `tass-v1.0.0`)
- Ops básicos:
  - `/api/ops/health`
  - `/ops`
- Persistencia de output analítico completo en `stock_analysis_snapshots`:
  - `formulaVersion`
  - `dataStatus`
  - `tassScore`, `entryScore`, `exitScore`
  - `tassCategory`, `entryWindow`, `exitWindow`
  - `factorScoresJson`, `hardInvalidationsJson`, `explanationJson`

## Placeholder vs real
### Real
- Fórmula implementada en `workers/market-worker/src/scoring/tass-v1-engine.ts` con versión fija `tass-v1.0.0`.
- Mapeos de Tass/Entry/Exit y hard invalidations/exit candidates.

### INSUFFICIENT_DATA (explícito)
- Si faltan 250 sesiones o SPY, el motor retorna `dataStatus = INSUFFICIENT_DATA` y scores/windows `null`.
- Si falta ETF sectorial, continúa cálculo sin marcar insuficiencia total y registra missingData.

## Variables de entorno
- `DATABASE_URL` (requerida)
- `MARKET_DATA_PROVIDER=eodhd|stooq` (default `eodhd`)
- `METADATA_PROVIDER=eodhd|sec` (default hereda de MARKET_DATA_PROVIDER)
- `EODHD_API_KEY` (requerida si algún provider usa eodhd)
- `NODE_ENV` (opcional)

## Cómo correrlo
1. `npm install`
2. `npm run db:generate`
3. `cd packages/db && npx prisma migrate dev --name init`
4. `cd packages/db && npx prisma db seed`
5. `npm run -w workers/market-worker job:quotes`
6. `npm run -w workers/market-worker job:metadata`
7. `npm run -w workers/market-worker job:analysis`
8. `npm run -w apps/web dev`

## Tests
- Unit + integration-style deterministic fixtures:
  - `npm run -w workers/market-worker test`
  - `npm run -w packages/config test`

## Pendiente
- Discovery module (fuera de alcance actual)
- Market module complejo (fuera de alcance actual)


## Migraciones
- Migración inicial versionada en `packages/db/prisma/migrations/20260408150000_init_tass_platform/migration.sql`.

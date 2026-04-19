# The Cab

The Cab is a Next.js 15 application for deterministic, wallet-scoped canonical investment ledger reconstruction on Base. The current implementation covers append-only reconstruction runs, pool and strategy-aware ledger projections, residual holding visibility, and discarded activity review paths backed by PostgreSQL.

## Requirements

- Node.js 22+
- pnpm 9+
- PostgreSQL 16+

## Environment

Copy `.env.example` to `.env.local` and provide the required values:

- `DATABASE_URL`
- `BASE_RPC_URL`
- `BASE_TRACE_RPC_URL` if trace-capable fallback access is available
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`

The automated test helpers default to a local database at `postgres://postgres:postgres@localhost:5432/the_cab`.

## Local Setup

1. Install dependencies with `pnpm install`.
2. Create the database referenced by `DATABASE_URL`.
3. Apply schema migrations with `pnpm db:migrate`.
4. Start the app with `pnpm dev`.

## Validation Commands

- `pnpm typecheck`
- `pnpm test:unit`
- `pnpm test:replay`
- `pnpm test:contract`
- `pnpm test:integration`
- `pnpm build`
- `pnpm validate:quickstart`

`pnpm validate:quickstart` is the full acceptance bundle for the canonical ledger feature. It runs typecheck, all automated test suites, and the production build.

## Feature Coverage

- Deterministic replay for fixture-backed wallet reconstructions
- Canonical ledger projections grouped by pool, strategy, and lifecycle
- External deposit and withdrawal classification
- Residual holding visibility without synthetic pool attribution
- Discarded activity isolation with stable reason metadata

The minimal inspection surface is available at `/ledger` and can be queried with a session id after creating an analysis session and running a reconstruction.
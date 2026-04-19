# The Cab

The Cab is a Next.js 15 application for deterministic, wallet-scoped canonical investment ledger reconstruction on Base. The current implementation covers append-only reconstruction runs, pool and strategy-aware ledger projections, residual holding visibility, and discarded activity review paths backed by PostgreSQL.

The application supports a live connected-wallet flow through wagmi and WalletConnect on Base. The repository also keeps fixture-backed replay scenarios for deterministic validation of the canonical ledger pipeline.

## Requirements

- Node.js 22+
- pnpm 9+
- PostgreSQL 16+

## Environment

Copy `.env.example` to `.env.local` and provide the required values:

- `DATABASE_URL`
- `BASE_RPC_URL`
- `BASE_RPC_FALLBACK_URLS` optional comma-separated Base RPC backups for live reconstruction
- `BASE_TRACE_RPC_URL` if trace-capable fallback access is available
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` for WalletConnect in the browser UI

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

- Live wallet reconstruction for connected Base wallets
- Deterministic replay for fixture-backed validation scenarios
- Canonical ledger projections grouped by pool, strategy, and lifecycle
- External deposit and withdrawal classification
- Live Aerodrome manual position lifecycle classification from receipts and logs
- Residual holding visibility without synthetic pool attribution
- Discarded activity isolation with stable reason metadata

## Current Runtime Scope

- Session creation and reconstruction routes are implemented and tested.
- The home page supports live wallet connection and starts reconstruction for the connected wallet.
- Live reconstruction discovers wallet-related Base transactions from ERC20 transfer logs and Aerodrome position NFT transfers.
- Live Mellow detection infers wrapper-style contracts from the wallet's own transaction history instead of requiring manual environment allowlists.
- Fixture wallets under `tests/fixtures/wallets/` remain the deterministic validation path for automated tests.

The minimal inspection surface is available at `/ledger` and can be queried with a session id after creating an analysis session and running a reconstruction.
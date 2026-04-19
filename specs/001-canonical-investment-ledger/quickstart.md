# Quickstart: Canonical Investment Ledger Validation

## Purpose

This quickstart now reflects the implemented validation path for the canonical ledger feature. The commands below exist in the repository and were used to validate the feature-complete implementation.

## Required Environment

The implementation should support these minimum environment values:

- `DATABASE_URL` for PostgreSQL
- `BASE_RPC_URL` for an archive-capable Base RPC provider
- `BASE_RPC_FALLBACK_URLS` for optional comma-separated fallback Base RPC providers
- `BASE_TRACE_RPC_URL` for optional trace-capable fallback access
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` for WalletConnect browser connectivity

## Current Implementation Note

The application now supports live connected-wallet reconstruction through the browser UI and the existing session/reconstruction API routes. The fixture corpus remains the deterministic validation path used by automated tests and the scenarios below.

## Live Wallet Flow

1. Set `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` and start the app with `pnpm dev`.
2. Connect a wallet on Base from the home page.
3. Start reconstruction for the connected wallet.
4. The app will create a session, run reconstruction, and open `/ledger?sessionId=...` with the latest projection.

Expected results:

- Wallet-scoped ERC20 transfers appear as external deposits or withdrawals when no supported protocol semantics are detected.
- Aerodrome manual position activity is classified from live receipts and logs.
- Supported Mellow live detection infers wrapper-style contracts from the connected wallet's own transaction history.

## Available Developer Scripts

The repository now provides the following validation commands:

- `pnpm dev` to run the Next.js application locally
- `pnpm db:migrate` to apply the append-only ledger migrations
- `pnpm test:unit` for classifier and model unit tests
- `pnpm test:replay` for deterministic wallet replay validation
- `pnpm test:contract` for API contract validation
- `pnpm test:integration` for route-level end-to-end validation
- `pnpm validate:quickstart` to run typecheck, all automated tests, and a production build

## Validation Scenario 1: Manual Aerodrome Lifecycle Continuity

1. Start a local database and the Next.js application.
2. Load a fixture wallet whose raw Base history contains:
   - one Aerodrome `mint()` creating a new position NFT
   - one later `increaseLiquidity()` against the same `tokenId`
   - one later partial or full decrease flow
3. Run a reconstruction for the fixture wallet.

Expected results:

- One pool is created for the relevant trading pair.
- One manual strategy exists under that pool.
- The `mint()` opens a new manual position lifecycle.
- The `increaseLiquidity()` extends the same lifecycle rather than creating a second one.
- All canonical ledger records link back to source transaction context and raw observations.

Implementation notes:

- Covered by fixture wallet `tests/fixtures/wallets/us1-wallet.json` and replay validation in `tests/replay/wallet-reconstruction.test.ts`.
- Verified by `pnpm test:replay` and `pnpm test:integration`.

## Validation Scenario 2: Parallel Manual and Supported Mellow Strategies In One Pool

1. Load a fixture wallet whose history includes both manual Aerodrome activity and supported Mellow wrapper or staking activity for the same pool.
2. Run a reconstruction for the fixture wallet.

Expected results:

- The pool appears once.
- Two strategies appear under that pool: `manual` and `mellow_auto`.
- Supported Mellow activity is not represented as manual LP NFT ownership.
- Manual and supported Mellow ledger records remain isolated while sharing the same pool context.

Implementation notes:

- Covered by fixture wallet `tests/fixtures/wallets/us2-wallet.json` and raw observations in `tests/fixtures/raw-observations/us2-wallet-observations.json`.
- Verified by `tests/replay/pool-strategy-lifecycle.test.ts`, `tests/contract/ledger-projection.contract.test.ts`, and `tests/integration/pool-strategy-view.test.ts`.

## Validation Scenario 3: Residual Holdings And Discarded Activity

1. Load a fixture wallet whose history includes:
   - a close and redeploy sequence that leaves residual token balances in the wallet
   - one unsupported, malicious, ambiguous, or invalid in-scope transaction
2. Run a reconstruction for the fixture wallet.

Expected results:

- Residual or unallocated balances remain visible in a portfolio-level residual holding projection.
- Residual records may reference candidate pools but do not force attribution where confidence is low.
- The unsafe transaction is stored as discarded activity with stable reason metadata.
- Discarded activity is reviewable through the API but excluded from trusted ledger projections.

Implementation notes:

- Covered by fixture wallet `tests/fixtures/wallets/us3-wallet.json` and raw observations in `tests/fixtures/raw-observations/us3-wallet-observations.json`.
- Verified by `tests/replay/residual-and-discarded.test.ts`, `tests/contract/discarded-activity.contract.test.ts`, and `tests/integration/residual-and-discarded-flow.test.ts`.

## Validation Scenario 4: Deterministic Replay

1. Run reconstruction twice against the same fixture wallet and the same raw observation corpus.
2. Re-run once more after changing only the order in which raw observations are read during tests.

Expected results:

- Accepted reconstruction outputs are byte-stable or hash-stable across runs.
- No duplicate ledger records or asset movements appear.
- No discarded reason codes drift between runs.
- The latest accepted projection can be swapped to a newer run without mutating older runs.

Implementation notes:

- Verified by `tests/replay/wallet-reconstruction.test.ts` after isolating raw observation persistence per reconstruction run.
- The canonical validation bundle `pnpm validate:quickstart` now completes with typecheck, unit, replay, contract, integration, and production build success.

## Acceptance Threshold

This feature is ready to move to task generation when all four scenarios pass and the implementation demonstrates:

- deterministic replay
- source traceability
- pool-first grouping
- manual versus supported Mellow strategy isolation
- lifecycle continuity rules
- residual holding visibility
- discarded activity isolation

## Validation Record

The following commands were executed successfully against the implemented feature:

- `pnpm typecheck`
- `pnpm test:unit`
- `pnpm test:replay`
- `pnpm test:contract`
- `pnpm test:integration`
- `pnpm build`

The combined `pnpm validate:quickstart` script now represents the expected acceptance path for local verification.
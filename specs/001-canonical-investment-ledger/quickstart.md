# Quickstart: Canonical Investment Ledger Validation

## Purpose

This quickstart defines the validation path the implementation must support for the canonical ledger feature. It is written to guide implementation and acceptance, not to claim that the commands already exist in the current repository.

## Required Environment

The implementation should support these minimum environment values:

- `DATABASE_URL` for PostgreSQL
- `BASE_RPC_URL` for an archive-capable Base RPC provider
- `BASE_TRACE_RPC_URL` for optional trace-capable fallback access
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` for one-wallet session initiation

## Expected Developer Scripts

The implementation should provide scripts equivalent to the following:

- `pnpm dev` to run the Next.js application locally
- `pnpm test:unit` for classifier and model unit tests
- `pnpm test:replay` for deterministic wallet replay validation
- `pnpm test:contract` for API contract validation
- `pnpm test:e2e` for end-to-end session and ledger inspection flows

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

## Validation Scenario 2: Parallel Manual and Supported Mellow Strategies In One Pool

1. Load a fixture wallet whose history includes both manual Aerodrome activity and supported Mellow wrapper or staking activity for the same pool.
2. Run a reconstruction for the fixture wallet.

Expected results:

- The pool appears once.
- Two strategies appear under that pool: `manual` and `mellow_auto`.
- Supported Mellow activity is not represented as manual LP NFT ownership.
- Manual and supported Mellow ledger records remain isolated while sharing the same pool context.

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

## Validation Scenario 4: Deterministic Replay

1. Run reconstruction twice against the same fixture wallet and the same raw observation corpus.
2. Re-run once more after changing only the order in which raw observations are read during tests.

Expected results:

- Accepted reconstruction outputs are byte-stable or hash-stable across runs.
- No duplicate ledger records or asset movements appear.
- No discarded reason codes drift between runs.
- The latest accepted projection can be swapped to a newer run without mutating older runs.

## Acceptance Threshold

This feature is ready to move to task generation when all four scenarios pass and the implementation demonstrates:

- deterministic replay
- source traceability
- pool-first grouping
- manual versus supported Mellow strategy isolation
- lifecycle continuity rules
- residual holding visibility
- discarded activity isolation
# Quickstart: Connected Wallet Live Reconstruction Entry Flow

## Purpose

This quickstart defines the validation scenarios for making The Cab usable from a real browser-connected wallet while continuing to rely on the canonical ledger as the source of truth.

## Required Environment

Set the minimum environment needed for both the browser wallet runtime and the server-side reconstruction path:

- `DATABASE_URL` for PostgreSQL
- `BASE_RPC_URL` for server-side Base RPC access
- `BASE_RPC_FALLBACK_URLS` for optional server-side fallback RPCs
- `BASE_TRACE_RPC_URL` for optional trace-capable fallback access
- `NEXT_PUBLIC_BASE_RPC_URL` for the client wallet runtime transport
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` for WalletConnect-compatible browser connectivity

## Local Startup

1. Apply database migrations with `pnpm db:migrate`.
2. Start the app with `pnpm dev`.
3. Open the root page in a browser with a supported wallet available.

## Validation Scenario 1: Wallet Connection And Ready State

1. Open the app with no wallet connected.
2. Confirm that the entry flow renders the not-connected state and offers wallet connection.
3. Connect one wallet on Base.

Expected results:

- The app shows the connected wallet identity and connector source.
- The app recognizes the Base chain as valid.
- The primary action becomes ready to start analysis for that exact connected wallet.
- No manual wallet-address input is required anywhere in the production flow.

## Validation Scenario 2: Wrong-Chain Handling

1. Connect a wallet while the wallet is on a non-Base chain.
2. Attempt to proceed from the connected-wallet entry flow.

Expected results:

- The app clearly states that Base is required.
- The app does not start analysis while the wrong chain is active.
- The app offers a clear switch-to-Base recovery path.
- After switching to Base, the flow moves to the ready-to-analyze state without requiring a page reload.

## Validation Scenario 3: Session Reuse With Refreshing Latest Accepted Result

1. Connect a wallet on Base and start analysis.
2. Allow one accepted ledger result to complete.
3. Return to the entry flow with the same connected wallet and start analysis again.

Expected results:

- The system reuses the existing wallet analysis session instead of creating a duplicate session.
- The ledger experience opens immediately for that reused session.
- If a latest accepted result already exists, the user can see it immediately.
- The UI clearly indicates that a fresh live reconstruction is refreshing the current result.

## Validation Scenario 4: Live Reconstruction Success

1. Connect a wallet on Base that has supported Aerodrome or supported Mellow activity.
2. Start analysis from the connected-wallet flow.
3. Follow the app into the ledger inspection experience.

Expected results:

- The app creates or resumes a session for the connected wallet.
- The app starts a live reconstruction for that session.
- On success, the user sees canonical ledger output derived from the live path rather than fixtures.
- Pool grouping remains intact, and manual versus supported Mellow strategies remain separated within the same pool.

## Validation Scenario 5: Empty State

1. Connect a wallet on Base that has no supported in-scope activity.
2. Start analysis and allow the live run to complete.

Expected results:

- The app reaches a completed state rather than hanging indefinitely.
- The user sees a clear empty state that explains no qualifying activity was found.
- The empty state does not fabricate pool or strategy data.
- Reviewable discarded activity, if any, remains available without turning the main state into a false success.

## Validation Scenario 6: Failure State And Retry

1. Start the app with live chain access intentionally unavailable or misconfigured.
2. Connect a wallet on Base and start analysis.

Expected results:

- The app shows a meaningful failure state when live reconstruction cannot complete.
- The failure state explains that live chain access or reconstruction failed.
- The user has a clear retry or recovery path after configuration or connectivity is restored.
- If a prior accepted result exists for the same session, the app may continue to show it with an explicit refresh-failed indication instead of showing it as newly successful.

## Validation Scenario 7: Stale-Context Guard

1. Start analysis for wallet A on Base and open its ledger experience.
2. Disconnect wallet A or switch to wallet B or a non-Base chain.
3. Return to the same session-backed ledger URL.

Expected results:

- The app does not silently present wallet A’s result as though it belongs to wallet B or the wrong chain.
- The app shows a guarded stale-context state until the browser wallet matches the session again or the user intentionally starts a matching analysis flow.

## Automated Validation Targets

- `pnpm test:unit`
- `pnpm test:replay`
- `pnpm test:contract`
- `pnpm test:integration`
- `pnpm test:e2e`
- `pnpm build`

`pnpm validate:quickstart` covers typecheck, unit, replay, contract, integration, and build validation. Run `pnpm test:e2e` separately for the browser-connected wallet coverage.

## Acceptance Threshold

The feature is ready to move to task generation when the scenarios above are covered by automated or manual validation and the implementation demonstrates:

- a real connected-wallet browser flow
- Base-only enforcement before live analysis
- deterministic session reuse for one wallet at a time
- live reconstruction backed by the canonical ledger path
- clear running, refreshing, success, empty, and failure states
- production isolation from fixture-backed runtime discovery

## Validation Results

Recorded after implementation completion on 2026-04-19.

- `pnpm validate:quickstart`: passed
- `pnpm test:e2e`: passed
- Contract suite: 5 files passed, 6 tests passed
- Integration suite: 6 files passed, 9 tests passed
- Browser suite: 8 tests passed
- Production build: passed with existing dependency warnings from MetaMask SDK optional async-storage resolution and `pino-pretty` optional formatting support
# Research: Connected Wallet Live Reconstruction Entry Flow

## Decision 1: Keep a single root-scoped wagmi runtime and Base-only wallet configuration

- **Decision**: Reuse the existing root-level `WagmiProvider` and `QueryClientProvider` in the app shell, keep Base as the only configured chain for this feature, and support WalletConnect-compatible plus injected connectors through the same provider instance.
- **Rationale**: The codebase already has a functioning wallet runtime in `src/ui/providers/app-providers.tsx`. Replacing it would add churn without solving the actual feature gap, which is session-aware orchestration and runtime correctness.
- **Alternatives considered**:
  - Introduce a second wallet runtime or modal library: rejected because it duplicates capabilities the repo already has.
  - Delay browser wallet support until a broader design-system pass: rejected because the feature’s core purpose is real browser usability now.

## Decision 2: Keep connected-wallet state client-owned and session state server-owned

- **Decision**: Treat wallet connection, chain selection, and connector identity as client-owned runtime state, and treat analysis sessions, reconstruction runs, and ledger outputs as server-owned state derived from the explicit session bootstrap request.
- **Rationale**: The connected wallet exists only in the browser runtime. The server should not try to infer or persist browser connector state beyond the explicit session creation input. After a session exists, the server can derive all authoritative analysis context from persisted session records.
- **Alternatives considered**:
  - Persist wallet runtime state on the server via cookies or session middleware: rejected because this feature needs wallet-bound analytics, not authenticated user accounts.
  - Keep all flow state client-only: rejected because reconstruction status, accepted results, and retry behavior must survive page reloads and remain auditable.

## Decision 3: Reuse deterministic Base sessions and navigate before refreshing

- **Decision**: Keep `analysisSessionId` deterministic by `chainId + walletAddress`, reuse the existing session on Base when it already exists, navigate to the ledger view immediately after session bootstrap, and trigger the new live reconstruction from the ledger experience rather than waiting to navigate until reconstruction completes.
- **Rationale**: This is the only approach that cleanly satisfies the clarified requirement to show the latest accepted ledger immediately when a reusable session already exists while still starting a fresh live reconstruction.
- **Alternatives considered**:
  - Always create a new session per browser action: rejected because it breaks reuse semantics and creates duplicate state for one wallet.
  - Reconstruct first and navigate only after acceptance: rejected because it cannot show the existing accepted result while the refresh run is in progress.

## Decision 4: Add a session-status read contract for polling latest accepted and latest live run state

- **Decision**: Introduce `GET /api/analysis-sessions/{sessionId}` as a session-status summary contract that returns the session identity, latest accepted run metadata, latest run metadata, and whether an accepted projection is currently available.
- **Rationale**: The existing API surface can create sessions, start runs, and read projections, but it cannot answer the UX-critical question of whether a session is currently refreshing, has failed, or has an accepted result ready to display.
- **Alternatives considered**:
  - Overload the ledger projection response with run state: rejected because it mixes orchestration state into the canonical ledger contract.
  - Derive run state purely from client-local fetch promises: rejected because it fails on reloads and cannot represent server-observed progress.

## Decision 5: Keep reconstruction request-driven for this slice and use persisted run status for progress

- **Decision**: Retain the current request-driven reconstruction executor and use persisted `reconstruction_runs` status transitions to expose progress through the new session-status route while the browser-triggered refresh request is in flight.
- **Rationale**: The existing executor already writes `pending`, `ingesting`, `normalizing`, `projecting`, and `accepted` states. Polling those persisted states provides the required user feedback without introducing a background job system in this feature.
- **Alternatives considered**:
  - Add a queue or worker system immediately: rejected because it adds infrastructure beyond the user-facing usability goal.
  - Keep the current synchronous form with no status polling: rejected because it does not support the required running and refreshing states.

## Decision 6: Keep live refresh on full-session reconstruction and defer incremental block windows

- **Decision**: Use full-session live reconstruction for this feature slice, even on reused sessions, and defer incremental block-window refresh to a later feature when checkpointing is fully operational end to end.
- **Rationale**: The current run model contains checkpoint fields, but the live path does not yet maintain a robust incremental checkpoint contract. Full-session reconstruction is slower but simpler and less likely to surface stale or partial truth in the first usable browser release.
- **Alternatives considered**:
  - Implement incremental refresh immediately: rejected because checkpoint derivation and validation are not yet complete enough to make that safe.
  - Never refresh reused sessions: rejected because the clarified specification requires a fresh live reconstruction.

## Decision 7: Isolate fixtures behind explicit replay-only discovery adapters

- **Decision**: Replace the current implicit fixture lookup in candidate discovery with explicit discovery adapters: one for live production discovery and one for replay or test validation that reads fixtures.
- **Rationale**: The current `CandidateTransactionService` checks fixture wallets before falling back to live discovery. That is acceptable for tests, but it is the exact boundary the new feature must make impossible in the production path.
- **Alternatives considered**:
  - Keep the implicit fixture fallback and rely on wallet addresses not colliding in production: rejected because the production contract must not depend on that assumption.
  - Remove fixture discovery entirely: rejected because replay and deterministic validation are still required.

## Decision 8: Model the browser flow as a derived finite state machine rather than new persisted tables

- **Decision**: Use a derived client application state model with these states: `not_connected`, `wrong_chain`, `ready`, `session_loading`, `reconstruction_running`, `refreshing_with_latest`, `success`, `empty`, and `failure`.
- **Rationale**: The required user-visible states are view concerns composed from wallet runtime, session summary, run summary, and projection contents. They do not require new persistence entities.
- **Alternatives considered**:
  - Persist UI states in the database: rejected because these states are ephemeral and derivable.
  - Leave state semantics implicit in component conditionals: rejected because planning and later testing need stable state definitions.

## Decision 9: Guard ledger rendering against wallet and chain mismatches to prevent stale cross-context output

- **Decision**: Before showing a session-backed ledger result, compare the current connected wallet and chain to the session summary. If they do not match, render an explicit guarded state and require a matching wallet context or an intentional restart.
- **Rationale**: The feature specification explicitly forbids silently showing stale results for a previous wallet or wrong chain as though they belong to the new connected context.
- **Alternatives considered**:
  - Allow any session URL to render without comparing against the active browser wallet: rejected because it can mislead users after wallet or chain changes.
  - Invalidate every session on disconnect or chain switch: rejected because session reuse is a requirement and accepted results remain valid history for the matching wallet.
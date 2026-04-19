# Data Model: Connected Wallet Live Reconstruction Entry Flow

## Scope

This feature extends the already defined canonical ledger and wallet-session model into a usable browser entry flow. It does not change ledger truth entities such as `Pool`, `Strategy`, `PositionInstance`, `CanonicalLedgerRecord`, `ResidualHolding`, or `DiscardedActivity`. It adds read-model and client-state expectations needed to drive session reuse, live refresh, stale-result prevention, and user-visible flow states.

## Persistence Impact

- No new database tables are required for this feature slice.
- `WalletAnalysisSession` remains the persisted identity for one wallet on one chain.
- `ReconstructionRun` remains the persisted source of progress and failure information for live analysis.
- Canonical ledger projection entities remain unchanged and continue to be the source of truth for successful or empty outcomes.

## Existing Persistent Entities Reused

### 1. WalletAnalysisSession

- **Purpose**: Represents the one reusable analysis context for a wallet on Base.
- **Existing identity**: `analysisSessionId = chainId + walletAddress`
- **Fields reused by this feature**:
  - `analysisSessionId`
  - `walletAddress`
  - `chainId`
  - `connectionSource`
  - `latestAcceptedRunId`
  - `status`
  - `createdAt`
  - `lastRequestedAt`
- **Feature-specific rules**:
  - Only one active session may exist for a given wallet on Base.
  - Reusing a session must not create a duplicate session row.
  - The session’s wallet and chain remain the authoritative context for server-side reconstruction and reads.

### 2. ReconstructionRun

- **Purpose**: Represents one live refresh attempt for the wallet session.
- **Fields reused by this feature**:
  - `reconstructionRunId`
  - `analysisSessionId`
  - `runMode`
  - `status`
  - `startedAt`
  - `completedAt`
  - `errorSummary`
  - `classifierVersion`
  - `heuristicsVersion`
- **Feature-specific rules**:
  - `pending`, `ingesting`, `normalizing`, and `projecting` indicate that reconstruction is still running.
  - `accepted` indicates that a projection may be shown as either a populated success or an empty result.
  - `failed` indicates that the failure state should be available to the browser flow.
  - This feature continues to use full-session live refresh rather than incremental checkpoint refresh.

## New Derived Read Models

### 3. ConnectedWalletContext

- **Type**: Client-only runtime state
- **Purpose**: Describes the currently connected wallet in the browser.
- **Fields**:
  - `walletAddress` (nullable)
  - `chainId` (nullable)
  - `connectorId` (nullable)
  - `connectorName` (nullable)
  - `isConnected`
- **Validation rules**:
  - When `isConnected` is false, no production-path analysis may start.
  - When `chainId` is not Base, the runtime must be treated as `wrong_chain`.
  - Only one connected wallet context is valid at a time.

### 4. SessionStatusSnapshot

- **Type**: Server-derived API read model
- **Purpose**: Gives the browser enough state to decide whether the session is idle, running, refreshing, failed, or ready to display an accepted projection.
- **Fields**:
  - `sessionId`
  - `walletAddress`
  - `chainId`
  - `sessionStatus`
  - `latestAcceptedRun` (nullable)
  - `latestRun` (nullable)
  - `hasAcceptedProjection`
  - `lastFailure` (nullable)
- **Validation rules**:
  - `walletAddress` and `chainId` must match the active connected wallet context before the client treats the snapshot as renderable for that browser session.
  - `latestAcceptedRun` and `latestRun` may point to the same run when the newest run is already accepted.
  - `hasAcceptedProjection` is true only when the session has a resolvable accepted run.

### 5. LedgerEntryViewState

- **Type**: Derived client application state
- **Purpose**: Encodes the required user-visible flow states for the connected-wallet entry experience.
- **Allowed values**:
  - `not_connected`
  - `wrong_chain`
  - `ready`
  - `session_loading`
  - `reconstruction_running`
  - `refreshing_with_latest`
  - `success`
  - `empty`
  - `failure`
  - `stale_context_guarded`
- **Derivation rules**:
  - `not_connected`: no connected wallet is present.
  - `wrong_chain`: wallet is connected but not on Base.
  - `ready`: wallet is connected on Base and no session action is in progress.
  - `session_loading`: a session bootstrap request is in progress and no renderable accepted result exists yet.
  - `reconstruction_running`: a live run is in progress and no accepted projection is currently available.
  - `refreshing_with_latest`: a live run is in progress and an earlier accepted projection is available for display.
  - `success`: the latest accepted projection contains in-scope results.
  - `empty`: the latest accepted projection contains no attributable pool records and no residual holdings; discarded activity may still be reviewable separately.
  - `failure`: the latest run failed and there is no better state to render.
  - `stale_context_guarded`: the session summary wallet or chain does not match the current connected wallet runtime.

## Relationships

- One `ConnectedWalletContext` may map to zero or one reusable `WalletAnalysisSession` for Base.
- One `WalletAnalysisSession` has many `ReconstructionRun` records.
- One `SessionStatusSnapshot` is derived from one `WalletAnalysisSession` plus up to two related `ReconstructionRun` records: the latest accepted run and the latest overall run.
- One `LedgerEntryViewState` is derived from one `ConnectedWalletContext`, one optional `SessionStatusSnapshot`, and one optional canonical ledger projection.

## State Transitions

### Connected Wallet Entry Flow

- `not_connected` → `wrong_chain` when a wallet connects on an unsupported chain.
- `not_connected` → `ready` when a wallet connects on Base.
- `wrong_chain` → `ready` when the connected wallet switches to Base.
- `ready` → `session_loading` when the user starts analysis and the session bootstrap request begins.
- `session_loading` → `reconstruction_running` when a session exists, no accepted projection is available, and the live run has started.
- `session_loading` → `refreshing_with_latest` when a reused session already has an accepted projection and a fresh run has started.
- `reconstruction_running` → `success` when the live run reaches `accepted` and the projection contains in-scope results.
- `reconstruction_running` → `empty` when the live run reaches `accepted` and the projection contains no in-scope results.
- `reconstruction_running` → `failure` when the live run reaches `failed` and no accepted projection is available.
- `refreshing_with_latest` → `success` or `empty` when the refresh run reaches `accepted` and the projection is reloaded.
- `refreshing_with_latest` may remain renderable with an error banner if the refresh run fails but an earlier accepted projection is still valid to display.
- Any renderable state → `stale_context_guarded` when the connected wallet address or chain no longer matches the session snapshot.

## Contract Impact

- The feature requires a session-status read contract but does not require changes to canonical ledger persistence entities.
- The create-session contract should explicitly report whether the session was created or resumed.
- The session-status contract should expose enough run metadata to drive polling, failure messaging, and refresh banners without embedding UI-only presentation strings.
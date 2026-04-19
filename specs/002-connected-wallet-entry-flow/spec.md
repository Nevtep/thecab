# Feature Specification: Connected Wallet Live Reconstruction Entry Flow

**Feature Branch**: `002-wallet-entry-flow`  
**Created**: 2026-04-19  
**Status**: Draft  
**Input**: User description: "Create the next feature specification for The Cab: Connected Wallet Live Reconstruction Entry Flow."

## Clarifications

### Session 2026-04-19

- Q: When the user starts analysis for a wallet that already has an existing session, should the app reuse that session or always create a new one? → A: Reuse the existing wallet session, show its latest accepted ledger immediately if one exists, and start a fresh live reconstruction with visible refreshing status.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Start Analysis From The Connected Wallet (Priority: P1)

A real user opens The Cab in the browser, connects one wallet through the supported browser wallet flow, confirms they are on Base, and starts analysis for the actually connected wallet without entering addresses manually or relying on fixture-backed data.

**Why this priority**: The product is not usable until a real user can begin analysis from their live wallet context instead of from hardcoded or test-only inputs.

**Independent Test**: Can be fully tested by opening the browser app with a supported wallet, connecting on Base, starting analysis, and verifying that the created or resumed analysis context matches the connected wallet address.

**Acceptance Scenarios**:

1. **Given** the user opens the app without a wallet connected, **When** they reach the ledger entry flow, **Then** the app prompts them to connect a wallet before analysis can start.
2. **Given** the user connects a wallet while on a non-Base network, **When** they try to proceed, **Then** the app clearly states that Base is required and prevents live analysis from starting until the supported chain is active.
3. **Given** the user connects one wallet on Base, **When** they start analysis, **Then** the app creates or resumes analysis for that exact connected wallet and begins live reconstruction using that wallet as the source context.

---

### User Story 2 - Reach A Meaningful Live Ledger View (Priority: P2)

After starting analysis, the user is taken into a ledger inspection experience that reflects live reconstructed activity for that wallet and preserves the product's existing canonical-ledger structure, including meaningful grouping and strategy separation.

**Why this priority**: Starting analysis alone is insufficient; the user must land in a result view that proves the app is working on real activity and that the canonical ledger remains the source of truth.

**Independent Test**: Can be fully tested by analyzing a wallet with supported live activity and verifying that the user is taken to a session-backed ledger view showing meaningful reconstructed results from the live path.

**Acceptance Scenarios**:

1. **Given** a connected wallet with supported in-scope Base activity, **When** live reconstruction completes, **Then** the user sees a ledger inspection view populated from the accepted live reconstruction for that wallet.
2. **Given** the wallet has both manual and supported Mellow participation in the same pool, **When** ledger results are shown, **Then** the output keeps those activities separated within the pool rather than merging them into one indistinct strategy.
3. **Given** the user reconnects the same wallet later and a matching session already exists, **When** analysis is resumed, **Then** the app reuses that session, shows the latest accepted ledger if one is already available, and clearly indicates that a fresh live reconstruction is refreshing the result.

---

### User Story 3 - Understand Empty, Running, And Failure States (Priority: P3)

The user can tell whether the app is still reconstructing, has found no in-scope activity, has encountered a live-access failure, or has completed successfully, and unsupported or discarded activity does not break the primary flow.

**Why this priority**: A live product must explain its current state clearly; otherwise users cannot distinguish a working but empty result from a broken analysis path.

**Independent Test**: Can be fully tested by running the flow against representative wallets and failure conditions, then verifying that the app presents distinct running, empty, failure, and success outcomes without falling back to fixture-only results.

**Acceptance Scenarios**:

1. **Given** reconstruction is still in progress, **When** the user reaches the ledger inspection flow, **Then** the app shows that analysis is still running and does not present incomplete output as final results.
2. **Given** the connected wallet has no supported in-scope activity, **When** live reconstruction completes, **Then** the app shows a clear empty state that explains no qualifying activity was found.
3. **Given** live chain access fails or analysis cannot complete, **When** the flow reaches a failure outcome, **Then** the app shows a meaningful error state and gives the user a clear way to retry or recover.

### Edge Cases

- The user connects a wallet, starts analysis, and then disconnects or changes wallets before reconstruction finishes.
- The user opens a ledger URL for a session that exists but does not yet have a completed accepted reconstruction.
- The connected wallet has only unsupported, discarded, or residual activity and no attributable pool records.
- The connected wallet is on an unsupported chain at first and switches to Base mid-flow.
- Live chain discovery succeeds for session creation but fails before reconstruction can produce a usable outcome.
- The wallet already has an existing session on Base and the app must reuse that context, surface the latest accepted result if available, and indicate when a fresh live reconstruction is still refreshing it.
- Fixture-backed validation assets are present in the codebase for tests and replay, but the production user flow must not surface them as live results.
- The resulting ledger contains both manual and supported Mellow activity within the same pool, plus discarded items that remain reviewable without blocking the main inspection experience.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST support a browser-based wallet connection flow for one active wallet at a time.
- **FR-002**: The system MUST support a WalletConnect-compatible connection path for the user-facing browser experience.
- **FR-003**: The system MUST treat the actually connected wallet address as the only valid wallet input for the live user-facing analysis path.
- **FR-004**: The system MUST require the active chain to be Base before live analysis can begin.
- **FR-005**: The system MUST clearly identify when the connected wallet is on the wrong chain and prevent analysis from starting until the Base context is active.
- **FR-006**: The system MUST create or resume a wallet analysis session for the connected wallet on Base when the user starts analysis.
- **FR-006a**: If a matching wallet analysis session already exists for the connected wallet on Base, the system MUST reuse that session instead of creating a duplicate session for the same wallet context.
- **FR-007**: The system MUST keep the live user-facing analysis context limited to exactly one connected wallet and one active chain context at a time.
- **FR-008**: The system MUST start live reconstruction for the connected wallet using live onchain discovery and reconstruction as the runtime source of truth.
- **FR-009**: The system MUST NOT depend on fixtures, hardcoded wallet addresses, or hardcoded transaction corpora for the production user-facing analysis path.
- **FR-010**: The system MUST preserve fixture-backed replay and deterministic validation as test-only or validation-only infrastructure separate from the production user flow.
- **FR-011**: The system MUST route the user into a session-backed ledger inspection experience after analysis starts or resumes.
- **FR-012**: The system MUST present meaningful user-visible status for wallet connection, chain validation, session preparation, reconstruction in progress, successful completion, empty completion, and failure.
- **FR-013**: The system MUST make it clear when reconstruction is still running and MUST NOT present unfinished output as completed ledger results.
- **FR-013a**: If a reused session already has an accepted ledger result, the system MUST be allowed to show that latest accepted result while a fresh reconstruction is in progress, provided the UI clearly indicates that the view is being refreshed.
- **FR-014**: The system MUST show ledger results that come from the live reconstruction path for the connected wallet and remain backed by the existing canonical ledger feature.
- **FR-015**: The system MUST preserve pool-first grouping in the displayed ledger output.
- **FR-016**: The system MUST keep manual activity and supported Mellow activity separated within the same pool when results are shown to the user.
- **FR-017**: The system MUST provide a meaningful empty state when no in-scope activity is found for the connected wallet.
- **FR-018**: The system MUST provide a meaningful failure state when live chain access or reconstruction fails and MUST allow the user to retry or recover without relying on test data.
- **FR-019**: The system MUST allow unsupported or discarded activity to remain reviewable without breaking or blocking the main user flow.
- **FR-020**: The system MUST make clear which wallet and session the user is currently inspecting.
- **FR-021**: The system MUST avoid showing results for a previously connected wallet as though they belong to a newly connected wallet without explicit user confirmation or a new matching session context.
- **FR-022**: The system MUST integrate this connected-wallet entry flow with the existing canonical ledger capabilities rather than replacing or bypassing them.

### Key Entities *(include if feature involves data)*

- **Connected Wallet Context**: The single wallet currently connected in the browser and validated for live analysis.
- **Supported Chain Context**: The active chain state that determines whether the user can begin live analysis, which for this feature is Base only.
- **Wallet Analysis Session**: The resumable user analysis context bound to one wallet and one supported chain.
- **Live Reconstruction Attempt**: The user-triggered effort to discover and reconstruct live onchain activity for the connected wallet.
- **Ledger Inspection View**: The session-backed result experience that shows meaningful canonical-ledger output, empty-state messaging, or failure messaging.
- **Reviewable Discarded Activity**: Unsupported or untrusted activity that remains visible for inspection but does not break trusted ledger output.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In representative browser-based acceptance testing with supported wallets, at least 95% of users can connect one wallet, satisfy the supported-chain requirement, and start live analysis without manual address entry.
- **SC-002**: In representative supported-wallet runs, 100% of production-path analyses use the currently connected wallet address rather than a fixture wallet, hardcoded wallet, or test corpus.
- **SC-003**: For representative wallets with supported live activity, users receive either meaningful ledger results, a clear empty state, or a clear failure state within 30 seconds of starting analysis.
- **SC-004**: In stakeholder review of representative successful runs, reviewers can correctly identify the active wallet, session context, and whether results are populated, empty, running, or failed in at least 95% of cases on first inspection.
- **SC-005**: In representative successful runs that include both manual and supported Mellow participation in the same pool, 100% of reviewed outputs preserve separation between those strategies.

## Assumptions

- Users access the feature from a browser environment with at least one supported wallet available to connect.
- The existing canonical ledger domain, session model, and reconstruction path remain the authoritative foundation for live results.
- Base is the only supported chain for this feature slice, and support for other chains will be addressed separately if needed.
- Fixture-backed replay data remains necessary for automated testing, deterministic validation, and domain replay, but not for the production runtime source of truth.
- The initial live inspection experience can remain focused on usability, state clarity, and meaningful ledger visibility without including broader portfolio dashboards, pricing, or PnL features.
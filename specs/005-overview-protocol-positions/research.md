# Research: Overview Protocol Positions

## Decision 1: Extend The Existing Overview Contract Instead Of Creating A New Route

- **Decision**: Keep `GET /api/wallet/overview` as the only browser-facing contract for Stage 1 and extend it with a dedicated `protocolPositions` block.
- **Rationale**: The current connected Overview already owns route protection, query keys, sanitization, and the recent-view dashboard model. A parallel route would duplicate the same chain-aware request context while making protocol positions feel detached from the first connected screen.
- **Alternatives considered**:
  - Creating `GET /api/wallet/protocol-positions` and composing it client-side.
    - Rejected because it adds a second browser contract, fragments Overview loading states, and weakens the rule that browser code consumes only internal app APIs through feature-owned query hooks.
  - Appending protocol positions as synthetic asset rows.
    - Rejected because it would collapse wallet inventory and deployed capital into the same representation, which is explicitly disallowed by the spec.

## Decision 2: Use Moralis For Discovery, But Not As Final Protocol Semantics

- **Decision**: Treat Moralis wallet history, token balances, NFT hints, and DeFi hints as discovery signals only. Final protocol-family classification comes from approved protocol metadata, backend contract reads, and log or event confirmation when necessary.
- **Rationale**: Moralis is already the wallet-centric discovery layer in the app, but generic decoded labels are not reliable enough to distinguish manual Aerodrome deposits, Mellow strategy exposure, and governance locks.
- **Alternatives considered**:
  - Trusting Moralis position labels directly.
    - Rejected because the spec forbids using generic provider hints as final protocol semantics.
  - Ignoring Moralis entirely and reconstructing everything from logs.
    - Rejected because Stage 1 is supposed to preserve the fast Overview posture and only use reconstruction when current-state truthfulness requires it.

## Decision 3: Prefer Current-State Reads First, Then Bounded 30-Day Reconstruction

- **Decision**: Resolve current protocol-position state from direct ownership or contract-state reads whenever possible, and use bounded reconstruction over the most recent 30 days only when current-state reads alone cannot classify or explain an open position honestly.
- **Rationale**: The user explicitly chose a bounded reconstruction slice to make current data more meaningful from the start, but also explicitly rejected turning this feature into the full one-year workflow.
- **Alternatives considered**:
  - Requiring one-year history reconstruction before showing any protocol positions.
    - Rejected because it delays the product promise of immediate visibility.
  - Never reconstructing recent history.
    - Rejected because some current positions can remain invisible or ambiguous without recent protocol evidence.

## Decision 4: Keep Protocol Positions Separate From Wallet Asset Trust Filtering

- **Decision**: Model protocol positions as a separate Overview block and keep Feature 004 trust filtering limited to wallet-asset inventory.
- **Rationale**: Asset trust filtering helps decide how raw wallet tokens should be shown or hidden. Protocol positions answer a different question: what deployed or locked capital currently exists. Mixing those concerns would make both models less honest.
- **Alternatives considered**:
  - Reusing trust-filtered asset rows for protocol-position rendering.
    - Rejected because protocol positions are not ordinary fungible token balances and must not be rendered like they have a fake spot price per unit.
  - Running protocol-position classification inside the trust classifier.
    - Rejected because protocol positions have different identities, coverage states, and value-treatment rules from wallet assets.

## Decision 5: Use Chain-Scoped Deterministic Position Keys From Stage 1

- **Decision**: Every visible protocol position gets a deterministic chain-scoped key in Stage 1, even when the final canonical analyzed-history identity does not yet exist.
- **Rationale**: The Overview block has to preserve identity across refreshes and remain compatible with later Pools, Deposits, Strategies, and Governance surfaces. Wallet address alone is not sufficient for manual deposit NFTs, strategy wrappers, or governance locks.
- **Alternatives considered**:
  - Keying rows by wallet address plus symbol.
    - Rejected because the same wallet can hold multiple positions with the same symbols across different position families.
  - Waiting for the future analyzed model before defining identities.
    - Rejected because the user asked for current protocol positions now, not after the deeper pipeline exists.

## Decision 6: Persist Explainability Evidence Through Existing Overview Persistence First

- **Decision**: Reuse `raw_provider_records`, `coverage_reports`, `portfolio_snapshots`, and existing metadata JSON fields as the default persistence path for Stage 1 evidence, only introducing a narrow normalized record if those surfaces cannot preserve explainability cleanly.
- **Rationale**: The app already persists recent Overview evidence. Reusing those surfaces keeps the change smaller while still satisfying the requirement that classification or value treatment remain debuggable and reclassifiable.
- **Alternatives considered**:
  - Adding a new protocol-position snapshot table immediately.
    - Rejected because it would push Stage 1 toward a broader historical model before the one-year analysis workflow is planned.
  - Keeping protocol-position evidence fully ephemeral.
    - Rejected because the constitution requires raw-to-normalized explainability for analytics outputs.

## Decision 7: Model Value Treatment Explicitly Instead Of Overloading `valueUsd`

- **Decision**: Add an explicit value-treatment status for each visible protocol position so the UI can distinguish `current`, `estimated`, and `unavailable` value states without implying full historical certainty.
- **Rationale**: Stage 1 must surface positions even when valuation is partial. A nullable number alone is not enough to explain whether a number is defensible, estimated from partial inputs, or intentionally omitted.
- **Alternatives considered**:
  - Using only `valueUsd: number | null`.
    - Rejected because it cannot communicate whether a shown number is estimated or fully current.
  - Hiding all positions without full value inputs.
    - Rejected because omission is worse than honest partial visibility for this feature.

## Decision 8: Keep Product-Specific Copy In `overview`

- **Decision**: Store protocol-position headings, family labels, helper descriptions, and empty-state copy in the `overview` namespace. Reuse `coverage` only for generic shared coverage-state labels that already exist there.
- **Rationale**: The user explicitly chose this ownership model for Stage 1, and the constitution requires semantic translation-key usage with EN/ES parity.
- **Alternatives considered**:
  - Creating a new shared protocol-position namespace immediately.
    - Rejected because reuse beyond Overview is not yet proven.
  - Hardcoding copy in the component while the model settles.
    - Rejected because it violates the constitution and creates cleanup work before implementation even stabilizes.

## Decision 9: Validate Runtime Behavior With A Realistic Wallet Input, Not The Existing Smoke Script

- **Decision**: For runtime validation, invoke the Overview route or service with a syntactically valid wallet address and loaded local env rather than relying on `pnpm provider:smoke`.
- **Rationale**: The current smoke script uses the zero address, which Moralis rejects before Overview logic runs. That makes it a poor discriminator for this feature's runtime path.
- **Alternatives considered**:
  - Using `pnpm provider:smoke` unchanged.
    - Rejected because it fails too early to validate protocol-position aggregation.
  - Skipping runtime validation entirely.
    - Rejected because Stage 1 adds backend-owned provider and RPC integration paths that need at least one realistic smoke path.
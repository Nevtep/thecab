# Quickstart: Governance Engine Processing And Metrics DataView

## Preconditions

- App environment is configured with wallet auth and database access.
- Historical analysis can run for the target wallet on Base `8453`.
- Governance feature is available only after analysis is `ready`.
- Manual UI signoff is performed by running the app with an authenticated wallet; no browser automation is required.

## Automated Checks

Run from repository root unless noted:

```bash
pnpm --dir apps/web typecheck
pnpm --dir apps/web test:unit
pnpm --dir apps/web i18n:check
pnpm --dir apps/web ds:check
pnpm --dir apps/web analysis:governance-regression
```

Expected:

- TypeScript passes.
- Unit suite passes.
- i18n parity passes for English/Spanish.
- DS check passes with Governance using shared primitives.
- Governance regression passes for supported, partial, unresolved, unsupported, and excluded fixtures.

## Scenario 1: First-Screen Governance Load

1. Connect a wallet with completed historical analysis and governance activity.
2. Open `/governance`.
3. Confirm the first screen is dashboard-first and contains:
   - KPI strip.
   - Persistent lock status panel.
   - Compact vote timeline by epoch.
   - Governance rewards list/table.
   - Reward-type/value breakdown.
   - Selected-detail inspection panel.
4. Confirm the screen does not render as a generic raw activity table.

## Scenario 2: KPI Strip

1. Use a fixture with active lock and reward claims.
2. Confirm KPI cards show:
   - Locked AERO.
   - veAERO exposure.
   - Lock expiry or remaining duration.
   - Governance rewards claimed.
   - Estimated governance return.
   - Overall coverage state.
3. Confirm missing values remain visible as partial/unavailable rather than disappearing.
4. Confirm estimated return is explicitly labeled estimated and excludes unresolved/excluded values.

## Scenario 3: Lock Panel

1. Select a reward row.
2. Confirm the persistent lock panel still summarizes lock state and does not become reward detail.
3. Confirm lock lifecycle markers show creation, increase, extension, relock, or withdrawal when evidence exists.
4. Confirm partial lock identity or expiry shows coverage notes.

## Scenario 4: Epoch Timeline

1. Use a fixture with vote/reset/claim history across multiple epochs.
2. Confirm epoch cards show epoch identity, voted pools, vote weights when available, manual/relay context, reset state, fees/bribes/rewards state, claim/pending status, coverage, and confidence.
3. Select an epoch card.
4. Confirm selected-detail explains the epoch without replacing the compact timeline with a ledger.

## Scenario 5: Governance Rewards Table

1. Use a fixture with fees, bribes, rebases, and unknown governance rewards.
2. Confirm each row shows reward type, token, amount, USD value at claim, associated epoch, associated pool when explicit, coverage, confidence, and linked context.
3. Confirm rows with missing pool association remain visible and marked partial/unallocated.
4. Confirm pagination/filter changes update inline without full-page visual reload.

## Scenario 6: Reward-Type Breakdown

1. Use a fixture with more than one reward type.
2. Confirm the breakdown communicates value share by reward type.
3. Confirm coverage state appears for partial values.
4. Use a single-category or no-value fixture and confirm the breakdown degrades to an equivalent compact summary without breaking layout.

## Scenario 7: Selected-Detail Panel

1. Select a supported governance reward.
2. Confirm detail includes action summary, tx/timestamp, protocol surface, token movements, value at claim, epoch/vote/pool context, classification evidence, linked contexts, coverage notes, and evidence sources.
3. Select a partial/unresolved/unsupported/excluded row.
4. Confirm the detail structure remains stable and explains missing data or exclusion reason.

## Scenario 8: Cross-Surface Reconciliation

1. Open a governance reward also visible in Rewards.
2. Confirm Governance links to Rewards by explicit reward identity.
3. Confirm Activity links exist when transaction/activity identity is explicit.
4. Confirm Pools links exist only when explicit pool association is present.
5. Confirm the same reward contributes once to product aggregates and does not double count across Governance, Rewards, and Pools.

## Scenario 9: Partial, Unsupported, And Excluded Cases

1. Run fixtures containing:
   - Missing epoch evidence.
   - Missing pool association.
   - Unsupported governance action.
   - Governance-like spam/airdrop transfer.
   - Price-unavailable reward.
2. Confirm rows remain inspectable.
3. Confirm they do not masquerade as confident totals.
4. Confirm coverage/confidence appears at KPI, timeline, row, and selected-detail levels.

## Scenario 10: Locked And Empty States

1. Open `/governance` before analysis is ready.
2. Confirm the locked state uses stable localized error copy.
3. Open Governance for a ready wallet with no governance activity.
4. Confirm layout remains stable and explains no governance activity without presenting fake metrics.

## Regression Fixture Expectations

The deterministic governance regression script should assert:

- Supported governance transactions classify into the correct action family.
- Unsupported/ambiguous rows stay partial/unresolved/unsupported.
- Excluded/spam governance-like transfers do not contribute to rewards or return.
- Governance rewards reconcile with Rewards by reward identity.
- Pool links appear only with explicit evidence.
- Query/read-model outputs carry `chainId`.
- Request-time routes remain DB-only.

## Manual Signoff Notes

Manual visual signoff should record:

- First-screen hierarchy matches the Governance mockup direction.
- No transaction execution controls are present.
- No speculative APR marketing language is present.
- The page feels dense, technical, premium, and evidence-backed.
- Filters and selected-detail updates do not look like full-page reloads.

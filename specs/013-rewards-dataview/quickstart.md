# Quickstart: Rewards DataView

## Goal

Validate the Rewards DataView end to end after implementation:

- route is gated by analysis readiness;
- `/api/rewards` is DB-only and chain-scoped;
- reward ownership is explicit and never inferred by pool/time window;
- manual deposit, strategy, governance, unresolved, and excluded flows remain distinct;
- pool reward totals reconcile without double counting;
- the DataView matches the supplied mockup hierarchy and brand tone.

## Prerequisites

- Branch: `013-rewards-dataview`
- Feature directory: `specs/013-rewards-dataview`
- Active plan: `specs/013-rewards-dataview/plan.md`
- A connected wallet with completed analysis on Base mainnet.
- Representative validation data containing:
  - manual deposit gauge or fee claim;
  - Mellow strategy wrapper or staking reward claim;
  - governance reward where supported;
  - unknown reward surface;
  - ambiguous wrapper withdrawal;
  - spam-like airdrop or excluded reward-shaped inflow;
  - at least one pool with both manual and strategy rewards.

## Implementation Checkpoints

1. Add the Rewards route and server read API.
2. Add Rewards feature module, filters, URL state, mapper, validation, and query hook.
3. Expand rewards i18n resources in English and Spanish.
4. Ensure `/api/rewards` reads only persisted normalized/read-model data.
5. Add or update reward reconciliation tests and regression script.
6. Manually verify the DataView against `branding/guidelines/Rewards guidelines.png`.

## Automated Validation

Run focused Rewards tests after implementation:

```bash
pnpm --dir apps/web exec node --experimental-test-module-mocks --import tsx --test \
  src/server/rewards/rewards.repository.test.ts \
  src/server/rewards/rewards.service.test.ts \
  src/server/rewards/rewards.route.test.ts \
  src/features/rewards/rewards.mappers.test.ts \
  src/features/rewards/rewards.navigation.test.ts \
  src/features/rewards/rewards.urlState.test.ts \
  src/features/rewards/rewards.validation.test.ts \
  src/server/analysis/rewardResolution.test.ts
```

Run existing full unit suite when the focused path is green:

```bash
pnpm --dir apps/web test:unit
```

Run type and localization checks:

```bash
pnpm --dir apps/web typecheck
pnpm --dir apps/web i18n:check
```

Run design-system checks:

```bash
pnpm --dir apps/web ds:check
```

Do not add or require Playwright, browser E2E, or automated browser/a11y tests. They are excluded by constitution v1.1.0.

## Reward Regression Checks

After a fresh analysis run for validation wallets, run the reward regression script:

```bash
pnpm --dir apps/web tsx src/server/scripts/analysis-rewards-regression.ts
```

The script must verify:

- every reward row has `chainId`;
- manual deposit rewards resolve through deposit identity;
- strategy rewards resolve through strategy exposure identity;
- governance rewards do not inflate deposit or strategy totals;
- unresolved or excluded reward-shaped activity has visible reason codes;
- missing claim-time valuation degrades USD coverage;
- pool reward totals equal resolved manual deposit rewards plus resolved strategy rewards plus supported pool-mapped governance rewards;
- no reward event is counted more than once in portfolio or pool totals.

## Manual UI Signoff

Run the app locally:

```bash
pnpm --dir apps/web dev
```

Open `/rewards` after connecting a wallet with completed analysis.

Record product/developer signoff for:

- desktop first viewport shows five KPI cards, filters, rewards-over-time, source/pool/token breakdowns, table, and selected rail;
- selected reward rail shows ownership trace, pool contribution, claim details, coverage notes, and unresolved/excluded activity;
- incoming Pool, Deposit, or Strategy links produce visible removable filter chips;
- unresolved/excluded values are not presented as confident earned rewards;
- narrow viewport keeps selected reward evidence reachable in no more than two interactions;
- copy is localized and no hardcoded English text appears in the UI;
- visual tone matches the dark, disciplined, control-tower mockup.

## Signoff Criteria

The feature is ready for review only when:

- focused tests pass;
- full unit suite, typecheck, i18n, and design-system checks pass or are explicitly reported if not run;
- reward regression passes on representative wallets;
- manual UI signoff is recorded;
- no provider/RPC calls exist in `/api/rewards` request flow;
- Rewards, Pools, Deposits, and Strategies reward totals reconcile or show explicit coverage limitations.

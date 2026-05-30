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

## Feature Closure Scope

Rewards is closed as a stable DataView surface, not as final approval of reward
classification accuracy. The screen, route, filters, selected reward rail, and
cross-surface links are acceptable to keep moving to Governance and Activity.

Known data-quality problems remain in the analysis engine and must not be hidden
with request-time or UI heuristics. In particular, the Base transaction
`0xca23a1618b416be4f082ae26e59dd9bfcea5e028f00a2cd9f1b8dd95fbff77ea`
is expected to be treated as a phishing/spam airdrop, but current analysis output
can surface it as a reward. This violates FR-003 and belongs to the post
Governance/Activity engine classification review.

Until that review is complete:

- Rewards values are useful for DataView validation and flow inspection, but not
  authoritative economic truth.
- The UI must continue surfacing unresolved/excluded/coverage states instead of
  fabricating ownership or suppressing ambiguous rows silently.
- Reconciliation gaps across Rewards, Deposits, Strategies, and Pools remain
  tracked as engine/data-quality follow-up rather than Rewards UI blockers.
- Do not add new spam or reward-detection heuristics in the request path.

## Automated Validation

Run focused Rewards tests after implementation:

```bash
pnpm --dir apps/web test:rewards
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
WALLET_ADDRESS=0x... pnpm --dir apps/web analysis:rewards-regression
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
- Rewards numeric columns, KPI values, token amounts, percentages, timestamps, and hashes use tabular alignment and remain scannable in dense table and rail states;
- copy is localized and no hardcoded English text appears in the UI;
- visual tone matches the dark, disciplined, control-tower mockup.

### Manual UI Signoff Record

Status: **Provisionally accepted for DataView closure; engine data quality remains open**.

Notes:

- Automated browser, Playwright, and a11y signoff remain intentionally excluded by the feature plan and constitution.
- The Rewards screen is acceptable to leave as-is for now so Governance and Activity DataViews can be built next.
- Full visual iteration and authenticated product smoke can resume after the remaining DataViews exist.
- Current reward values must be treated as analysis-engine output under review. The known phishing/spam airdrop transaction `0xca23a1618b416be4f082ae26e59dd9bfcea5e028f00a2cd9f1b8dd95fbff77ea` is a representative misclassification case for the later engine pass.

## Signoff Criteria

The Rewards DataView is ready for staged review when:

- focused tests pass;
- full unit suite, typecheck, i18n, and design-system checks pass or are explicitly reported if not run;
- reward regression passes on representative wallets, with known engine classification failures recorded separately;
- manual UI signoff status is recorded;
- no provider/RPC calls exist in `/api/rewards` request flow;
- Rewards, Pools, Deposits, and Strategies reward totals reconcile or show explicit coverage limitations.

Final economic correctness remains blocked on the later analysis-engine review
after Governance and Activity DataViews expose the remaining classification
surfaces.

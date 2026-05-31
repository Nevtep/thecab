# Quickstart: Activity DataView

## Prerequisites

- Connected wallet with Base mainnet selected.
- Historical analysis completed for the wallet.
- Local environment configured for existing providers.
- Optional supplemental chain explorer credentials may be present for background analysis evidence enrichment.

## Developer Flow

1. Confirm active feature:

   ```bash
   cat .specify/feature.json
   ```

2. Run typecheck before changes:

   ```bash
   pnpm --dir apps/web typecheck
   ```

3. Implement in this order:

   - Activity server contract and validation.
   - Activity read model/materializer.
   - Supplemental explorer evidence wrapper for background analysis only.
   - Activity repository/service/route.
   - Activity query key and query hook.
   - Activity feature module with container/component split.
   - Activity i18n namespace in English and Spanish.
   - Cross-surface links from Overview, Pools, Deposits, Strategies, and Rewards.
   - Deterministic classification regression script.

4. Run focused automated checks:

   ```bash
   pnpm --dir apps/web test:unit
   pnpm --dir apps/web typecheck
   pnpm --dir apps/web i18n:check
   pnpm --dir apps/web ds:check
   ```

5. Run deterministic Activity regression once implemented:

   ```bash
   pnpm --dir apps/web analysis:activity-regression
   ```

   If a local database already contains the known phishing-airdrop fixture in
   a stale pre-fix state, repair that deterministic fixture once and rerun the
   normal regression:

   ```bash
   pnpm --dir apps/web analysis:activity-regression -- --repair
   pnpm --dir apps/web analysis:activity-regression
   ```

6. Manual product/developer signoff:

   - Open `/activity` with a wallet whose analysis is ready.
   - Verify filters, pagination, row selection, and selected detail do not visually reload the full page.
   - Verify unresolved, unsupported, malicious, ambiguous, and partial rows preserve layout.
   - Verify a known phishing airdrop is excluded from rewards/earned value and labeled as malicious or excluded.
   - Verify a Mellow strategy row is not labeled as manual deposit activity.
   - Verify a rebalance or partial swap attribution row exposes source allocation where available.

## Acceptance Evidence

Record:

- Automated command results.
- Regression script output summary.
- Manual signoff notes for auth-gated UI behavior.
- Any known coverage limitations or follow-up engine cases.

## Current Validation Snapshot

Last implementation pass:

```bash
pnpm --dir apps/web typecheck
pnpm --dir apps/web test:unit
pnpm --dir apps/web i18n:check
pnpm --dir apps/web ds:check
pnpm --dir apps/web analysis:activity-regression
```

Expected deterministic regression result for the known phishing airdrop:

- Activity row is `airdrop` with `excluded` coverage and `airdrop_spam` reason.
- Matching reward row is `excluded`, not `resolved` or `unresolved`.
- Excluded reward has no resolved pool and no USD contribution to pool totals.
- If the row existed before the exclusion fix, `--repair` can normalize the local fixture before a normal pass.

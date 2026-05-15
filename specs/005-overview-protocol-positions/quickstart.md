# Quickstart: Overview Protocol Positions

## Goal

Implement Stage 1 so connected Overview can show current manual Aerodrome positions, Mellow strategy exposure, and governance locks in a dedicated protocol-positions block without expanding into the full one-year analysis pipeline.

## Recommended Implementation Order

1. Extend the shared Overview contract types.
   - Update `apps/web/src/server/overview/overview.types.ts` and `apps/web/src/features/overview/overview.types.ts` with a `protocolPositions` block, protocol-position family vocabulary, coverage states, and value-treatment states.
   - Keep the route path and query key shape unchanged.

2. Add backend protocol-position helpers.
   - Create `apps/web/src/server/protocol-positions/protocolPositions.types.ts`.
   - Add detection helpers for approved Aerodrome and Mellow surfaces.
   - Add a bounded-reconstruction helper that refuses to inspect protocol activity older than 30 days for this feature.

3. Integrate the Overview aggregator.
   - Update `apps/web/src/server/overview/getRecentOverview.ts` to assemble protocol positions before final metrics and empty-state decisions are computed.
   - Keep wallet-asset trust filtering separate from protocol positions.
   - Persist raw provider or RPC evidence, or enough normalized metadata, through existing repository helpers.

4. Extend the route sanitization boundary.
   - Update `apps/web/src/app/api/wallet/overview/route.ts` so the new `protocolPositions` block is cloned and sanitized without leaking provider-native fields.

5. Wire the frontend Overview slice.
   - Update `apps/web/src/features/overview/overview.mappers.ts` for normalization and ordering.
   - Update `apps/web/src/features/overview/Overview.container.tsx` only as needed for view-model plumbing.
   - Update `apps/web/src/features/overview/Overview.component.tsx` to render a dedicated protocol-positions section separate from wallet assets.

6. Add EN/ES localization.
   - Extend `apps/web/src/i18n/locales/en/overview.json` and `apps/web/src/i18n/locales/es/overview.json`.
   - Reuse or extend `coverage` keys only for generic coverage-state labels already shared across the app.

## Validation Commands

Run from `apps/web` unless noted otherwise.

```bash
pnpm i18n:check
pnpm typecheck
pnpm lint
pnpm build
rg "@/server/providers|moralis|alchemy" src/features src/app --glob '!**/api/**'
```

## Runtime Smoke Guidance

- Prefer a direct invocation of `/api/wallet/overview` or `getRecentOverview()` with a syntactically valid wallet address and loaded local env.
- Do not rely on `pnpm provider:smoke` as the primary signal for this feature, because the current smoke script uses the zero address and Moralis rejects it before Overview logic executes.

## Acceptance Checklist

- A wallet with a manual Aerodrome position shows a visible manual protocol-position row even when the wallet holds no liquid pool tokens.
- A wallet with both manual Aerodrome and Mellow exposure shows separate rows with separate families.
- Governance locks remain visible even when current USD valuation is unavailable.
- `manualDepositsValueUsd`, `automatedStrategiesValueUsd`, and `governanceValueUsd` do not fabricate values when inputs are incomplete.
- Coverage copy makes it clear when Stage 1 used recent bounded reconstruction instead of a full historical model.
- Unrelated NFTs do not appear in the protocol-positions block.

## Out Of Scope Guardrails

- No one-year historical reconstruction.
- No realized or unrealized performance analytics.
- No annualized return or reward attribution.
- No detail pages for Pools, Deposits, Strategies, or Governance.
- No generic NFT portfolio support.
- No new browser-facing provider API.
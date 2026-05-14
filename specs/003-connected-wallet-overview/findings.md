# Findings: Connected Wallet Overview

## Scope

This document captures the implementation findings and runtime research completed during Feature 003, with emphasis on recent Overview correctness, asset pricing behavior, chart behavior, and analysis-status semantics. It is intended as a handoff reference before starting Feature 004.

## Finding 1: Recent Overview Is Implemented And Validated As A Recent-View System

- The current `/overview` experience is backed by the recent-view aggregation path, not by analyzed-history reconstruction.
- The Overview route currently resolves through `getRecentOverview`, and the selected range (`24h`, `7d`, `30d`) only changes the recent provider-backed query shape.
- Analysis completion does not currently switch the UI into an analyzed-history data source.

Implication:

- Runtime correctness issues seen in the Overview chart or asset list should first be treated as recent-view backend issues, not as analysis-read-model issues.

## Finding 2: Main Asset Pricing Requires Canonical Alchemy Address Resolution

- Native Base ETH must be priced through Base WETH for Alchemy valuation.
- Bridged Base USDbC must be priced through canonical Base USDC for reliable Alchemy valuation.
- Canonical Base addresses for WETH, USDC, cbBTC, and AERO are usable pricing anchors for recent Overview valuation.

Resolved pricing aliases used during Feature 003 research:

- ETH -> Base WETH `0x4200000000000000000000000000000000000006`
- USDbC `0xd9aaec86b65d86f6a7b5a1b0c42ffa531710b6ca` -> Base USDC `0x833589fcd6edb6e08f4c7c32d4f71b54bda02913`

Implication:

- Asset rows for main assets should not rely only on the wallet token address returned by Moralis. They need canonical pricing-address resolution before valuation.

## Finding 3: Alchemy Current Prices Are Useful But Not Sufficiently Reliable Alone

- Alchemy's current-price endpoint can return rate-limit responses under quota pressure.
- When that happens, dropping spot prices directly to `null` causes the asset list to under-report prices for major assets and also reduces the reported portfolio total.
- The latest historical Alchemy price point is a better fallback than returning no price at all.

Resulting pricing strategy validated in Feature 003:

1. Use current Alchemy price when available.
2. Fall back to the latest historical Alchemy price for the same canonical asset when the current endpoint is unavailable or rate-limited.
3. Use Moralis USD values only as low-confidence fallback behavior when no Alchemy-based value is available.

Implication:

- Main asset rows in the Overview API should be treated as Alchemy-augmented values, not as raw Moralis values.

## Finding 4: The Portfolio Total Error And The Missing Asset Prices Shared The Same Root Cause

- `netPortfolioValueUsd` is derived from the sum of priced asset rows in the recent Overview aggregation.
- If important rows lose `priceUsd`, they also lose `valueUsd`, and the top-line portfolio metric drops with them.
- This explains the observed regression where the portfolio total fell from roughly `$10k` to roughly `$6k` while main assets also appeared incorrectly priced or unpriced.

Implication:

- A portfolio-total regression in Feature 003 should be investigated through asset-row valuation coverage first.

## Finding 5: The 30d Blank Chart Was A Backend Historical-Pricing Coverage Problem, Not A Range-Selector UI Problem

- The Overview range selector was correctly refetching the backend payload.
- The chart series for recent Overview is built from Alchemy historical pricing buckets.
- Blank chart behavior occurs when those bucket values become `null` because historical price coverage is partial or fails during the range query.

Implication:

- If the `30d` chart appears blank while other UI controls still work, the likely issue is historical pricing coverage in the recent Overview service, not the client-side range switch logic.

## Finding 6: Analysis Status Semantics Are Still Scaffold-Level In Feature 003

- The analysis start route still triggers the task path and also runs the analysis task inline.
- The current analysis task can mark a run `ready` immediately after lightweight provider fetches.
- That `ready` state does not mean analyzed-history artifacts exist for Overview rendering.

Implication:

- During Feature 003, analysis status should be understood as workflow scaffolding and freshness messaging, not as proof that a wallet has fully reconstructed historical protocol state.

## Finding 7: Latest Validated State Looked Correct For Main Overview Values

Latest validation at the end of Feature 003 showed:

- Main asset values looked correct in recent tests.
- The recent Overview payload returned Alchemy-augmented pricing for major assets after canonical alias resolution and historical fallback logic.
- The asset list UI was updated to show unit spot price prominently, with position value as secondary context.
- The recent chart was backed by real historical pricing rather than a synthetic placeholder series.

Validated commands and checks run during this stage included:

- `cd apps/web && pnpm provider:smoke`
- `cd apps/web && pnpm i18n:check`
- `cd apps/web && pnpm typecheck`
- `cd apps/web && pnpm lint`
- `cd apps/web && pnpm build`
- direct route-level checks against `/api/wallet/overview`
- direct Alchemy current-price and historical-price probes for canonical Base assets

## Handoff Notes For Feature 004

Feature 004 should treat the following as already established by Feature 003:

- Connected Overview recent-view delivery is working.
- Asset valuation requires canonical pricing-address normalization before display.
- Recent-view charting should continue to rely on persisted or live Alchemy historical pricing rather than synthetic chart placeholders.
- Analysis lifecycle and analyzed-history delivery are still separate concerns.

Recommended Feature 004 focus areas:

1. Introduce true analyzed-history reconstruction and source handoff for Overview.
2. Replace scaffold-level analysis readiness semantics with a real async pipeline boundary.
3. Expand beyond recent-view-only capital classification so Overview blocks can reflect protocol-aware deployed/manual/automated states more accurately.

## Bottom Line

Feature 003 ends in a stable recent Overview state with validated asset values, working Alchemy augmentation, and documented boundaries around analysis and analyzed-history. The main unresolved work is no longer pricing correctness for the recent Overview path; it is the transition into a true analyzed-history system for Feature 004.
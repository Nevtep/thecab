# Quickstart: Full Design System Implementation

## Objective

Deliver the complete internal Design System before feature-page expansion, then migrate landing and app shell to DS exports with enforcement and quality gates.

## Prerequisites

- Workspace root: /Users/core/Code/The Cab
- Web app path: apps/web
- Branch: 001-build-design-system

## Milestone A: Foundation + Primitives Bootstrap

1. Create DS structure under apps/web/src/design-system:
   - tokens
   - primitives
   - icons
   - feedback
   - layout
   - data-display
   - charts
   - domain
   - index.ts
2. Expand tamagui tokens to full brand/surface/text/semantic/spacing/radius/shadow/z-index system.
3. Integrate Orbitron, Inter, IBM Plex Mono at root and wire role-based usage.
4. Add and pin DS runtime dependencies (Lucide + Recharts) in apps/web/package.json.
5. Implement primitive wrappers:
   - CabBox, CabText, CabStack, CabButton, CabCard, CabInput, CabBadge, CabSeparator, CabTooltip
6. Implement CabIcon abstraction with semantic registry.
7. Implement feedback wrappers:
   - CabEmptyState, CabLoadingPanel, CabErrorPanel

Checkpoint command set:

- cd apps/web
- pnpm install
- pnpm lint
- pnpm typecheck
- pnpm build

## Milestone B: Layout + Data Display + Base Charts

1. Implement layout shells and navigation controls:
   - disconnected shell, connected shell, sidebar/top nav, section header, dashboard grid
   - lock state and analysis CTA patterns
2. Implement data display wrappers:
   - metric card, KPI strip, data panel, chart panel, coverage badge, analysis status badge
   - CabUsdValue, CabTokenAmount, CabWalletAddress, CabTxHash
3. Implement chart base wrappers and chart frame:
   - line, area, bar, donut with typed series contracts and DS styling defaults

Checkpoint command set:

- cd apps/web
- pnpm lint
- pnpm typecheck
- pnpm build

## Milestone C: Domain Components + Migration

1. Implement presentational domain components:
   - pool card, deposit card, strategy card, reward timeline, activity row, rebalance marker, residual attribution panel
2. Migrate landing and app shell to DS exports.
3. Remove direct raw component usage in product files.

Checkpoint command set:

- cd apps/web
- pnpm lint
- pnpm i18n:check
- pnpm typecheck
- pnpm build

## Milestone D: Enforcement + Freeze

1. Add lint/import guardrails for Tamagui/Lucide/Recharts direct usage outside DS internals.
2. Add DS compliance checks:
   - hardcoded brand hex prevention in product screens
   - i18n compliance
   - formatter compliance
3. Run DS-focused verification:
   - primitive render checks
   - chart prop mapping checks
   - key layout snapshot checks
4. Perform acceptance traceability against spec success criteria.

Final verification command set:

- cd apps/web
- pnpm lint
- pnpm i18n:check
- pnpm typecheck
- pnpm build

## Non-Goals Reminder

- Do not change feature business logic.
- Do not change analytics computation/domain pipeline code.
- Do not change provider ownership boundaries.

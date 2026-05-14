# Implementation Plan: Full Design System Implementation

**Branch**: `001-build-design-system` | **Date**: 2026-05-13 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-build-design-system/spec.md`

## Summary

Build a complete internal Design System for the web app before feature-page expansion so that product surfaces consume only Cab wrappers over Tamagui, Lucide, Recharts, and localized formatting contracts. The rollout is phased: foundations (governance, tokens, typography, dependencies), primitives/core wrappers, layout/data display/chart/domain component families, migration of landing and shell, then enforcement and verification gates.

## Technical Context

**Language/Version**: TypeScript 5.x, React 19, Next.js 16 App Router  
**Primary Dependencies**: Tamagui 2.0.0-rc.42, Lucide React (to be added), Recharts (to be added), react-i18next 17.x, i18next 26.x, Zustand 5.x, TanStack Query 5.x  
**Storage**: N/A for DS components; reuses existing i18n JSON resources  
**Testing**: ESLint 9, TypeScript typecheck, Next build, DS-focused render/contract tests using project TS tooling  
**Target Platform**: Web (desktop + mobile responsive) via Next.js  
**Project Type**: Frontend web application (presentation-system feature)  
**Performance Goals**: No regression to current build stability; maintain responsive rendering and efficient chart wrappers for dashboard use  
**Constraints**: No direct Tamagui/Lucide/Recharts imports outside DS internals; no hardcoded product copy in DS; preserve existing feature logic  
**Scale/Scope**: DS foundations + wrappers + migration for landing/app shell + enforcement gates across `apps/web/src`

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- Brand consistency gate: **PASS**. Plan codifies full token system from brand spec (Cab Night, Deep Space, Signal Teal, Cab Gold) and typography roles (Orbitron, Inter, IBM Plex Mono) with readability-first controls.
- Localization gate: **PASS**. DS contracts require prop-driven i18n copy and formatter wrappers; no hardcoded product copy in DS internals.
- Chain-awareness gate: **PASS**. DS is presentational and chain-agnostic; chain-specific logic remains in hooks/queries/domain containers.
- Provider/API gate: **PASS**. DS layer does not change provider ownership or API boundaries.
- Explainability gate: **PASS**. DS includes explicit coverage/status badges and partial/unknown visual states without modifying analytics semantics.

## Project Structure

### Documentation (this feature)

```text
specs/001-build-design-system/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── ds-export-surface.md
│   ├── ds-enforcement-rules.md
│   └── ds-chart-series-contract.md
└── tasks.md                # generated later by /speckit.tasks
```

### Source Code (repository root)

```text
apps/web/
├── tamagui.config.ts
├── eslint.config.mjs
├── package.json
├── scripts/
│   └── check-i18n-parity.ts
└── src/
    ├── app/
    │   ├── globals.css
    │   ├── page.tsx
    │   └── providers.tsx
    ├── i18n/
    │   ├── config.ts
    │   ├── formatters.ts
    │   └── locales/
    ├── providers/
    │   └── tamagui-provider.tsx
    ├── wallet/
    ├── queries/
    └── design-system/              # to be created in this feature
        ├── tokens/
        ├── primitives/
        ├── icons/
        ├── feedback/
        ├── layout/
        ├── data-display/
        ├── charts/
        ├── domain/
        └── index.ts
```

**Structure Decision**: Use a dedicated `apps/web/src/design-system` root with strict public export barrels. Keep DS internals separated by layer (tokens, primitives, layout, display, charts, domain) and keep current app/business modules unchanged except migration of presentation usage.

## Phase 0: Outline & Research

Research goals completed for:

1. **DS import-boundary enforcement** (ESLint flat-config compatible strategy).
2. **Folder topology and export-surface contract** for component families.
3. **Typed wrapper patterns** for icon and chart abstractions.
4. **Typography and token integration path** in Tamagui + global CSS.
5. **Verification strategy** that works with current project toolchain.

Output is captured in [research.md](./research.md) with decisions, rationale, and alternatives.

## Phase 1: Design & Contracts

Design outputs in this phase:

1. **Data model** for DS entities and relationships in [data-model.md](./data-model.md).
2. **Contracts** for export surface, enforcement, and chart series under [contracts](./contracts).
3. **Quickstart** for milestone execution and migration workflow in [quickstart.md](./quickstart.md).
4. **Agent context update** to make planning references discoverable from Copilot instructions.

Post-design constitution re-check:

- Brand consistency gate: **PASS**
- Localization gate: **PASS**
- Chain-awareness gate: **PASS**
- Provider/API gate: **PASS**
- Explainability gate: **PASS**

## Phase 2: Implementation Planning Approach

Execution sequence (for `/speckit.tasks` decomposition):

1. Phase 1 Foundation (governance, tokens, fonts, dependencies).
2. Phase 2 Primitives/Core Wrappers.
3. Phase 3 Layout System and Phase 4 Data Display in parallel after primitive stability.
4. Phase 5 Chart wrappers split into base/domain tracks after chart contracts settle.
5. Phase 6 Domain presentational components.
6. Phase 7 Migration (landing + app shell first).
7. Phase 8 Enforcement/quality gates.
8. Phase 9 verification freeze and traceability review.

Delivery boundaries:

- Included: DS infrastructure, wrappers, domain presentational components, migration, enforcement.
- Excluded: feature business logic, analytics computation logic, backend/domain pipeline changes.

## Complexity Tracking

No constitution violations requiring exception tracking.

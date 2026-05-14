# Implementation Plan: Landing Page

**Branch**: `002-landing-page` | **Date**: 2026-05-13 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-landing-page/spec.md`

## Summary

Implement Feature 1 as a production-ready, mobile-first Landing Page that communicates The Cab as a premium control tower for on-chain capital, drives wallet-connect conversion, and stays fully aligned with existing architecture boundaries: DS-first UI composition, i18n-only copy, `useCabWallet` state handling, and no analytics pipeline or provider changes. The final IA must cover the broader landing-copy structure: problem framing, product promise, workflow, model clarity, activity interpretation, trust/privacy, and CTA.

The implementation will prioritize text-first rendering and optimized media delivery using the attached visual assets, moved/served from `apps/web/public/landing`, with strict EN/ES parity and quality-gate verification.

## Technical Context

**Language/Version**: TypeScript 5.x, React 19, Next.js 16 App Router  
**Primary Dependencies**: Next.js App Router, Tamagui wrappers via internal Cab DS, i18next/react-i18next, wagmi + WalletConnect through `useCabWallet`  
**Storage**: N/A (landing is presentation and interaction only)  
**Testing**: ESLint 9, TypeScript typecheck, i18n parity script, Next.js build, accessibility validation  
**Target Platform**: Web (mobile/tablet/desktop)  
**Project Type**: Frontend web application feature  
**Performance Goals**: Fast first contentful paint with text/CTA visible early; no significant LCP regression from current baseline  
**Constraints**: No hardcoded user-facing strings, DS-only UI imports for page composition, no new providers, no analytics logic changes  
**Scale/Scope**: One landing route and section components, landing namespace keys in EN/ES, curated/optimized brand assets in public path

## Constitution Check

*GATE: Must pass before implementation tasks. Re-check after section/component design.*

- Brand consistency gate: **PASS**. Plan applies control-tower, premium, technical tone and approved brand colors/motifs.
- Localization gate: **PASS**. All copy through translation keys with EN/ES parity and fallback strategy.
- Chain-awareness gate: **PASS**. Wallet state messaging is Base v1 scoped and uses existing chain-aware wallet abstractions.
- Provider/API gate: **PASS**. No Moralis/Alchemy/RPC/provider ownership changes; landing remains UI/presentation.
- Explainability gate: **PASS**. How-it-works and trust sections explain boundaries/coverage at product level without pipeline changes.

## Project Structure

### Documentation (this feature)

```text
specs/002-landing-page/
├── spec.md
├── plan.md
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```text
apps/web/
├── public/
│   └── landing/                        # optimized curated landing visuals
├── src/
│   ├── app/
│   │   ├── page.tsx                    # landing route entry
│   │   └── page.module.css             # route-level styles if needed by existing pattern
│   ├── design-system/
│   │   ├── layout/
│   │   ├── data-display/
│   │   ├── feedback/
│   │   └── ...
│   ├── i18n/
│   │   └── locales/                    # add/update landing namespace keys EN/ES
│   └── wallet/
│       └── useCabWallet.ts             # consumed, not modified in behavior contract
└── scripts/
    └── check-i18n-parity.ts
```

**Structure Decision**: Implement landing sections under the existing App Router landing route and compose with existing DS exports; keep business logic in existing hooks/providers and keep landing-specific media under `public/landing`.

## Architecture Practices and Decisions Applied

1. Keep landing as a presentation feature only: no protocol/domain computation changes.
2. Preserve provider boundaries: no new external data provider integration.
3. Reuse existing app providers and wallet abstraction (`useCabWallet`) for CTA state behavior.
4. Keep chain messaging v1-accurate (Base mainnet) while not hardcoding chain logic in UI components.
5. Enforce i18n-first policy: all visible strings through translation keys; no inline literals in JSX.
6. Use Cab DS components/tokens for layout, spacing, typography roles, and interactive elements.

## Visual Asset Plan (Attached Images)

### Asset Selection Principles

- Prefer visuals that directly reinforce section intent (hero, workflow, trust, analytics surfaces).
- Defer non-essential decorative assets to avoid performance regression.
- Serve responsive versions and prioritize above-the-fold media optimization.

### Proposed Section-to-Asset Mapping

1. Hero
- Primary candidates: `hero_background.png`, `logo_wordmark_rgba.png`, `hero_visual_rgba.png`
- Alternative fallback: `background.png` + `logo_mark_rgba.png`

2. Problem / Value Section
- Candidates: `problem_section_background_rgba.png`, `problem_01_pool_exposure_fragmented.png`, `problem_02_strategies_not_manual_deposits.png`, `problem_03_rewards_need_attribution.png`, `problem_04_activity_needs_interpretation.png`

3. Product Promise
- Candidates: `product_promise_visual_03.png`

4. How It Works
- Candidates: `how_it_works_step_01_rgba.png` ... `how_it_works_step_05_rgba.png`
- Optional timeline variant: `landing_activity_interpretation_timeline.png`

5. Model Clarity
- Candidates: `landing_pools_deposits_strategies_diagram.png`

6. Activity Intelligence
- Candidates: `landing_activity_interpretation_timeline.png`

7. Trust and Privacy
- Candidates: `landing_read_only_trust_icon_rgba.png`, `coverage_01_full.png`, `coverage_02_share_level.png`, `coverage_03_partial.png`, `coverage_04_unknown.png`

8. CTA / Conversion Endcap
- Candidates: `landing_final_cta_background.png`, `landing_wallet_connection_flow.png`

### Asset Operations

- Move curated, final assets to `apps/web/public/landing/` with stable, lowercase, semantic names.
- Keep oversized/unused alternates in `branding/landing/` for design iteration only.
- Use optimized dimensions and modern format strategy where supported by current Next config.

## Implementation Phases

### Phase 1: Route and Section Skeleton

- Define section composition in landing route with semantic structure (`header`, `main`, `section`, `footer` as applicable).
- Add section containers and DS-based layout scaffolding.
- Preserve copy-guideline section order so the route includes product promise, model clarity, and activity intelligence between the existing problem, workflow, and trust surfaces.
- Ensure primary CTA is visible in first viewport on mobile and desktop.

### Phase 2: i18n Namespace and Copy Wiring

- Add landing namespace key groups for hero/value/how/trust/cta/a11y labels.
- Extend the namespace for product promise, model clarity, and activity intelligence so the landing matches the broader bilingual content docs.
- Add EN keys from canonical copy direction and ES adaptation with parity.
- Replace all hardcoded copy with translation lookups.

### Phase 3: Wallet CTA Behavior Integration

- Wire CTA states to `useCabWallet`: disconnected, connected-on-Base, unsupported chain.
- Ensure state-specific labels and actions are localized.
- Keep unsupported-chain guidance aligned with v1 scope wording.

### Phase 4: Asset Integration and Visual Refinement

- Place selected images in `public/landing` and bind to target sections.
- Reuse the attached pool/model diagram and activity interpretation artwork for the new product-model sections.
- Implement responsive image behavior and prioritize hero media loading.
- Apply typography roles strictly:
  - Orbitron: display anchors/headline emphasis only
  - Inter: default body/UI
  - IBM Plex Mono: technical accents/labels only

### Phase 5: Accessibility and Motion

- Validate heading order, landmarks, alt text, and decorative image handling.
- Ensure keyboard focus visibility and logical tab order.
- Respect reduced-motion preference for non-essential animations.
- Verify contrast against dark brand surfaces.

### Phase 6: Telemetry and Hardening

- Add minimal non-invasive events (hero CTA click, section milestone views).
- Exclude wallet-sensitive payload details.
- Run quality gates and resolve regressions.

## Quality Gates

All must pass before merge:

1. `pnpm lint`
2. `pnpm typecheck`
3. i18n parity check (`scripts/check-i18n-parity.ts` workflow)
4. `pnpm build`
5. Accessibility validation (keyboard, semantics, contrast, reduced motion)

## Delivery Boundaries

Included:
- Landing route UX/visual implementation
- EN/ES localized landing copy keys
- Wallet CTA state handling via existing abstraction
- Curated attached image integration through public assets

Excluded:
- Analytics pipeline/business logic modifications
- New provider integrations
- Back-end or Trigger.dev workflow changes
- Multi-chain feature expansion beyond v1 messaging

## Risks and Mitigations

- Risk: Asset-heavy hero degrades LCP.
  - Mitigation: Text-first render, optimized hero image strategy, defer non-critical media.
- Risk: EN/ES copy drift over iterations.
  - Mitigation: Key parity enforcement and bilingual review pass.
- Risk: CTA ambiguity across wallet states.
  - Mitigation: Explicit state matrix and acceptance checks for each state.
- Risk: DS boundary erosion through ad-hoc styles.
  - Mitigation: Restrict page composition to DS exports and tokenized styling.

## Handoff Task Sequence (Short)

1. Create section skeleton and semantic page structure.
2. Add landing i18n key map in EN/ES and wire all copy.
3. Integrate `useCabWallet` CTA state matrix.
4. Curate/move attached assets to `public/landing` and hook into sections.
5. Complete responsive, accessibility, and reduced-motion behavior.
6. Add minimal telemetry hooks.
7. Run all quality gates and fix findings.

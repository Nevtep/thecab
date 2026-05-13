# Feature Specification: Landing Page

**Feature Branch**: `002-landing-page`  
**Created**: 2026-05-13  
**Status**: Draft  
**Input**: User description: "Feature 1: Landing Page for The Cab"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Understand Value and Start Wallet Flow (Priority: P1)

As a new Aerodrome user arriving at The Cab, I need to understand what the product does in seconds and access a clear wallet connect entry point so I can move from landing to app onboarding confidently.

**Why this priority**: This is the first-value path for the product and the main conversion objective of the landing page.

**Independent Test**: Can be fully tested by loading the landing page on mobile and desktop, verifying value proposition comprehension from hero/content hierarchy, and triggering the connect CTA with all wallet states handled.

**Acceptance Scenarios**:

1. **Given** a first-time visitor lands on the page, **When** they view the hero section, **Then** they can identify The Cab as Aerodrome portfolio analytics (not trading/execution) and find a primary connect CTA above the first fold on mobile and desktop.
2. **Given** a disconnected wallet state, **When** the user activates the primary CTA, **Then** the app opens the existing wallet connection flow through the approved wallet abstraction.
3. **Given** a connected wallet on Base mainnet, **When** the user activates the primary CTA, **Then** the CTA routes to the app entry experience rather than a connect prompt.

---

### User Story 2 - Understand Product Model and Trust Boundaries (Priority: P2)

As a cautious DeFi user, I need a concise explanation of how The Cab works and what trust/privacy boundaries apply so I can decide whether to connect my wallet.

**Why this priority**: Trust and clarity are required to reduce hesitation for wallet connection in a crypto analytics product.

**Independent Test**: Can be fully tested by verifying the presence and readability of how-it-works and trust/privacy sections, with explicit non-custodial and read-only positioning.

**Acceptance Scenarios**:

1. **Given** a visitor scrolls the page, **When** they reach explanatory content, **Then** they see clear high-level sections for workflow, trust/privacy, and product scope boundaries.
2. **Given** a visitor evaluating risk, **When** they read trust content, **Then** they can identify that The Cab is analytics-first, does not execute trades, and does not request private keys.

---

### User Story 3 - Experience Localized, Accessible, Mobile-First Presentation (Priority: P3)

As an English- or Spanish-speaking visitor using varied devices and accessibility settings, I need content that is readable, localized, and accessible so I can understand and navigate the landing page without friction.

**Why this priority**: Localization and accessibility are core product commitments and mandatory quality gates for all user-facing surfaces.

**Independent Test**: Can be fully tested by switching locale and viewport sizes, running accessibility checks, and validating reduced-motion and keyboard navigation behavior.

**Acceptance Scenarios**:

1. **Given** browser language is Spanish, **When** the landing page loads, **Then** Spanish copy is shown for all defined keys and no English fallback appears where Spanish keys exist.
2. **Given** a keyboard-only user, **When** they tab through the page, **Then** focus order is logical, visible, and reaches all interactive elements.
3. **Given** reduced-motion preference is enabled, **When** the page renders and animates, **Then** non-essential motion is minimized while preserving content comprehension.

---

### Edge Cases

- Wallet provider unavailable or user rejects connection request.
- Connected wallet on unsupported chain (non-Base) during landing CTA flow.
- Slow network where images load progressively after text.
- Missing or stale translation keys for one locale.
- Small mobile viewport where hero media competes with primary CTA.
- User has JavaScript enabled but third-party wallet extension disabled.

## Requirements *(mandatory)*

### Functional Requirements

#### 1) Feature Summary

- **FR-001**: The system MUST provide a dedicated landing page that positions The Cab as a premium, aviation-inspired analytics control tower for Aerodrome users.
- **FR-002**: The landing page MUST be production-ready without requiring changes to protocol analytics logic.

#### 2) Product Goals and Non-Goals

- **FR-003**: The page MUST clearly communicate value proposition, connect path, analysis model overview, and trust/privacy posture.
- **FR-004**: The page MUST not present The Cab as a trading terminal, execution interface, or tax-reporting tool.
- **FR-005**: The page MUST remain within v1 scope messaging (Base mainnet primary scope) without introducing multi-chain behavior claims beyond current product support.

#### 3) User Stories and Success Criteria Mapping

- **FR-006**: Every major page section MUST map to at least one user story objective (value understanding, trust understanding, conversion to connect).
- **FR-007**: The implementation MUST support measurable outcomes defined in Success Criteria.

#### 4) Information Architecture of the Page

- **FR-008**: The page MUST include sections in this order: Hero, Value Proposition Blocks, How It Works, Trust and Privacy, CTA/Wallet State Area.
- **FR-009**: Hero section MUST include brand-aligned visual anchor, concise positioning copy, and primary/secondary CTAs.
- **FR-010**: Value proposition blocks MUST explain portfolio visibility, historical reconstruction, and coverage transparency.
- **FR-011**: How-it-works section MUST explain high-level steps from wallet connection to analysis surfaces without implementation internals.
- **FR-012**: Trust/privacy section MUST state read-only analytics posture, no private-key custody, and execution boundary.
- **FR-013**: CTA area MUST handle disconnected, connected, and unsupported-chain states with clear localized labels and outcomes.

#### 5) UX and Visual Requirements

- **FR-014**: Typography roles MUST follow: Orbitron for display anchors only, Inter for body/UI copy, IBM Plex Mono for technical accents only.
- **FR-015**: Spacing and density MUST use design-system spacing tokens and consistent vertical rhythm tuned for scanability.
- **FR-016**: Component sizing MUST preserve touch-target accessibility and balanced hierarchy across breakpoints.
- **FR-017**: Responsive behavior MUST be mobile-first and support mobile/tablet/desktop layouts with no hidden critical content.
- **FR-018**: Accessibility MUST satisfy semantic heading structure, keyboard access, visible focus, color contrast compliance, and reduced-motion support.
- **FR-019**: Visual implementation MUST use approved landing brand assets from the project landing asset set relocated into public serving paths as needed.

#### 6) Localization Requirements

- **FR-020**: All user-facing strings on the landing page MUST be sourced from translation keys (no hardcoded copy in components).
- **FR-021**: Landing namespace MUST define complete English and Spanish key parity prior to merge.
- **FR-022**: Browser language detection MUST resolve locale with English fallback behavior.
- **FR-023**: Translation resources MUST include section-level key groups for hero, value blocks, how-it-works, trust/privacy, CTA/wallet states, and accessibility labels.

#### 7) Technical Requirements

- **FR-024**: Landing page scope MUST be implemented within the app router page boundary and compose section components with clear concerns per section.
- **FR-025**: UI rendering MUST use The Cab DS components/tokens and MUST NOT bypass DS primitives with raw UI libraries for page composition.
- **FR-026**: Wallet CTA state handling MUST integrate through existing useCabWallet abstraction and support disconnected/connected/unsupported states.
- **FR-027**: Feature implementation MUST NOT add new data providers and MUST NOT modify analytics pipeline logic.
- **FR-028**: Feature implementation MUST pass lint, i18n parity check, typecheck, and build quality gates.

#### 8) Copy Requirements

- **FR-029**: Landing copy tone MUST be precise, technical, operational, crypto-native, and calm; hype/meme/casino phrasing is prohibited.
- **FR-030**: Required copy MUST be defined as translation key names, not as hardcoded literals in UI components.
- **FR-031**: Copy MUST explicitly preserve analysis-vs-execution separation and coverage/uncertainty honesty.

#### 9) Telemetry/Analytics Hooks (Minimal, Non-Invasive)

- **FR-032**: Landing telemetry is optional for v1. If implemented, it MUST be limited to non-sensitive interaction events (for example: hero CTA click, section view milestones).
- **FR-033**: Telemetry MUST avoid wallet-sensitive payloads and MUST not introduce tracking that conflicts with privacy messaging.

#### 10) Acceptance Criteria Categories

- **FR-034**: Acceptance criteria MUST be explicitly testable across functional, visual/brand, i18n, accessibility, and quality-gate dimensions.

#### 11) Out of Scope

- **FR-035**: Landing implementation MUST exclude analytics computations, protocol reconstructions, data-model extensions, and chain expansion work.

#### 12) Risks and Open Questions

- **FR-036**: Risks and open questions MUST be captured in this specification with mitigation guidance for implementation handoff.

### Constitution Alignment Requirements *(mandatory)*

- **CA-001 Brand**: Feature MUST preserve The Cab control-tower brand tone and avoid hype/casino/meme product language in user-facing surfaces.
- **CA-002 Localization**: Feature MUST define i18n namespace impact and prohibit hardcoded user-facing copy in UI.
- **CA-003 Localization Formatting**: Feature MUST specify locale-aware formatting impact for numbers/currency/percentages/dates where applicable.
- **CA-004 Chain Awareness**: Feature MUST keep wallet and chain state handling explicitly scoped to Base mainnet for v1 while preserving chain-aware state semantics.
- **CA-005 Provider Boundaries**: Feature MUST not introduce new provider ownership and must remain UI/presentation-only for landing concerns.
- **CA-006 Explainability**: Feature MUST describe trust boundaries and uncertainty/coverage messaging in plain language where relevant.

### Key Entities *(include if feature involves data)*

- **Landing Section**: A top-level content unit (hero, value, workflow, trust, CTA) with ordered placement, purpose, and localized copy key set.
- **Wallet CTA State**: View-state model for disconnected, connected-on-Base, and unsupported-chain users that determines CTA label and action.
- **Landing Translation Bundle**: Namespace-scoped set of English/Spanish keys for all landing copy, labels, accessibility text, and CTA states.
- **Landing Telemetry Event**: Minimal interaction event record for conversion and content engagement measurement without sensitive wallet details.

### Suggested Translation Key Map (landing namespace)

- `landing.meta.title`
- `landing.meta.description`
- `landing.hero.eyebrow`
- `landing.hero.title`
- `landing.hero.body`
- `landing.hero.primaryCta.disconnected`
- `landing.hero.primaryCta.connected`
- `landing.hero.primaryCta.unsupported`
- `landing.hero.secondaryCta`
- `landing.value.heading`
- `landing.value.blocks.portfolio.title`
- `landing.value.blocks.portfolio.body`
- `landing.value.blocks.history.title`
- `landing.value.blocks.history.body`
- `landing.value.blocks.coverage.title`
- `landing.value.blocks.coverage.body`
- `landing.howItWorks.heading`
- `landing.howItWorks.steps.connect.title`
- `landing.howItWorks.steps.connect.body`
- `landing.howItWorks.steps.analyze.title`
- `landing.howItWorks.steps.analyze.body`
- `landing.howItWorks.steps.inspect.title`
- `landing.howItWorks.steps.inspect.body`
- `landing.trust.heading`
- `landing.trust.readOnly.title`
- `landing.trust.readOnly.body`
- `landing.trust.noCustody.title`
- `landing.trust.noCustody.body`
- `landing.trust.scopeBoundary.title`
- `landing.trust.scopeBoundary.body`
- `landing.cta.heading`
- `landing.cta.body`
- `landing.cta.primary.disconnected`
- `landing.cta.primary.connected`
- `landing.cta.primary.unsupported`
- `landing.cta.supportText`
- `landing.walletState.disconnected`
- `landing.walletState.connectedBase`
- `landing.walletState.unsupportedChain`
- `landing.a11y.skipToContent`
- `landing.a11y.heroImageAlt`
- `landing.a11y.decorativeImageLabel`

### Recommended Component Composition Map

- `LandingPage` (route-level orchestrator)
- `LandingHeroSection`
- `LandingValueBlocksSection`
- `LandingHowItWorksSection`
- `LandingTrustPrivacySection`
- `LandingCtaSection`
- `LandingWalletCta` (state-based CTA behavior through wallet abstraction)
- `LandingSectionShell` (shared spacing/layout wrapper)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At least 90% of usability test participants can explain The Cab's value proposition and analytics-only scope within 20 seconds of viewing the hero section.
- **SC-002**: At least 85% of first-time visitors can identify and activate a wallet connect or continue CTA within 10 seconds on mobile and desktop.
- **SC-003**: 100% of user-facing landing copy is served via translation keys with English and Spanish parity verified by the project parity check.
- **SC-004**: Accessibility audit reports zero critical issues and no major keyboard-navigation blockers on the landing page.
- **SC-005**: Landing page quality gates (lint, typecheck, parity check, build) pass in CI for the feature branch.

## Assumptions

- Existing app providers, i18n setup, and wallet abstraction are stable and reusable without architectural changes.
- Branding images in the current landing asset set are approved for web usage and can be optimized/served from public paths.
- Browser language detection behavior is already integrated in the app and requires only namespace/key additions.
- Base mainnet remains the only active product chain for v1 user-facing wallet messaging.
- The git branch name created by hook is independent from spec directory naming and does not change feature scope.

## Definition of Done Checklist

- [ ] Landing route renders all required sections in defined information architecture order.
- [ ] Primary CTA supports disconnected, connected, and unsupported-chain wallet states.
- [ ] All landing copy and labels use translation keys only (no hardcoded component strings).
- [ ] English and Spanish landing keys are complete and parity check passes.
- [ ] Landing visuals use DS components/tokens and approved brand assets served from public paths.
- [ ] Mobile/tablet/desktop responsive behavior satisfies readability and interaction requirements.
- [ ] Accessibility requirements pass keyboard, contrast, semantic structure, and reduced-motion checks.
- [ ] Feature introduces no analytics pipeline logic changes and no new data providers.
- [ ] Lint, typecheck, i18n parity check, and build pass.

## Implementation Sequence (Engineering Handoff)

1. Establish landing route composition skeleton with section boundaries and DS layout shells.
2. Define landing i18n namespace keys in English and Spanish, then wire section components to keys only.
3. Integrate wallet CTA state handling through existing wallet abstraction for disconnected/connected/unsupported states.
4. Migrate approved branding assets into public landing paths and bind them to section visuals with responsive behavior.
5. Implement accessibility semantics, keyboard focus behavior, and reduced-motion handling across sections.
6. Add minimal telemetry hooks for key CTA and section visibility events without sensitive payloads.
7. Run lint, typecheck, i18n parity check, and build; resolve any deviations before merge.

## Out of Scope

- Protocol analysis computation changes.
- Provider integration changes or new provider onboarding.
- Any back-end pipeline or Trigger.dev workflow modifications.
- New wallet connector stack additions beyond existing abstraction.
- Multi-chain expansion behavior beyond Base v1 messaging and state handling.

## Risks and Open Questions

- **Risk**: Heavy visual assets may reduce mobile performance and LCP.
  **Mitigation**: Prioritize optimized asset sizes, responsive image selection, and text-first rendering.
- **Risk**: Inconsistent voice between EN and ES may dilute brand trust.
  **Mitigation**: Enforce copy review using existing EN/ES guidelines before release.
- **Risk**: Wallet unsupported-chain messaging may conflict with future multi-chain roadmap wording.
  **Mitigation**: Keep wording explicitly v1-scoped and avoid future-state guarantees.
- **Open Question**: Should telemetry include scroll-depth milestones or only explicit interaction events for v1 privacy simplicity?
- **Open Question**: Which subset of provided brand images should be considered mandatory for first release versus progressive enhancement?

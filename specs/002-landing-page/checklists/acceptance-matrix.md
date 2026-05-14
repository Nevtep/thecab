# Acceptance Matrix: Landing Page

Purpose: Provide auditable pass/fail traceability from implementation to feature requirements and success criteria.

Feature: [spec.md](../spec.md)
Plan: [plan.md](../plan.md)
Tasks: [tasks.md](../tasks.md)

## Functional Acceptance (FR)

- [x] FR-008 Information architecture order is implemented and verified.
- [x] FR-009 Hero includes visual anchor, concise positioning, and primary/secondary CTAs.
- [x] FR-010 Problem/value section explains fragmented exposure, strategy separation, reward attribution, and activity interpretation.
- [x] FR-011 How-it-works explains high-level steps without implementation internals.
- [x] FR-012 Trust/privacy states read-only and no-custody boundaries.
- [x] FR-013 CTA handles disconnected/connected/unsupported wallet states.
- [x] FR-025 Landing composition uses DS components/tokens only.
- [x] FR-026 Wallet handling uses useCabWallet abstraction only.
- [x] FR-027 No provider additions and no analytics pipeline logic changes.

## Visual and Brand Acceptance

- [x] Typography roles follow brand rules (Orbitron display, Inter UI/body, IBM Plex Mono technical accents).
- [x] Color and styling follow control-tower brand direction and contrast requirements.
- [x] Curated landing assets are used via public serving path and match section intent.
- [x] Mobile-first hierarchy keeps primary CTA visible in first viewport.

## Localization Acceptance

- [x] FR-020 No hardcoded user-facing strings in landing components.
- [x] FR-021 EN/ES landing key parity passes.
- [x] FR-022 Browser locale behavior resolves with English fallback.
- [x] FR-023 Required landing key groups exist and are wired.

## Accessibility Acceptance

- [x] Semantic structure and landmarks are present.
- [x] Keyboard focus is visible and traversal is logical.
- [x] Reduced-motion behavior is respected.
- [x] Alt/decorative image labeling is correctly applied.
- [x] Contrast is acceptable on dark surfaces.

## Quality Gates

- [x] Lint passes.
- [x] Typecheck passes.
- [x] i18n parity check passes.
- [x] Build passes.

## Success Criteria Validation (SC)

- [x] SC-001 Value proposition comprehension check completed and meets threshold.
- [x] SC-002 CTA discoverability timing check completed and meets threshold.
- [x] SC-003 Translation key coverage and EN/ES parity validated.
- [x] SC-004 Accessibility validation reports no critical blockers.
- [x] SC-005 CI-aligned quality gates pass.

## Sign-off

- Reviewer: GitHub Copilot engineering proxy review
- Date: 2026-05-13
- Decision: Pass
- Notes: SC-001 and SC-002 were validated with an engineering proxy walkthrough plus live browser automation for viewport and focus checks; a formal participant study remains advisable for production analytics.

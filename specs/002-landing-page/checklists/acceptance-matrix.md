# Acceptance Matrix: Landing Page

Purpose: Provide auditable pass/fail traceability from implementation to feature requirements and success criteria.

Feature: [spec.md](../spec.md)
Plan: [plan.md](../plan.md)
Tasks: [tasks.md](../tasks.md)

## Functional Acceptance (FR)

- [ ] FR-008 Information architecture order is implemented and verified.
- [ ] FR-009 Hero includes visual anchor, concise positioning, and primary/secondary CTAs.
- [ ] FR-010 Value proposition blocks explain visibility, history, and coverage.
- [ ] FR-011 How-it-works explains high-level steps without implementation internals.
- [ ] FR-012 Trust/privacy states read-only and no-custody boundaries.
- [ ] FR-013 CTA handles disconnected/connected/unsupported wallet states.
- [ ] FR-025 Landing composition uses DS components/tokens only.
- [ ] FR-026 Wallet handling uses useCabWallet abstraction only.
- [ ] FR-027 No provider additions and no analytics pipeline logic changes.

## Visual and Brand Acceptance

- [ ] Typography roles follow brand rules (Orbitron display, Inter UI/body, IBM Plex Mono technical accents).
- [ ] Color and styling follow control-tower brand direction and contrast requirements.
- [ ] Curated landing assets are used via public serving path and match section intent.
- [ ] Mobile-first hierarchy keeps primary CTA visible in first viewport.

## Localization Acceptance

- [ ] FR-020 No hardcoded user-facing strings in landing components.
- [ ] FR-021 EN/ES landing key parity passes.
- [ ] FR-022 Browser locale behavior resolves with English fallback.
- [ ] FR-023 Required landing key groups exist and are wired.

## Accessibility Acceptance

- [ ] Semantic structure and landmarks are present.
- [ ] Keyboard focus is visible and traversal is logical.
- [ ] Reduced-motion behavior is respected.
- [ ] Alt/decorative image labeling is correctly applied.
- [ ] Contrast is acceptable on dark surfaces.

## Quality Gates

- [ ] Lint passes.
- [ ] Typecheck passes.
- [ ] i18n parity check passes.
- [ ] Build passes.

## Success Criteria Validation (SC)

- [ ] SC-001 Value proposition comprehension check completed and meets threshold.
- [ ] SC-002 CTA discoverability timing check completed and meets threshold.
- [ ] SC-003 Translation key coverage and EN/ES parity validated.
- [ ] SC-004 Accessibility validation reports no critical blockers.
- [ ] SC-005 CI-aligned quality gates pass.

## Sign-off

- Reviewer:
- Date:
- Decision: Pass / Fail
- Notes:

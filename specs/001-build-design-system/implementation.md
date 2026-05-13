## Full Design System Implementation

Build the complete internal Design System before feature pages, so all product UI is delivered through Cab wrappers over Tamagui, Lucide, Recharts, and localized formatting contracts. This plan is sequenced to satisfy spec boundaries first, then components, then migration and enforcement.

**Phase 1: Foundation (blocks all)**
1. Establish DS governance and boundaries:
Define DS as the only UI import surface for product screens.
Adopt strict rule: no direct Tamagui, Lucide, Recharts imports outside DS internals.
2. Expand design tokens to full brand system:
Implement full brand, surface, text, semantic, spacing, radius, shadow, and z-index tokens.
3. Integrate font requirements:
Wire Orbitron for display, Inter for UI/body, IBM Plex Mono for technical data.
Ensure tabular numerals for financial and technical values.
4. Add DS runtime dependencies and lock versions:
Install and pin icon/chart dependencies and verify compatibility with current stack.

**Phase 2: Primitive and Core Wrappers**
1. Build primitive wrappers:
CabBox, CabText, CabStack, CabButton, CabCard, CabInput, CabBadge, CabSeparator, CabTooltip.
2. Build icon abstraction:
CabIcon plus semantic icon registry and tone/size mappings.
3. Build core feedback wrappers:
CabEmptyState, CabLoadingPanel, CabErrorPanel with prop-driven i18n text.

**Phase 3: Layout System**
1. Implement shells and structural components:
Disconnected shell, connected shell, sidebar, top nav, dashboard grid, section header.
2. Implement navigation controls:
Sidebar item, lock state, analysis CTA, range selector, filter bar.
3. Encode section lock/unlock states and analysis CTA behavior from spec.

**Phase 4: Data Display System**
1. Implement value and status components:
Metric card, KPI strip, data panel, chart panel, coverage badge, analysis status badge.
2. Implement value format wrappers:
USD value, token amount, wallet address, tx hash components.
3. Enforce locale-aware formatters and no hardcoded product copy in DS internals.

**Phase 5: Chart Wrapper System**
1. Implement base chart wrappers:
Chart frame, line, area, bar, donut wrappers with typed series contracts.
2. Implement domain chart wrappers:
Portfolio evolution, pool value, rewards timeline, rebalance timeline.
3. Enforce instrumentation visual style:
Dark backgrounds, subtle grid, tokenized palette, restrained semantic colors.

**Phase 6: Domain UI Components**
1. Build DeFi-specific DS components:
Pool card, deposit card, strategy card, reward timeline, activity row, rebalance marker, residual attribution panel.
2. Keep these presentational-only and fed by containers/view-models.

**Phase 7: Integration Migration**
1. Migrate existing UI usage to DS exports:
Start with landing and app shell.
2. Remove direct raw component usage in product files.
3. Keep feature logic unchanged while swapping visual components to DS.

**Phase 8: Enforcement and Quality Gates**
1. Add lint/import guardrails:
Block direct third-party UI imports in product code.
2. Add DS checks:
No hardcoded brand hex values in product screens, i18n compliance, formatter compliance.
3. Add accessibility and responsive checks for core component families.

**Phase 9: Verification and Freeze**
1. Run typecheck, lint, build.
2. Run DS-focused tests:
Primitive render tests, chart prop mapping tests, key layout snapshot checks.
3. Execute spec traceability review:
Confirm DS acceptance criteria are fully met before feature page work starts.

**Parallelization**
1. After primitives are stable, layout and data-display phases can run in parallel.
2. Chart base wrappers and domain chart wrappers can be split in parallel after base chart contracts are set.
3. Integration migration should start only after primitives plus layout plus core data-display are stable.

**Scope boundaries**
1. Included:
Complete DS infrastructure, wrappers, domain presentation components, migration, and enforcement.
2. Excluded:
Feature business logic, analytics computation logic, backend/domain pipeline changes.

**Primary spec anchors used**
1. Design system boundary and required families in [docs/the-cab-product-technical-spec.md](docs/the-cab-product-technical-spec.md)
2. i18n/component architecture constraints in [docs/the-cab-feature-feasibility-implementation-architecture.md](docs/the-cab-feature-feasibility-implementation-architecture.md)
3. Brand palette and typography rules in [docs/the-cab-brand-spec.md](docs/the-cab-brand-spec.md)
4. Current implementation baselines in [apps/web/tamagui.config.ts](apps/web/tamagui.config.ts), [apps/web/src/app/globals.css](apps/web/src/app/globals.css), [apps/web/src/app/providers.tsx](apps/web/src/app/providers.tsx), [apps/web/src/providers/tamagui-provider.tsx](apps/web/src/providers/tamagui-provider.tsx), [apps/web/src/i18n/config.ts](apps/web/src/i18n/config.ts), [apps/web/src/i18n/formatters.ts](apps/web/src/i18n/formatters.ts), [apps/web/src/app/page.tsx](apps/web/src/app/page.tsx), [apps/web/package.json](apps/web/package.json)
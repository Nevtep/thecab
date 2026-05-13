# Research: Full Design System Implementation

## Decision 1: Establish a single DS public import surface at apps/web/src/design-system/index.ts

- Decision: Create a dedicated design-system root with layered subfolders and a single public export barrel consumed by product screens.
- Rationale: Enforces architecture boundaries and allows strict lint guardrails against direct third-party UI imports.
- Alternatives considered:
  - Keep wrappers colocated in feature folders: rejected because boundaries are hard to enforce.
  - Export multiple barrels per domain only: rejected because import policy becomes fragmented.

## Decision 2: Keep DS as presentation-only and chain-agnostic

- Decision: DS components accept display props only; no provider access, chain logic, or business reconstruction logic.
- Rationale: Preserves constitution rules on chain-aware domain integrity and provider/API discipline.
- Alternatives considered:
  - Let DS resolve query/provider states internally: rejected because it couples UI to backend boundaries.
  - Allow chain-specific display logic in DS: rejected because this leaks domain policy into presentation.

## Decision 3: Extend Tamagui tokens to full brand system and mirror critical tokens in global CSS variables

- Decision: Expand token sets for brand/surface/text/semantic/spacing/radius/elevation/z-index; keep typography and numeric rules centralized.
- Rationale: Needed for consistent wrappers and instrumentation-style chart/display surfaces.
- Alternatives considered:
  - Keep minimal token set and inline style values in components: rejected due to drift risk.
  - Use CSS-only tokens without Tamagui token expansion: rejected because wrappers rely on Tamagui primitives.

## Decision 4: Use Next font integration for Orbitron, Inter, IBM Plex Mono with role-based DS typography contracts

- Decision: Load fonts once at app root and expose role-based usage through CabText/value wrappers.
- Rationale: Meets brand spec while avoiding scattered font declarations.
- Alternatives considered:
  - Keep current fallback system font stack: rejected due to brand non-compliance.
  - Apply fonts ad hoc per component: rejected because consistency and performance degrade.

## Decision 5: Add Lucide and Recharts as DS-internal dependencies only

- Decision: Pin Lucide and Recharts versions in web package and restrict their imports to DS internals.
- Rationale: Required by requested library boundary while preserving migration safety.
- Alternatives considered:
  - Keep icons/charts out of DS and use raw packages in product screens: rejected by scope constraints.
  - Introduce additional chart/icon libraries: rejected because user requested defined libraries only.

## Decision 6: Implement icon abstraction via semantic registry and tone/size mappings

- Decision: Build CabIcon with semantic names, tokenized tones, and standard sizes mapped to Lucide internals.
- Rationale: Prevents inconsistent icon selection and isolates vendor API dependency.
- Alternatives considered:
  - Export raw Lucide components from DS: rejected because semantic control is lost.
  - Map icons by route-specific local constants only: rejected because duplication grows quickly.

## Decision 7: Implement typed chart wrappers with DS-owned visual defaults

- Decision: Build base chart wrappers (line/area/bar/donut) with typed series contracts and fixed instrumentation style defaults.
- Rationale: Ensures consistency across dashboard surfaces and reduces duplicated chart config code.
- Alternatives considered:
  - Let each feature pass arbitrary Recharts props: rejected due to style drift.
  - Build only domain charts without reusable base wrappers: rejected because contract reuse is needed.

## Decision 8: Enforce DS boundaries with lint rules and compliance checks

- Decision: Use ESLint guardrails to block direct imports of tamagui, @tamagui/*, lucide-react, recharts outside DS internals; add checks for hardcoded brand hex and hardcoded UI copy in product screens.
- Rationale: Prevents post-migration regressions.
- Alternatives considered:
  - Rely on code review only: rejected because enforcement is not deterministic.
  - Runtime-only checks: rejected because failures should occur before merge.

## Decision 9: Verification should run through existing project pipelines plus DS-focused checks

- Decision: Keep verification centered on typecheck, lint, build, i18n parity, and DS-focused render/contract/snapshot checks aligned with current tooling.
- Rationale: Minimizes toolchain churn while still meeting freeze requirements.
- Alternatives considered:
  - Add large new test framework in this feature: rejected because not required to satisfy DS boundary goals.
  - Skip DS-focused checks and rely only on build: rejected because acceptance criteria require component-level validation.

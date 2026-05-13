# Data Model: Full Design System Implementation

## Entity: DesignTokenSet

- Description: Canonical source of style tokens consumed by DS wrappers.
- Fields:
  - tokenGroup: brand | surface | text | semantic | spacing | radius | shadow | zIndex | typography
  - tokenName: string
  - tokenValue: string | number
  - usageNotes: string
  - sourceSpec: brand spec reference
- Validation:
  - Required token groups must all exist.
  - Semantic tokens must include success, warning, danger, info.
  - Typography tokens must include display/ui/dataAccent roles.

## Entity: DsComponentContract

- Description: Public API contract for each Cab wrapper component.
- Fields:
  - componentName: string
  - family: primitive | feedback | layout | dataDisplay | chart | domain
  - propsSchema: typed prop shape
  - i18nMode: propDriven | localNamespace
  - formatterUsage: required | optional | none
  - accessibilityBaseline: list of required behaviors
  - responsiveBehavior: breakpoint expectations
- Validation:
  - Component must not require business logic props unrelated to rendering.
  - User-facing labels must resolve via i18n path.

## Entity: DsExportSurface

- Description: Allowed import entrypoints for product code.
- Fields:
  - publicEntry: apps/web/src/design-system/index.ts
  - subEntries: optional family-level barrels
  - forbiddenDirectImports: tamagui | @tamagui/* | lucide-react | recharts
  - exceptions: DS internals and bootstrap providers only
- Validation:
  - Product files import only from DS public entrypoints.
  - Forbidden package imports are lint errors.

## Entity: DsChartSeriesContract

- Description: Typed series and data-shape contract used by base/domain chart wrappers.
- Fields:
  - chartKind: line | area | bar | donut
  - dataPointShape: typed object with x axis key and numeric series keys
  - seriesConfig: labelKey, seriesKey, tone, stroke/fill options
  - displayState: loading | ready | empty | error
  - localeHooks: formatter hooks for tick/tooltip labels
- Validation:
  - Series keys must exist in data.
  - Colors map to tokenized palette only.
  - Empty/error states must be renderable without crashes.

## Entity: DsComplianceRule

- Description: Static checks ensuring DS governance and localization/formatting compliance.
- Fields:
  - ruleId: string
  - category: imports | i18n | formatting | branding | accessibility | responsive
  - enforcementLayer: lint | script | test
  - targetScope: productFiles | dsFiles | both
  - failureMessage: string
- Validation:
  - Import rules block forbidden packages outside DS internals.
  - i18n rules flag hardcoded UI copy in product screens.
  - branding rules flag non-token brand hex usage in product files.

## Entity: DsMigrationScope

- Description: Tracks migration targets and completion state without changing logic.
- Fields:
  - surface: landing | appShell | navigation | dashboard primitives
  - sourceFiles: list
  - replacementComponents: list
  - logicChangeAllowed: boolean (must be false)
  - migrationStatus: pending | inProgress | done
- Validation:
  - Migration diff must be presentation-only.
  - Behavior and interaction semantics remain unchanged.

## Relationships

- DesignTokenSet -> DsComponentContract: components consume token groups.
- DsComponentContract -> DsExportSurface: only contracted components are exported publicly.
- DsChartSeriesContract -> DsComponentContract: chart components implement chart contract.
- DsComplianceRule -> DsExportSurface: import rules enforce surface boundaries.
- DsMigrationScope -> DsComponentContract: migration maps legacy UI usage to contracted DS components.

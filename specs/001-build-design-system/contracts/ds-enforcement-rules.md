# Contract: DS Enforcement Rules

## Rule Set

### Rule ER-001: Import Boundary

- Category: imports
- Enforcement: ESLint
- Requirement:
  - Block direct imports of tamagui, @tamagui/*, lucide-react, recharts in product files.

### Rule ER-002: Brand Token Integrity

- Category: branding
- Enforcement: lint/script
- Requirement:
  - Product screens must not hardcode brand hex values.
  - Use DS tokens or theme variables instead.

### Rule ER-003: i18n Compliance

- Category: localization
- Enforcement: lint/script
- Requirement:
  - No hardcoded user-facing copy in product screens.
  - DS internals must accept display labels by props or i18n key mapping.

### Rule ER-004: Formatter Compliance

- Category: formatting
- Enforcement: lint/script/test
- Requirement:
  - Financial and technical values use locale-aware wrappers/formatters.
  - Direct manual number/date formatting in product screens is disallowed when wrapper exists.

### Rule ER-005: Accessibility and Responsiveness

- Category: quality
- Enforcement: tests/review checklist
- Requirement:
  - Core DS families include baseline accessibility semantics and responsive layout behavior.

## Failure Policy

- Any ER rule violation blocks merge for DS migration scope.

## Scope

- Applies to apps/web/src/app and product presentation code.
- DS internals are responsible for wrapper implementation details.

# Contract: DS Export Surface

## Purpose

Define the only approved UI import surface for product screens.

## Public Entry Points

- Primary: apps/web/src/design-system/index.ts
- Optional family barrels (re-exported by primary):
  - apps/web/src/design-system/primitives/index.ts
  - apps/web/src/design-system/layout/index.ts
  - apps/web/src/design-system/data-display/index.ts
  - apps/web/src/design-system/charts/index.ts
  - apps/web/src/design-system/domain/index.ts

## Restricted Imports Outside DS Internals

The following packages are forbidden outside DS internals and approved bootstrap files:

- tamagui
- @tamagui/*
- lucide-react
- recharts

## Allowed Exceptions

- DS internal implementation files under apps/web/src/design-system/**
- apps/web/tamagui.config.ts
- apps/web/src/providers/tamagui-provider.tsx

## Compliance Rule

- Product feature files importing forbidden packages directly MUST fail lint.
- Product feature files MUST import wrappers from DS export surface only.

## Acceptance

- Landing and app shell imports are DS-only after migration.
- No direct third-party UI imports remain in product screens.

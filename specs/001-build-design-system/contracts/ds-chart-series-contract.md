# Contract: DS Chart Series Contract

## Purpose

Standardize data/series contracts for chart wrappers to ensure consistency, locale-aware formatting, and instrumentation visual style.

## Base Data Contract

Data point requirements:

- xKey: timestamp or categorical bucket key
- y series keys: numeric or null values

Example shape:

- { timestamp: string | number, valueA: number | null, valueB: number | null }

## Series Contract

Series requirements:

- key: string (must exist in data)
- label: localized label input
- tone: token-based tone identifier
- kind options by chart type:
  - line: strokeWidth, strokeStyle
  - area: fillOpacity, stackGroup
  - bar: stackGroup, cornerRadius
  - donut: segment order, legend label

## Wrapper States

Each wrapper must support these display states:

- loading
- ready
- empty
- error

Each state must be renderable without runtime crashes when data is absent.

## Styling Rules

- Backgrounds: dark instrumentation style from DS tokens.
- Grid lines: subtle and low-noise.
- Colors: tokenized palette only.
- Semantic overlays: restrained usage for success/warning/danger/info.

## Localization and Formatting

- Axis ticks, tooltip values, and legends use locale-aware formatting wrappers.
- User-facing chart labels are passed as localized strings from containers.

## Non-Goals

- No business logic or analytics computation in chart wrappers.
- No provider or chain logic in chart wrappers.

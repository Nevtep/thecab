# Deposits Audit Hygiene Note

This note is intended to be attached to the PR description for feature `010-deposits-lifecycle`.

## Implementation Gate

- [x] CA-001 Brand
  Evidence: T091, T060, and T078 in [tasks.md](./tasks.md). The deposits surface keeps Cab Gold limited to the primary explorer CTA and the total-return reconciliation row, uses Signal Teal for positive and in-range states, and keeps unattributed or negative states on neutral or warning/danger tokens.
- [x] CA-002 i18n parity
  Evidence: T047 and T089 in [tasks.md](./tasks.md). The `deposits`, `coverage`, `charts`, `common`, `navigation`, and `errors` namespaces were completed in both `en` and `es`, then checked with the existing parity and hardcoded-copy gates.
- [x] CA-003 Formatters
  Evidence: T025 and T036 in [tasks.md](./tasks.md). Deposits list and detail rendering stays on shared locale-aware formatters for signed USD, signed percent, token amounts, dates, and covered ranges; feature components do not format user-facing numerics ad hoc.
- [x] CA-004 Chain-aware
  Evidence: T092 in [tasks.md](./tasks.md). API routes, request validation, query keys, URL state, and read-model access remain chain-scoped with `chainId` carried end to end.
- [x] CA-005 Provider boundary
  Evidence: T093 in [tasks.md](./tasks.md). Deposits routes, services, repositories, and feature UI remain DB-only; provider access stays centralized in the analysis engine and supporting provider modules.
- [x] CA-006 Explainability
  Evidence: T049, T051, T060, and T078 in [tasks.md](./tasks.md). Coverage and confidence remain visible inline, decomposition keeps an explicit unattributed component with reason-code tooltips, capital-flow tooltips cite event price source, and rebalance or IL contributions are surfaced per event.

## URL State Compliance

- [x] FR-024 honored
  Evidence: T016, T017, T041, and T084 in [tasks.md](./tasks.md). Filters, sort, pagination, and `selectedDepositId` round-trip through the URL and survive navigation and live refresh.
- [x] FR-024a honored
  Evidence: T016a and T041 in [tasks.md](./tasks.md). Density and visible columns are stored only in wallet-and-chain-scoped `localStorage` preferences and are explicitly excluded from URL parse and serialize behavior.

## Review Gate

- [x] Constitutional review coverage is present across branding, localization, chain safety, provider discipline, and explainability.
- [x] No known constitutional violations remain in the implemented deposits feature.
- [ ] Runtime-only validation remains outside this note: T087 and T088 in [tasks.md](./tasks.md) still require an authenticated injected-wallet session with analyzed manual deposits and warm local DB data.
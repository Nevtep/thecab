# Contract: Pools UI

**Feature**: `009-pools-history`  
**Date**: 2026-05-25  
**Scope**: Routed UI behavior, gating, layout, and visual-density contract for the Pools feature.

## 1. Routing And Gating

- `/pools` is the main analyzed Pools route.
- `/pools/[poolId]` is the pool detail route.
- Navigation unlocks Pools when canonical analysis status is `ready`.
- Before analysis is ready, direct visits render a gated state explaining that Pools requires analyzed history.
- After Pools has been unlocked, stale refreshes may continue showing the last successful analyzed data while background refresh runs.
- Pools becomes a real destination; other deep sections may remain placeholder-backed until their own features land.

## 2. Shared Shell Contract

- Pools reuses `ConnectedShell`, `CabSidebar`, `CabTopNav`, and the existing connected navigation model.
- Sidebar item state for Pools changes from `comingSoon` to `active` with a real `href` once analysis is ready.
- Top bar includes at minimum page title, covered-range context, and refresh or analysis status affordances where appropriate.

## 3. Pools List Layout

The list route should present a dense control-surface composition, visually aligned with the provided reference:

```text
Pools List
├── KPI rail
│   ├── active pool count
│   ├── current pool value
│   ├── rewards total
│   ├── weighted return / APR
│   └── coverage / active-range signal
├── filter/search bar
├── pools table or list cards
└── optional right-rail selection preview on large screens
```

### Visual contract

- KPI cards should use strong numeric hierarchy and may include sparklines or compact trend accents.
- Filters should feel like analytical controls, not marketing chips.
- The primary list should show dense but legible columns/cards for value, rewards, return, active range, and coverage.
- Coverage, active-range state, and exposure mix must be visible at row level.

## 4. Pool Detail Layout

The detail route should use a visually rich stacked dashboard with side-panel behavior on wide screens:

```text
Pool Detail
├── header / current status strip
├── KPI rail
├── main chart area
│   └── total / deployed / residual / rewards series with event markers
├── segment breakdown
│   ├── manual exposure
│   ├── automated strategy exposure
│   └── residual attribution
├── current composition panel
├── performance and rewards panels
├── lifecycle / rebalance / redeploy timeline
└── related deposits / strategies links
```

### Visual contract

- The header should feel operational and data-rich, not decorative.
- Charts must use restrained cyan, blue, gold, success, warning, and danger accents consistent with the brand palette.
- Event markers and notices must call out rebalances, redeploys, capital moves, and partial attribution clearly.
- Side panels may be used for current composition, selected metric detail, or active range context on desktop.

## 5. Responsive Behavior

- Desktop should support a master/detail feel, including dense list rows and right-side or stacked secondary panels.
- Tablet should collapse non-essential side panels beneath the main chart while keeping KPI rail visible.
- Mobile should stack KPI cards, filters, list cards, and detail panels vertically without hiding coverage state or segment distinctions.
- No responsive mode may collapse manual, automated, and residual exposure into one unlabeled block.

## 6. Data Presentation Rules

- Current state, historical series, and lifecycle timeline must be visually distinct.
- Partial, share-level, and estimated values must remain labeled anywhere they appear.
- If history is shorter than one year, the selected and covered range must be obvious in the UI.
- Timeline rows must support grouped rebalance/redeploy explanations and partial attribution notices.

## 7. Empty, Gated, And Error States

- **Gated**: analysis not ready.
- **Empty**: analysis ready but no pool participation reconstructed.
- **Error**: internal API failure or invalid route scope.
- **Partial**: route data available with visible coverage warnings.

These states must preserve The Cab's control-tower tone and avoid generic framework placeholders.
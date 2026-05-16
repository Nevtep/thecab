# UI/UX Audit Report — The Cab

**Date:** 2026-05-16 · **Scope:** `apps/web` landing, overview, design system

## Scorecard (post-remediation target)

| Area | Status |
|------|--------|
| Design system | Mature Cab* layer with ESLint boundary |
| Landing | Responsive + a11y landmarks; media containment via `CabMediaFrame` |
| Overview | Adaptive `ConnectedShell` (drawer &lt;768px) |
| Tokens | `cabColors` → Tamagui + CSS variables |
| A11y CI | `ds:contrast`, Playwright smoke, jsx-a11y |

## Image matrix (landing)

| Section | Asset ratio | Fit | Container |
|---------|-------------|-----|-----------|
| Hero visual | 4:3 | contain | `CabMediaFrame` |
| Value blocks | 1:1 | contain | aspect-ratio 1/1 |
| Product promise | 4:3 | contain | aspect-ratio 4/3 |
| How it works | 16:9 | contain | aspect-ratio 16/9 |
| Model clarity | 4:3 | contain | aspect-ratio 4/3 |
| Activity | 16:9 | contain | aspect-ratio 16/9 |
| Trust / coverage | 1:1 | contain | aspect-ratio 1/1 |
| Backgrounds | 16:9 | cover | decorative only |

## Verification viewports

375px, 390px, 768px, 1024px, 1440px (portrait + landscape). Goal: no horizontal scroll without relying solely on `overflow-x: hidden`.

## Commands

```bash
cd apps/web
pnpm ds:check      # color semantics + contrast + hex inventory
pnpm test:a11y     # Playwright smoke
```

See [docs/design-system/MASTER.md](./design-system/MASTER.md) for ongoing rules.

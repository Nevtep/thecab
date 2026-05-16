# The Cab — Web App

Portfolio command cabin for Aerodrome on Base.

## Stack

- **Next.js 16** (App Router, webpack)
- **React 19**
- **Tamagui 2 RC** — internal **Cab\*** design system
- **wagmi / viem** — wallet
- **TanStack Query** — server state
- **i18next** — EN / ES
- **Recharts** — charts (via DS wrappers only)
- **GSAP** — landing “How it works” stepper (reduced-motion safe)

## Scripts

```bash
pnpm dev          # local dev server
pnpm build        # production build
pnpm lint         # ESLint (includes jsx-a11y)
pnpm typecheck    # TypeScript
pnpm i18n:check   # locale key parity
pnpm ds:check     # DS color semantics + WCAG contrast + hex inventory
pnpm ds:contrast  # contrast pairs only
pnpm test:a11y    # Playwright smoke + axe (requires build)
```

## Design system

- Tokens: `src/design-system/tokens/`
- Master rules: `docs/design-system/MASTER.md`
- Product code must import UI from `@/design-system` only (see `eslint.config.mjs`).

## UI/UX audit

See `docs/ui-ux-audit-report.md` for the latest audit scope and verification viewports.

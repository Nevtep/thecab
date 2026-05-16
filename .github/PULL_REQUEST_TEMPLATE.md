## Summary

## Test plan

- [ ] `pnpm ds:check` (color semantics + WCAG contrast + hex inventory)
- [ ] `pnpm typecheck` and `pnpm lint`
- [ ] `pnpm test:a11y` (Playwright + axe smoke)
- [ ] Manual: landing at 375px / 768px / 1440px — no horizontal scroll, images contained
- [ ] Manual: overview drawer navigation on mobile

## UI/UX pre-delivery (The Cab)

- [ ] Focus visible on DS controls (`cab-focus.css`)
- [ ] Touch targets ≥44px for primary actions
- [ ] `html lang` matches locale
- [ ] Charts have accessible name / summary
- [ ] No emoji icons; Lucide via `CabIcon` only

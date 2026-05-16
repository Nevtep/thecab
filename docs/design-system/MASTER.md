# The Cab — Design System Master

> **Source of truth:** [docs/the-cab-brand-spec.md](../the-cab-brand-spec.md) overrides generic tooling recommendations.
> Page overrides: `design-system/pages/[page-name].md` when present.

**Project:** The Cab · **Theme:** Dark-only control tower · **Stack:** Next.js + Tamagui (Cab* DS)

---

## Brand positioning

Technical, futuristic, precise, premium, crypto-native, aviation-inspired, dashboard-first. Not playful, not generic SaaS, not neon cyberpunk.

## Color tokens (canonical — `apps/web/src/design-system/tokens/colors.ts`)

| Role | Token | Hex |
|------|-------|-----|
| Background | `brand.cabNight` | `#040F1C` |
| Surface | `surface.darkSurface` | `#111A27` |
| Elevated | `surface.elevatedSurface` | `#1A2233` |
| Border | `surface.border` | `#2A3347` |
| Text primary | `text.primary` | `#EAF1FF` |
| Text secondary | `text.secondary` | `#B8C7E6` |
| Text muted | `text.muted` | `#6B7A98` |
| Accent signal | `brand.signalTeal` | `#00E0E1` |
| Accent gold | `brand.cabGold` | `#F2C14E` |
| Primary CTA fill | `action.primaryBg` | `#F2C14E` |
| Success / danger | `semantic.success` / `semantic.danger` | `#22C55E` / `#EF4444` |

**Rules:** No cyan-filled primary CTAs. Gold for primary actions. Teal for technical accents and focus rings.

## Typography

| Role | Font | CSS variable |
|------|------|--------------|
| Display / headings | Orbitron | `--font-orbitron` |
| UI / body | Inter | `--font-inter` |
| Data / mono | IBM Plex Mono | `--font-ibm-plex-mono` |

Body minimum **16px** on mobile inputs. Caption minimum **12px**; avoid for long-form body.

## Spacing

4/8dp rhythm via Tamagui tokens (`$1` = 8px base). Section gaps: 24–48px.

## Touch targets

| Size | Min height | Notes |
|------|------------|-------|
| `sm` | 36px | + hitSlop to 44px where needed |
| `md` | 44px | Default |
| `lg` | 48px | Primary mobile CTAs |

## Focus

Visible `:focus-visible` — 2px `signalTeal` outline, 4px offset. Applied globally via `cab-focus.css` / DS primitives.

## Motion

- Micro-interactions: **150–300ms**, ease-out enter / ease-in exit
- Respect `prefers-reduced-motion: reduce` — disable non-essential animation
- Tokens: `cabMotion.duration.fast` (150ms), `normal` (220ms), `slow` (300ms)

## Media / images

Use `CabMediaFrame` with intrinsic dimensions from `landingAssets`. Match `aspect-ratio` to asset; `contain` for diagrams, `cover` for decorative backgrounds only.

## Layout breakpoints

| Name | Width | Usage |
|------|-------|-------|
| `sm` | &lt;768px | Drawer nav, single column |
| `md` | 768–1023px | Collapsed sidebar rail |
| `lg` | ≥1024px | Full sidebar 300px |

## Accessibility checklist (pre-merge)

- [ ] Contrast AA 4.5:1 body text (`pnpm ds:contrast`)
- [ ] Focus visible on all interactive DS components
- [ ] `html lang` matches i18n locale
- [ ] Charts have `aria-label` + data summary
- [ ] No horizontal scroll at 375px without relying on `overflow-x: hidden`
- [ ] Icon-only controls have `aria-label`

## Anti-patterns

- Emoji as icons
- Hardcoded brand hex in product screens (use tokens / CSS vars)
- `minmax(320px, …)` grid columns on mobile
- `Image fill` without container `aspect-ratio`
- Light mode (out of scope v1)

## Light mode

**Not supported** in v1. Dark theme only.

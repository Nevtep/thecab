# The Cab — Brand Specification v1

## Purpose

This document defines the **brand system** for **The Cab** so design and implementation can stay aligned with minimal drift.

It is intended for:
- product design
- UI implementation
- Copilot / AI-assisted coding
- future dashboard and marketing surfaces

This brand spec is based on the selected visual direction: **Option 3**.

---

## Brand positioning

**The Cab** should feel:

- technical
- futuristic
- precise
- premium
- crypto-native
- aviation-inspired
- dashboard-first

It should **not** feel:

- playful
- editorial
- soft
- lifestyle-oriented
- generic SaaS
- neon cyberpunk chaos
- retail-trading gimmick

The visual identity should evoke:

- airport control tower
- avionics / HUD systems
- professional monitoring software
- DeFi analytics terminal
- disciplined, trustworthy capital control

---

## Core brand concept

The Cab is a **control tower for on-chain portfolios**.

This means the visual system should communicate:

- oversight
- signal clarity
- navigation
- capital flow monitoring
- technical confidence
- operational awareness

The UI should feel like a **premium control surface**, not a casual crypto dashboard.

---

## Visual direction

### Chosen direction
**Dark futuristic control-tower aesthetic with gold + cyan accents**

### Key visual motifs
- control tower / cab
- radar arcs
- aviation instrumentation
- thin technical lines
- clean data panels
- premium dark glass surfaces
- subtle glow
- high-contrast KPI presentation

### Avoid
- oversized gradients everywhere
- rainbow analytics
- meme-crypto aesthetics
- too much glassmorphism blur
- cluttered futuristic noise
- sci-fi movie UI tropes that reduce usability

---

## Logo direction

The logo should combine:

- a **control tower silhouette** or abstract tower mark
- **wing / aviation geometry**
- a compact, technical wordmark

### Logo characteristics
- symmetrical
- geometric
- clean
- strong vertical center
- minimal ornament
- recognizable at small sizes

### Wordmark style
- uppercase preferred
- moderately extended width
- clean futuristic spacing
- not overly decorative

### Logo usage
Primary:
- gold mark + white/near-white wordmark on dark background

Secondary:
- cyan/teal accent for highlights only

Monochrome:
- white on dark
- dark navy on light

---

## Color palette

### Brand core

#### Cab Night
Primary background / master brand color.

- `#040F1C`

#### Deep Space
Large dark surfaces, hero backgrounds, dashboard shell.

- `#0F1826`

#### Control Blue
Secondary dark blue for depth and gradients.

- `#15233A`

#### Signal Teal
Primary interactive accent and chart highlight.

- `#00E0E1`

#### Electric Blue
Secondary bright data accent.

- `#3B82F6`

#### Cab Gold
Premium aviation accent for identity and important highlights.

- `#F2C14E`

---

### Surface system

#### Dark Surface
Default card and panel surface.

- `#111A27`

#### Elevated Surface
Raised surface / modal / selected panel.

- `#1A2233`

#### Border
Subtle line and divider color.

- `#2A3347`

---

### Text colors

#### Text Primary
Main foreground text.

- `#EAF1FF`

#### Text Secondary
Secondary labels and supporting UI copy.

- `#B8C7E6`

#### Text Muted
Low-emphasis captions and timestamps.

- `#6B7A98`

---

### Semantic colors

#### Success
Positive PnL, healthy status, completed state.

- `#22C55E`

#### Warning
Partial coverage, stale state, attention required.

- `#FBBF24`

#### Danger
Failure, unsupported state, negative move, error.

- `#EF4444`

#### Info
Informational state, sync, neutral technical notice.

- `#38BDF8`

---

## Color tokens

```json
{
  "brand": {
    "cabNight": "#040F1C",
    "deepSpace": "#0F1826",
    "controlBlue": "#15233A",
    "signalTeal": "#00E0E1",
    "electricBlue": "#3B82F6",
    "cabGold": "#F2C14E"
  },
  "surface": {
    "darkSurface": "#111A27",
    "elevatedSurface": "#1A2233",
    "border": "#2A3347"
  },
  "text": {
    "primary": "#EAF1FF",
    "secondary": "#B8C7E6",
    "muted": "#6B7A98"
  },
  "semantic": {
    "success": "#22C55E",
    "warning": "#FBBF24",
    "danger": "#EF4444",
    "info": "#38BDF8"
  }
}
```

---

## Color usage rules

### Use dark colors for structure
Dark tones should dominate the UI:
- shell
- nav
- layout background
- cards
- charts
- modal chrome

### Use cyan and blue for signal
Use bright cool tones for:
- active tabs
- line charts
- selected state
- links
- chart emphasis
- key technical indicators

### Use gold sparingly
Gold is the **identity accent**, not the default interaction color.

Use gold for:
- logo
- control tower identity moments
- premium highlights
- section anchors
- select hero accents

Do **not** use gold as the main chart palette or all-purpose CTA color.

### Preserve contrast
All dashboard text and metrics should remain highly legible on dark surfaces.

---

## Typography

## Primary recommendation

### Brand / Display
**Orbitron**

Use for:
- logo wordmark
- hero titles
- main page titles
- dashboard section anchors
- standout headline moments

Why:
- futuristic
- technical
- avionics / cockpit feel
- strong crypto/product identity

### UI / Product / Body
**Inter**

Use for:
- navigation
- cards
- labels
- body copy
- controls
- tables
- secondary headings
- dashboard UI

Why:
- extremely legible
- excellent for dense product surfaces
- clean contrast against Orbitron
- stable in small sizes

### Data / Technical Accent
**IBM Plex Mono**

Use for:
- wallet snippets
- tx hashes
- timestamps
- block numbers
- technical labels
- diagnostic metadata

Why:
- reinforces technical tooling feel
- improves differentiation for machine-like data
- useful in portfolio analytics contexts

---

## Typography stack

```json
{
  "fonts": {
    "brand": "'Orbitron', sans-serif",
    "heading": "'Orbitron', sans-serif",
    "body": "'Inter', sans-serif",
    "ui": "'Inter', sans-serif",
    "dataAccent": "'IBM Plex Mono', monospace"
  },
  "weights": {
    "regular": 400,
    "medium": 500,
    "semibold": 600,
    "bold": 700
  }
}
```

---

## Typography usage rules

### Orbitron
Use sparingly and strategically.

Recommended usage:
- logo
- H1
- H2 in hero sections
- major dashboard section titles
- standout numeric hero values if needed

Do **not** use Orbitron for:
- long paragraphs
- dense KPI metadata
- tables
- filters
- small labels

### Inter
Use for most of the product interface.

Recommended usage:
- body text
- cards
- panel descriptions
- controls
- menus
- labels
- subheads
- chart legends
- table content

### IBM Plex Mono
Use only as a technical accent.

Recommended usage:
- wallet address snippets
- tx hashes
- dates/times in technical contexts
- sync metadata
- trace identifiers
- raw numerical labels when technical tone matters

---

## Typographic hierarchy

### Logo
- Orbitron Bold
- uppercase
- slightly expanded tracking

### Hero title / primary page title
- Orbitron Bold

### Section title
- Orbitron Medium or SemiBold

### Card title
- Inter SemiBold

### KPI value
- Inter SemiBold or Bold
- use `tabular-nums`

### KPI label
- Inter Medium

### Body
- Inter Regular

### Technical metadata
- IBM Plex Mono Regular / Medium

---

## Numeric styling

All financial values should prefer stable numeric spacing.

Use:
```css
font-variant-numeric: tabular-nums;
```

Apply to:
- KPI values
- tables
- chart axes
- balances
- timestamps where alignment matters

---

## UI tone

The interface should feel:

- sharp
- disciplined
- modular
- controlled
- premium
- audit-friendly

### Preferred styling language
- angular or slightly rounded corners
- thin borders
- layered dark surfaces
- restrained glow
- subtle grid/radar motifs
- dense but readable information hierarchy

### Avoid
- bubbly UI
- colorful playful badges everywhere
- overly soft shadows
- oversized border radii
- generic “startup SaaS” aesthetics

---

## Chart styling direction

Charts should reinforce the brand:

### Primary series
- Signal Teal `#00E0E1`

### Secondary series
- Electric Blue `#3B82F6`

### Premium / identity highlight
- Cab Gold `#F2C14E`

### Positive / gain overlays
- Success `#22C55E`

### Negative / warning overlays
- Danger `#EF4444`
- Warning `#FBBF24`

### Chart backgrounds
- dark, minimal, high contrast
- no noisy grid
- thin subtle grid lines only if needed

### Important rule
Charts should feel like instrumentation, not like retail trading toys.

---

## Component styling guidance

### Cards
- dark surface
- subtle border
- minimal elevation
- strong title/value contrast

### Buttons
Primary:
- dark surface + cyan border/accent
- cyan hover emphasis

Secondary:
- dark surface + muted border

Premium/brand CTA:
- selective gold usage only where brand moment matters

### Navigation
- dark background
- cyan active states
- restrained iconography
- clear selected state

### Timeline / event feed
- technical, structured, readable
- small colored semantic markers
- mono for hashes/technical references
- no chat-like bubble styling

---

## Brand copy tone

Visual identity should be supported by copy that feels:

- precise
- confident
- technical
- concise
- non-hypey

Prefer:
- “Portfolio under control”
- “Historical capital flow”
- “Deployed by pool”
- “Rebalance detected”
- “Coverage partial”
- “Accepted run”
- “Residual balances”

Avoid:
- “moon”
- “ape”
- “degen” in core interface
- exaggerated hype language
- playful fintech copy

---

## Do / Don’t

### Do
- keep the interface dark and controlled
- use Orbitron only where identity matters
- use Inter for almost all product readability
- use IBM Plex Mono as a technical accent
- preserve high contrast
- keep gold premium and scarce
- use cyan and blue for signals and data emphasis
- design around portfolio understanding, not decoration

### Don’t
- turn the app into a neon sci-fi poster
- overuse glow
- overuse Orbitron in dense UI
- use gold everywhere
- make charts visually noisy
- style the app like a meme-coin dashboard
- let branding reduce trust or readability

---

## Ready-to-implement summary

### Brand stack
- Orbitron
- Inter
- IBM Plex Mono

### Core palette
- `#040F1C`
- `#0F1826`
- `#15233A`
- `#00E0E1`
- `#3B82F6`
- `#F2C14E`

### Product rule
The Cab must visually feel like a **premium aviation-inspired crypto analytics control tower**:
- technical
- legible
- futuristic
- trustworthy

---

## Implementation note for Copilot

If there is any ambiguity, prioritize:
1. readability
2. dashboard trustworthiness
3. technical precision
4. restrained premium identity
5. brand consistency with the control-tower / avionics concept

Do not drift toward generic SaaS styling, soft fintech styling, or noisy cyberpunk styling.

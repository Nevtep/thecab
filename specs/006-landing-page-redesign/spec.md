# Feature Specification: Landing Page Redesign Post-Mortem

**Feature Branch**: `006-landing-page-redesign`  
**Created**: 2026-05-24  
**Status**: Retrospective  
**Input**: User description: "Retrospective post-mortem spec for branch 006-landing-page-redesign describing the style, presentation, and interaction-design changes introduced by the implemented landing redesign."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Establish a Stronger First Impression (Priority: P1)

As a first-time visitor arriving on The Cab landing page, I need the hero and opening sections to communicate a premium control-tower identity immediately so I understand that this product is a serious Aerodrome analytics surface rather than a generic crypto site.

**Why this priority**: The redesign's primary job is to change the perceived quality and clarity of the landing experience within the first screen and first scroll.

**Independent Test**: Can be fully tested by loading the root landing page and confirming that the hero, value framing, and visual shell establish the new control-surface presentation without relying on later sections.

**Acceptance Scenarios**:

1. **Given** a visitor lands on the root page, **When** the hero loads, **Then** they see a cinematic dark control-surface composition with technical copy, instrument-style badges, a status panel, and a wallet CTA above the first fold.
2. **Given** a visitor scrolls into the next section, **When** they view the value framing cards, **Then** they see curated visual storytelling that explains fragmented pool exposure, strategy separation, reward attribution, and activity interpretation instead of generic marketing tiles.

---

### User Story 2 - Understand the Product Through Presentation (Priority: P2)

As a cautious DeFi user evaluating the product, I need the landing page to explain the product model, interaction flow, and trust boundaries through structured sections so I can decide whether the experience is credible before I connect a wallet.

**Why this priority**: The redesign expanded the landing page from a narrow hero-plus-trust surface into a fuller product narrative that explains what The Cab is, how it works, and why its analysis model is trustworthy.

**Independent Test**: Can be fully tested by traversing the section order and verifying that product promise, how-it-works, model clarity, activity intelligence, trust, and final CTA all present a coherent narrative without requiring access to the connected app.

**Acceptance Scenarios**:

1. **Given** a visitor scrolls through the landing page, **When** they move section by section, **Then** they encounter the implemented sequence: Hero, Value, Product Promise, How It Works, Model Clarity, Activity Intelligence, Trust and Privacy, Final CTA.
2. **Given** a visitor evaluates the product model, **When** they read the middle sections, **Then** they can distinguish pools, deposits, strategies, residual balances, and interpreted activity as separate but related concepts.
3. **Given** a visitor evaluates trust, **When** they read the lower sections, **Then** they can identify the product as read-only, non-custodial, Base-scoped for v1, and explicit about coverage limits.

---

### User Story 3 - Experience a Premium but Controlled Interactive Surface (Priority: P3)

As a visitor using different devices and accessibility settings, I need the redesigned page to preserve its premium presentation without breaking containment, readability, focus behavior, or motion preferences so the experience remains polished across contexts.

**Why this priority**: The redesign introduced denser visual composition, richer assets, and an interactive how-it-works flow, which only deliver value if they remain responsive and accessible.

**Independent Test**: Can be fully tested by running responsive containment checks, accessibility smoke tests, and viewport-specific interaction checks for the how-it-works section.

**Acceptance Scenarios**:

1. **Given** mobile, tablet, desktop, full-HD, and TV-sized viewports, **When** the page renders, **Then** the document and each landing section remain horizontally contained.
2. **Given** an interactive desktop-sized viewport, **When** the visitor reaches the how-it-works section, **Then** the staged scroll experience is active.
3. **Given** a TV-sized or otherwise non-interactive context, **When** the visitor reaches the how-it-works section, **Then** the experience falls back to a static stacked presentation.
4. **Given** reduced-motion or keyboard-navigation needs, **When** the visitor uses the page, **Then** smooth-scroll, focus treatment, landmarks, and section behavior remain usable and visible.

---

### Edge Cases

- Wallet is disconnected, connected but awaiting signature, connected on Base, or connected on an unsupported chain.
- Large, dense sections such as Product Promise and How It Works must reflow without horizontal overflow.
- Extra-large display contexts must not pin or animate the how-it-works section in a way that wastes space or harms readability.
- Reduced-motion preferences must suppress unnecessary smooth scrolling and staged animation behavior.
- Curated media may load later than text, so sections must remain legible and structurally coherent before imagery fully resolves.
- English and Spanish content must preserve the same section structure, accessibility labels, and trust messaging.

## Requirements *(mandatory)*

### Functional Requirements

#### 1) Retrospective Framing and Scope

- **FR-001**: This document MUST describe the landing redesign as an implemented change, not as a proposal or future roadmap item.
- **FR-002**: The current landing implementation MUST be treated as the source of truth for this post-mortem.
- **FR-003**: Earlier landing specifications and copy guidelines MUST be used only as before-state context for understanding the redesign delta.

#### 2) Information Architecture and Narrative Expansion

- **FR-004**: The retrospective MUST record that the redesigned landing page expanded the narrative beyond the earlier narrow landing concept into eight ordered sections: Hero, Value, Product Promise, How It Works, Model Clarity, Activity Intelligence, Trust and Privacy, Final CTA.
- **FR-005**: The retrospective MUST describe the redesign as a section-based narrative system rather than a single hero-led marketing page.
- **FR-006**: The retrospective MUST record that the redesign added dedicated sections for product promise, model clarity, and activity intelligence beyond the earlier landing scope.

#### 3) Style System Introduced by the Redesign

- **FR-007**: The retrospective MUST document the shell-level presentation shift toward a darker, more cinematic control-surface aesthetic.
- **FR-008**: The retrospective MUST record the use of a technical grid motif, layered dark surfaces, thin borders, panel framing, and restrained overlays as core style changes introduced by the redesign.
- **FR-009**: The retrospective MUST describe the section shell treatment as a reusable framed surface with dark glass-like composition, gradient layering, and controlled glow.
- **FR-010**: The retrospective MUST describe the redesign's stronger hierarchy across technical eyebrows, display headings, supporting body text, cards, panels, and media stages.
- **FR-011**: The retrospective MUST explain how the redesign applied Orbitron as a display accent, Inter as the default body and interface face, and IBM Plex Mono as the technical accent voice.
- **FR-012**: The retrospective MUST record that cyan remained a signal accent and gold remained a premium identity and CTA accent rather than becoming a dominant filled system color.
- **FR-013**: The retrospective MUST describe the shift from flatter content grouping toward panelized cards, visual frames, overlays, and instrument-like status modules.
- **FR-014**: The retrospective MUST describe curated diagrams and illustrations as operational storytelling devices rather than decorative filler.

#### 4) Interaction-Design Changes

- **FR-015**: The retrospective MUST describe the landing wallet CTA as a stateful presentation system that distinguishes disconnected, awaiting-signature, connected, and unsupported-chain states.
- **FR-016**: The retrospective MUST record that CTA behavior changes by wallet state, including connect, sign, switch-network, continue, and disconnect actions.
- **FR-017**: The retrospective MUST record that secondary CTA interactions include scroll-to-section behavior for guided page traversal.
- **FR-018**: The retrospective MUST describe the how-it-works section as an interactive staged experience on eligible desktop-sized contexts.
- **FR-019**: The retrospective MUST record that the how-it-works section falls back to a static stacked mode outside those contexts, including very large TV-like viewports.
- **FR-020**: The retrospective MUST describe reduced-motion-aware interaction behavior as part of the redesign's quality bar.

#### 5) Responsive and Accessibility Outcomes

- **FR-021**: The retrospective MUST document that the redesign enforces no-horizontal-overflow expectations across mobile, tablet, desktop, and large-display viewports.
- **FR-022**: The retrospective MUST describe responsive restructuring for dense sections such as Product Promise and How It Works.
- **FR-023**: The retrospective MUST describe the skip link, semantic landmarks, focus-visible treatment, and accessible media labeling as integrated parts of the redesigned presentation system.
- **FR-024**: The retrospective MUST record that accessibility and containment were validated through automated smoke and viewport tests, not left as informal design intent.

#### 6) Brand, Copy, and Localization Alignment

- **FR-025**: The retrospective MUST analyze the redesign against The Cab brand direction: control tower, avionics, premium dark surfaces, restrained accents, and technical trustworthiness.
- **FR-026**: The retrospective MUST record that the redesign avoids generic SaaS, soft fintech, and noisy cyberpunk styling patterns.
- **FR-027**: The retrospective MUST record that all landing copy remains translation-key driven and that English and Spanish are treated as first-class presentation surfaces.
- **FR-028**: The retrospective MUST describe how concise, technical, non-hypey copy works together with the new visual system to reinforce trust and control.

#### 7) Supporting Presentation Systems

- **FR-029**: The retrospective MUST identify the reusable section shell as a new presentation primitive introduced by the redesign.
- **FR-030**: The retrospective MUST identify the centralized landing asset registry as a new presentation-management layer introduced by the redesign.
- **FR-031**: The retrospective MUST identify landing-specific wallet-state mapping, scroll helpers, telemetry hooks, and landing CSS variables/utilities as new supporting systems added with the redesign.

#### 8) Validation Evidence and Tradeoffs

- **FR-032**: The retrospective MUST summarize the implementation evidence that confirms the redesign's responsive, interactive, and accessibility behavior.
- **FR-033**: The retrospective MUST document tradeoffs introduced by the redesign, including denser composition, richer motion, and asset maintenance cost.
- **FR-034**: The retrospective MUST stay centered on style, presentation, and interaction design and MUST NOT drift into provider architecture, protocol ingestion, or analytics implementation internals.

### Constitution Alignment Requirements *(mandatory)*

- **CA-001 Brand**: The retrospective MUST describe the redesign in terms that preserve The Cab control-tower tone and avoid hype/casino/meme language.
- **CA-002 Localization**: The retrospective MUST record that landing copy, labels, and accessibility strings remain translation-key driven across English and Spanish.
- **CA-003 Localization Formatting**: The retrospective MUST note that the redesign preserves technical typography and tabular-number treatment where data-like presentation appears, without introducing ad hoc formatting language.
- **CA-004 Chain Awareness**: The retrospective MUST describe chain-specific behavior only where it is user-visible in the landing flow, specifically Base-only v1 wallet-state handling, and MUST not imply unsupported multi-chain availability.
- **CA-005 Provider Boundaries**: The retrospective MUST keep backend data-provider and analytics internals out of scope, except where the landing page explains product concepts in high-level copy.
- **CA-006 Explainability**: The retrospective MUST record that the redesign makes coverage limits, share-level strategy language, and read-only trust boundaries explicit instead of implying false precision.

### Key Entities *(include if feature involves data)*

- **Landing Section**: A discrete story block in the redesigned landing page, with a defined visual role, ordered placement, and localized copy set.
- **Section Shell**: The shared framed presentation surface that gives major landing sections their bordered, layered, control-surface treatment.
- **Landing Asset Registry Entry**: A centrally defined visual asset reference that pairs an image with size, role, and accessibility metadata for section-specific storytelling.
- **Wallet CTA State**: A landing-specific view state that determines status messaging, button tone, and primary or secondary actions.
- **How-It-Works Mode**: The responsive interaction mode that switches between interactive staged presentation and static stacked presentation.
- **Landing Telemetry Event**: A minimal interaction event for landing CTA usage that remains landing-scoped and non-sensitive.
- **Validation Evidence Set**: The responsive, overflow, interaction-mode, and accessibility checks that substantiate the redesign's quality claims.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The implemented landing page presents all eight redesigned narrative sections in the documented order with no missing story blocks.
- **SC-002**: The hero and final CTA surfaces support the four documented wallet states: disconnected, awaiting signature, connected on Base, and unsupported network.
- **SC-003**: Responsive validation confirms no horizontal overflow across the documented mobile, tablet, desktop, full-HD, and TV-sized viewport set.
- **SC-004**: The how-it-works experience is interactive on eligible desktop-sized viewports and demonstrably falls back to a static stacked mode on TV-sized contexts.
- **SC-005**: Accessibility smoke coverage reports no remaining WCAG A/AA violations aside from explicitly excluded rules in the current test harness.
- **SC-006**: The redesigned landing surface preserves English and Spanish parity for landing content, accessibility labels, and trust messaging.

## Assumptions

- The current merged landing implementation is the authoritative representation of the redesign.
- The earlier 002 landing spec captures the pre-redesign intent closely enough to serve as before-state context, even though the redesign expanded beyond it.
- The redesign's purpose is interpretive and presentational; it does not change provider ownership or protocol analytics internals.
- The current automated tests are sufficient to support retrospective claims about containment, accessibility smoke coverage, and viewport-specific interaction behavior.

## Purpose and Framing

This document records the landing redesign that shipped on branch `006-landing-page-redesign`. It is a retrospective post-mortem specification, not a feature proposal. Its purpose is to capture what changed in the visual language, section architecture, and interaction patterns of the landing page after the redesign landed in code.

The document focuses on style, presentation, and interaction design rather than backend systems. It treats the current landing implementation as the source of truth and uses the earlier landing specification only to clarify the delta between the narrower original concept and the fuller control-surface experience now present.

## Executive Summary of the Redesign

The redesign shifted the landing page away from a simpler marketing entry surface and toward a more cinematic control-tower presentation. The page now behaves like a premium operational briefing for the product rather than a sparse connect-first splash screen.

Several changes define that shift. The visual identity leans harder into aviation instrumentation, dark layered surfaces, thin technical borders, framed diagrams, and restrained signal accents. The information architecture became more deliberate, using section-by-section narrative progression to move from first impression to product explanation to trust and conversion. Cards, panels, and CTA zones now read as parts of a single control surface, not as disconnected content modules.

The redesign also expanded the storytelling scope. It added dedicated sections for product promise, model clarity, and activity intelligence, making the landing page a better match for the complexity of The Cab product itself. The result is a landing experience with stronger brand fidelity, clearer product framing, and a more intentional premium identity.

## Style Changes Introduced by the Redesign

At the shell level, the redesign introduced a darker and more technical environment. The page now sits over a branded background and layered grid treatment that evokes instrumentation rather than flat page chrome. This immediately changes the tone from generic product marketing to a cockpit-like interface.

Section framing became a core style system. Major content blocks now share a bordered, layered surface treatment with dark glass-like backgrounds, large-radius panel shells, soft gradient veils, and subtle dual-accent lighting. This gives the page a consistent visual container language and makes each section feel like a panel in a larger control console.

Hierarchy is stronger throughout. Technical eyebrow copy separates itself from primary headings, headings carry more display authority, supporting text sits in a clearly subordinate rhythm, and data-like elements such as badges, panel labels, and small annotations now feel distinctly operational. Orbitron is reserved for identity-heavy display moments, Inter holds the readable product surface together, and IBM Plex Mono reinforces technical emphasis rather than being used indiscriminately.

Cyan and gold are used with more discipline. Cyan functions as signal, focus, and active-state emphasis. Gold is concentrated in premium identity moments and brand-forward CTA usage. The redesign avoids broad cyan fills or neon-heavy styling, which keeps the page aligned with the product's trust-oriented tone.

The redesign also replaced flatter card groupings with a more panelized language. Cards now sit inside framed compositions, overlays appear where they help create instrumentation depth, and supporting visuals are treated as explainers rather than filler. The hero status panel, product-promise overlay cards, activity-intelligence numbered blocks, and trust cards all reinforce this more deliberate presentation model.

Dense sections were restructured responsively instead of simply shrinking. Product Promise changes from an image-with-overlay grid into a stacked mobile presentation. How It Works switches between an interactive staged desktop experience and a simpler static stack in contexts where pinning would be wasteful or unstable. This is a material style change because responsiveness now affects the expression of the story, not just its dimensions.

## Section-by-Section Redesign Notes

### Hero

The hero became the strongest single expression of the redesign. Its role is to establish The Cab as a portfolio command cabin immediately. It combines a branded background, control-surface hero visual, wallet CTA, instrument-style badges, and a floating portfolio-status panel. The result is closer to an operational dashboard teaser than a traditional marketing masthead.

Stylistically, the hero uses layered background tinting, a framed media stage, soft overlay treatment, and a bottom-anchored status module that reads like cockpit instrumentation. It expresses the brand's aviation and monitoring motifs directly while remaining restrained.

### Value / Problem Framing

The value section now uses curated visual fragments and individual framed cards to explain four concrete product problems: fragmented pool exposure, strategy separation, reward attribution, and activity interpretation. This is a shift from generic benefits language toward problem-led product reasoning.

The styling emphasizes repeated framed cards over a dark contextual background, with each asset treated as a diagram fragment. The section builds trust by looking analytical and explanatory rather than promotional.

### Product Promise

The product-promise section turns the product model into a panoramic cockpit-style composition. A large visual stage holds overlay cards that summarize the major connected-app modules: overview, pools, deposits, strategies, rewards, and governance.

This section introduced one of the redesign's strongest presentation moves: overlaying small control-surface cards on top of a single branded scene. On mobile, those cards stack below the image instead of remaining overlaid, preserving clarity without losing the section's visual identity.

### How It Works

How It Works changed from a likely static explanatory block into a staged experience. On eligible desktop-sized viewports, the section becomes a scroll-driven sequence that pins and steps through the analysis flow. In very large or non-interactive contexts, it falls back to a static stack.

The section's visual role is to translate product complexity into a guided operational sequence. Its interaction model is one of the redesign's clearest examples of motion supporting meaning instead of existing for spectacle.

### Model Clarity

Model Clarity was added to explain pools, deposits, and strategies as distinct analytical layers. This section uses a central diagram and adjacent cards to prevent the landing page from collapsing different exposure models into one vague category.

Visually, it reinforces the product's analytical seriousness. The central diagram acts as a structural map, while the companion blocks read as precise definitions rather than marketing blurbs.

### Activity Intelligence

Activity Intelligence was also added by the redesign. It introduces the idea that raw wallet activity becomes classified operational events through interpretation. Its numbered cards and timeline-style visual emphasize sequencing, logic, and attribution.

This section expresses the brand's instrumentation theme strongly. It feels closer to an event-analysis console than a marketing explainer, which is important because it demonstrates why The Cab exists at all.

### Trust and Privacy

Trust and Privacy became more explicit and more structured. Instead of relying on a small trust note, the redesign gives read-only posture, no-custody messaging, no-execution boundaries, and coverage honesty their own visually substantial section.

The design supports that seriousness with a dedicated trust image, framed bullets, and a parallel coverage grid. The effect is to present trust and uncertainty as integral product qualities rather than as small disclaimers.

### Final CTA

The final CTA is no longer just a repeated button area. It acts as the landing page's closing clearance point, using a softer branded background treatment, split layout, and a second wallet-state-aware CTA surface. It reinforces the hero while closing the narrative in a calmer, more resolved tone.

## New Presentation Systems Introduced

The redesign introduced several reusable presentation systems that did not exist in the earlier landing concept.

The first is the shared section shell. Instead of styling each section independently, the redesign created one framing primitive that establishes border, radius, layering, background handling, and content rhythm. That system is what makes the page feel like one coherent control surface.

The second is the centralized landing asset registry. Visuals are no longer scattered as one-off image decisions. Each landing asset is given a defined role, size, and accessibility metadata, which makes the storytelling layer maintainable and consistent.

The third is the landing-specific wallet CTA presentation model. Wallet state is translated into specific tones, labels, helper text, and actions so the CTA can feel native to the landing surface instead of borrowing raw connected-app behavior.

The redesign also introduced scroll helpers, landing-specific telemetry hooks, and landing-focused CSS variables and utility classes. These supporting systems matter because they let the page maintain a consistent motion language, visual token set, and interaction vocabulary.

## Interaction-Design Changes

The redesign made the landing page more interactive without turning it into a noisy animated surface. The most obvious change is the wallet-state-aware CTA behavior. The page no longer presents a single static connect action; it adapts to disconnected, awaiting-signature, connected-on-Base, and unsupported-network states, each with appropriate language and button treatment.

The hero and final CTA also vary how that CTA is framed. One appears inline within the hero's opening composition, while the later one sits as a card-like conversion surface. This creates progression without inventing new behavior.

Secondary actions now guide movement through the page. Instead of relying on navigation alone, the redesign lets users move directly to the next meaningful section through scroll-to-section actions that respect reduced-motion preferences.

The biggest interaction change is the how-it-works stepper. On eligible desktop-like contexts it becomes a staged scroll experience. On TV-sized or otherwise unsuitable contexts it becomes a static stack. This behavior is deliberate: the redesign uses interaction when it improves comprehension and removes it when it would harm readability or pacing.

## Responsive and Accessibility Style Implications

The redesign raised the bar for responsiveness because the page now carries denser layouts, more media, and more structured panels. That makes containment and reflow part of the design system rather than an afterthought. The implementation reflects this by explicitly validating no-horizontal-overflow expectations across a broad viewport set.

Dense sections adapt structurally. Product Promise stops using overlay cards once the viewport no longer supports them cleanly. How It Works chooses between staged and static presentation modes. Trust and coverage grids simplify as width tightens. These are layout decisions that preserve the tone of the redesign without forcing desktop composition into mobile contexts.

Accessibility also became more visible in the presentation system. The page includes a skip link, named landmarks, focus-visible treatment, and structured alt text across landing visuals. Reduced-motion handling affects both scrolling and staged behavior. The redesign therefore treats accessibility as part of the surface language, not as an invisible compliance pass.

## Brand Alignment Analysis

The redesign is much closer to the brand specification than the earlier landing concept. It expresses the control tower and avionics identity through dark layered surfaces, monitored-system framing, technical typography, restrained signal accents, and structured data-like modules.

It also aligns more closely with the premium dark control-surface aesthetic described in the brand spec. Panels feel engineered rather than decorative. Borders stay thin. Glow remains restrained. Gold is used as a premium CTA and identity accent rather than a general-purpose highlight system. Cyan behaves like signal and state information rather than a large promotional fill.

Just as important, the redesign avoids the wrong reference points. It does not read like generic SaaS. It does not drift into playful fintech softness. It does not overcommit to noisy cyberpunk futurism. The result is more disciplined, more trustworthy, and more specific to The Cab.

## Localization and Copy Presentation Impact

The redesign preserved a strong relationship between style and copy. All landing copy remains translation-key driven, which means the richer presentation system still supports English and Spanish consistently. The two languages are treated as equal presentation surfaces rather than as one designed language and one fallback translation.

The visual system also supports the copy guidelines more effectively than the earlier landing. The concise, technical, non-hypey voice now sits inside a presentation model that feels equally controlled and analytical. This matters because the brand's copy tone depends on the surrounding design feeling disciplined.

Accessibility labels and media alt text are also part of that system. Visual storytelling in the redesign is paired with explicit accessible descriptions, which makes the asset-heavy page more robust and more intentional.

## Validation Evidence

The redesign is supported by concrete implementation evidence rather than subjective visual claims alone.

- Responsive containment checks verify that the document and each major section remain free of horizontal overflow across mobile, tablet, desktop, full-HD, and TV-sized viewports.
- Dedicated overflow coverage confirms the landing page remains contained even at narrow mobile widths.
- The how-it-works section is explicitly validated in both its interactive desktop mode and its TV-sized static fallback mode.
- Product Promise includes a viewport-specific check to confirm that its cards stack below the visual on mobile instead of remaining overlaid.
- Accessibility smoke coverage validates the landing page against WCAG A and AA rule sets within the current test harness, excluding only the rules already documented in that harness.

## Tradeoffs and Limitations

The redesign's stronger visual density creates a real clarity-management challenge. It succeeds because the hierarchy is deliberate, but it also requires more care than a simpler landing page would.

Richer motion brings similar tradeoffs. The staged how-it-works sequence adds meaning on appropriate viewports, but it also introduces a need for explicit fallback rules and reduced-motion handling.

The stronger brand expression is a gain, but it comes with the risk of over-styling. The implemented redesign avoids that by keeping typography disciplined, accents restrained, and interactions purposeful, though the balance must continue to be protected.

Finally, the redesign depends on a larger curated visual asset set. That produces better storytelling, but it also increases maintenance cost and the need for asset consistency over time.

## Outcome / Conclusion

The landing redesign materially improved brand fidelity. The page now feels like a premium aviation-inspired control surface instead of a lighter generic product landing.

It also made the product easier to understand. By adding product-promise, model-clarity, and activity-intelligence sections, the landing page now explains the product with the same level of precision that the product itself aims to provide.

Most importantly, the redesign brought the visual presentation into better alignment with the complexity of The Cab. The current landing experience is more intentional, more technically expressive, and more trustworthy as a front door to the product.
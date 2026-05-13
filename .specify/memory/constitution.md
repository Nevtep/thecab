<!--
Sync Impact Report
- Version change: template placeholder version -> 1.0.0
- Modified principles:
	- template principle 1 -> I. Brand-True Control Tower Experience
	- template principle 2 -> II. Localization-First Product Copy and Formatting
	- template principle 3 -> III. Chain-Aware Domain and Identity Integrity
	- template principle 4 -> IV. Provider and API Contract Discipline
	- template principle 5 -> V. Layered Architecture and Explainable Analytics
- Added sections:
  - Technical Standards and Non-Negotiables
  - Delivery Workflow and Quality Gates
- Removed sections:
  - None
- Templates requiring updates:
  - ✅ updated: .specify/templates/plan-template.md
  - ✅ updated: .specify/templates/spec-template.md
  - ✅ updated: .specify/templates/tasks-template.md
  - ⚠ pending: .specify/templates/commands/*.md (directory not present)
- Follow-up TODOs:
  - None
-->

# The Cab Constitution

## Core Principles

### I. Brand-True Control Tower Experience
All user-facing surfaces MUST preserve The Cab as a technical, premium, aviation-inspired
control tower for on-chain capital. Product UI and copy MUST remain precise, disciplined,
and audit-friendly, and MUST NOT drift into meme, casino, retail-trading, or generic SaaS
language and styling.

Brand implementation is non-negotiable: the dark control-surface aesthetic, restrained
signal accents, readable dense dashboards, and hierarchy of brand typography MUST be
preserved. Financial and analytics screens MUST prioritize legibility, contrast, and
tabular numeric alignment.

Rationale: The Cab's trust model depends on operational clarity and consistent premium
identity across landing, dashboard, and analytics modules.

### II. Localization-First Product Copy and Formatting
No user-facing product copy may be hardcoded in feature UI. All labels, empty states,
errors, toasts, chart labels, table headers, filter labels, and status badges MUST be
sourced from i18next resources using semantic keys.

English is the canonical source language and Spanish is required for product v1. Locale
resolution MUST follow: explicit preference, browser locale, then English fallback.
Resource parity between English and Spanish namespaces MUST be maintained.

Numbers, currencies, percentages, token amounts, and dates MUST use centralized locale
formatters built on Intl APIs. Manual formatting in components is prohibited.

Rationale: The Cab serves multilingual users and must present reliable analytics with
linguistic and numerical correctness.

### III. Chain-Aware Domain and Identity Integrity
Product v1 supports Base mainnet, but implementation MUST remain chain-aware from day one.
No feature may hardcode chain assumptions outside the chain configuration layer.

Address-based identities MUST include chainId. Protocol entities, events, and prices MUST
be keyed with chain-scoped identifiers (for example: chainId + address, chainId + txHash,
chainId + contract + tokenId).

TanStack Query keys, API routes, provider calls, and analysis jobs MUST accept or derive
chainId. Any unsupported chain request MUST fail with stable backend error codes.

Rationale: Aero expansion is expected to be multi-chain; chain-safe modeling prevents data
corruption and future architectural rewrites.

### IV. Provider and API Contract Discipline
Provider responsibilities are strict. Moralis is for wallet-centric discovery and fast
overview signals. Alchemy Prices is the canonical pricing source for current and historical
valuation. RPC/log/contract reads are canonical for protocol lifecycle reconstruction.

Feature APIs MUST read normalized data from persistence and MUST NOT perform long-running
analysis in request/response flow. Long analysis runs MUST execute through Trigger.dev and
publish status through analysis run endpoints.

Backend responses MUST return stable machine error codes. Frontend localization maps those
codes to translated user copy. Silent fallback to unapproved data providers is prohibited.

Rationale: Explicit provider ownership prevents data drift, hidden assumptions, and
non-reproducible analytics.

### V. Layered Architecture and Explainable Analytics
The Cab architecture MUST preserve separation of concerns:
1. Fast API layer for immediate wallet visibility.
2. Protocol reconstruction layer for canonical analytics.
3. Localization layer for all user-facing communication.

Raw provider payloads MUST be persisted before normalization. Normalized entities and
coverage/confidence records MUST be derivable and explainable from ledger events,
asset movements, price points, and attribution state.

Manual Deposits, Automated Strategies, and Pools MUST remain distinct analytical units,
while still supporting aggregate pool-level views. Mellow exposure MUST be modeled as
Strategy and StrategyExposure unless a manual user-owned NFT position is explicitly proven.

Rationale: Explainability is mandatory for trust, debugging, and future model evolution.

## Technical Standards and Non-Negotiables

1. Stack constraints:
	- Next.js application architecture.
	- WalletConnect + wagmi, consumed via internal wallet adapter.
	- TanStack Query for server state; Zustand for shared client UI state.
	- Trigger.dev for background analysis workflows.
	- i18next + react-i18next + browser language detection for localization.
2. Domain constraints:
	- Product v1 chain: Base mainnet (8453).
	- Domain and persistence remain chain-aware and migration-ready.
	- Residual attribution does not expire by time; it resolves only by observed movement.
3. Data constraints:
	- Permanent retention of analysis data unless explicit deletion policy is introduced.
	- No CSV/export functionality in product v1.
	- Coverage status (full/share_level/partial/unknown) is required where reconstruction
	  is incomplete.
4. Design system and copy constraints:
	- Design primitives MUST receive product strings from localization resources.
	- Protocol terms may remain in canonical form when translation reduces precision.
5. API constraints:
	- Routes MUST be typed, chain-scoped, and backed by normalized persistence.
	- Feature code MUST use typed query hooks rather than raw fetch spread across UI.

## Delivery Workflow and Quality Gates

1. Specification gate:
	- Every spec MUST state chain scope, i18n impact, provider dependencies, and coverage
	  expectations for incomplete analytics.
2. Planning gate:
	- Every plan MUST pass constitution checks for brand consistency, localization strategy,
	  chain-aware modeling, provider boundaries, and explainability path.
3. Implementation gate:
	- No hardcoded user-facing copy in product surfaces.
	- Query keys and API routes include chain scoping.
	- Provider modules remain centralized; no provider calls scattered in UI.
4. Validation gate:
	- i18n parity checks for en/es namespaces.
	- Tests for locale normalization and formatting helpers.
	- Regression checks for coverage-state rendering and unsupported-chain handling.
5. Review gate:
	- PR review MUST verify constitutional compliance before merge.
	- Violations require explicit justification and tracked remediation tasks.

## Governance

This constitution is the highest policy for product and engineering decisions in this
repository. Where lower-level guidance conflicts, this document takes precedence.

Amendment procedure:
1. Propose amendment with rationale and impacted principles/sections.
2. Run consistency propagation across templates and operational guidance docs.
3. Record a Sync Impact Report at the top of this document.
4. Approve and merge with semantic version update.

Versioning policy:
1. MAJOR: incompatible principle removals/redefinitions or governance model changes.
2. MINOR: new principles/sections or materially expanded obligations.
3. PATCH: clarifications, wording fixes, and non-semantic refinements.

Compliance review expectations:
1. Plans and tasks MUST include explicit constitution checks.
2. Reviews MUST confirm branding, i18n, chain-safety, provider discipline, and layered
	explainability requirements.
3. Non-compliant work MUST be blocked or tracked with a remediation deadline.

**Version**: 1.0.0 | **Ratified**: 2026-05-12 | **Last Amended**: 2026-05-12

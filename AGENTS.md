<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read
`specs/012-strategies-lifecycle/plan.md`.
<!-- SPECKIT END -->

# The Cab Codex Agent Rules

## Source Of Truth

When implementing, debugging, reviewing, or planning behavior in this repository, follow this order of authority:

1. Current user instructions, plus active system and developer instructions.
2. The active Spec Kit plan referenced above.
3. The product spec in `docs/spec/the-cab-product-technical-spec.md`.
4. The relevant feature specs under `specs/`.
5. Protocol and provider research under `docs/spec/` and `docs/research/`.
6. Existing code, only when it does not contradict the written specs.

If code and spec disagree, treat the code as possible drift. Do not preserve drift as precedent unless the user explicitly approves changing the spec-backed behavior.

## No Invented Heuristics

Never invent heuristics that contradict user-given requirements, product specs, feature specs, protocol research, or official protocol semantics.

This project has already paid for this lesson: reward attribution must not be guessed by pool and time window when ownership is specified by an explicit identity such as `tokenId`, deposit identity, or `strategy_exposure_id`.

Required behavior:

- If a provider payload, decoded transaction, or database row does not contain enough data to resolve ownership or classification with spec-backed confidence, leave it `unresolved`, partial, unavailable, or explicitly limited.
- Prefer visible uncertainty over fabricated values, classifications, lifecycle events, or ownership links.
- Re-read the relevant product, feature, and protocol docs before proposing a fallback.
- If the specs are silent, check official protocol or contract semantics before implementation.
- If ambiguity remains, ask the user before introducing a heuristic.

Forbidden behavior:

- Guessing deposit or strategy ownership from pool address plus time window when a spec requires explicit owner identity.
- Inferring direct pool ownership first and assigning deposit or strategy ownership afterward without explicit support.
- Fabricating non-zero rewards, balances, confidence, classifications, or lifecycle links to make a screen look complete.
- Silently adding fallback behavior that is not documented in the spec.

## Ambiguous Data Handling

When data is ambiguous or incomplete, state:

1. What data is missing.
2. What the relevant spec says.
3. Whether the current implementation must leave the case unresolved or partial.
4. What proposed heuristic would be needed, if the user wants one.

Do not implement the heuristic until the user approves it.

## Strategies, Deposits, And Pools

For the Strategies lifecycle feature, preserve these invariants:

- Strategy rewards resolve through `strategy_exposure_id`.
- Manual deposit rewards resolve through deposit identity and must not include strategy-owned rewards.
- Pool totals may aggregate resolved manual deposit rewards plus resolved strategy rewards, without double counting.
- Request-time Strategies APIs must read from normalized tables or read models only; do not add provider or RPC calls to request paths.
- Wallet, pool, deposit, strategy, reward, API, query-key, and regression identities must carry `chainId`.
- Non-full accounting coverage must be surfaced with a coverage state and reason, not hidden behind confident-looking totals.

## Review And Refactor Discipline

When reviewing or extending code, actively look for spec drift and undocumented heuristics. Call them out rather than treating them as valid local patterns.

Keep changes close to the requested behavior. Prefer existing architecture, design-system components, query patterns, i18n conventions, and analysis-engine boundaries over new abstractions unless the new abstraction removes real complexity.

## Testing And Signoff

Backend, engine, API, mapper, navigation, and URL-state changes need focused unit coverage. Strategy lifecycle work also needs regression checks before signoff:

- Database read-model rows after fresh analysis.
- Representative blockchain transaction comparisons.
- Pool reward totals equal deposit-owned rewards plus strategy-owned rewards.
- Deposit surfaces show deposit-owned rewards only.
- Strategy surfaces show strategy-owned rewards only.

Do not describe a feature as complete until the relevant unit tests and requested regression checks have either passed or been explicitly reported as not run.

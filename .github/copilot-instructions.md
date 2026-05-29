<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read specs/011-deterministic-reward-rebalance/plan.md
<!-- SPECKIT END -->

# The Cab Copilot Rules

## Specification hierarchy

When implementing or debugging behavior, follow this order of authority:

1. Explicit user instructions in the current conversation.
2. The product spec in `docs/spec/the-cab-product-technical-spec.md`.
3. The relevant feature spec(s) under `specs/`.
4. Protocol research docs under `docs/spec/`.
5. Existing code, only when it does not contradict the sources above.

If code and spec disagree, the spec wins unless the user explicitly approves a change.

## Do not invent heuristics

NEVER INVENT HEURISTICS THAT CONTRADICT USER-GIVEN SPECS OR WRITTEN PRODUCT / FEATURE / PROTOCOL SPECS.

This rule exists because the project already paid a real cost for the opposite mistake: an invented reward-attribution heuristic (`reward -> pool/time-window -> guessed deposit`) contradicted the tokenId-based deposit ownership model, caused repeated rework, and wasted substantial user time and tokens.

Required behavior:

- If an API response, provider payload, or decoded transaction does not contain enough data to resolve ownership or classification with spec-backed confidence, do not guess.
- Prefer `unresolved`, partial coverage, or an explicit limitation over a fabricated attribution.
- Surface the ambiguity immediately to the user.
- Re-read the relevant spec and protocol research before proposing any fallback.
- If the spec is still silent, check official protocol docs or contract semantics.
- If ambiguity remains after that, ask the user how to proceed before implementing a heuristic.

Forbidden behavior:

- inventing pool/time-window ownership heuristics when spec says identity is by `tokenId` or other explicit owner identity;
- inferring direct pool ownership first and then guessing the deposit/strategy owner afterward;
- fabricating values, classifications, or ownership links just to avoid zeros, nulls, or unresolved states;
- silently introducing fallback behavior that is not documented in the spec.

## Decision handling for ambiguous data

When data is ambiguous or incomplete:

1. State exactly what is missing.
2. State what the spec says.
3. State whether the current code is forced to leave the case unresolved.
4. If a fallback is still desired, present it as a proposed heuristic and get approval before implementation.

## Review rule

When reviewing or extending existing code, actively look for spec drift and undocumented heuristics. If a heuristic exists in code but is not explicitly supported by the product spec, feature spec, protocol research, or official protocol docs, call it out as drift rather than treating it as a valid precedent.

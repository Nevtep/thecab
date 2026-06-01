# Feature Specification: Analysis Engine V2

**Feature Branch**: `016-analysis-engine`  
**Created**: 2026-05-31  
**Status**: Draft  
**Input**: User description: "Create the feature spec for Analysis Engine V2: Historical Transaction Processor And DataView Read Models. Replace the current screen-phase analysis model with a DB-first historical transaction processor that collects decoded wallet history, persists canonical transactions/logs/internal transactions/movements, decodes inputs/logs with persisted ABIs, classifies transactions chronologically, enriches missing data, runs accounting, and materializes DB-only read models for Activity, Deposits, Strategies, Pools, Rewards, and Governance."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Reconstruct Canonical Wallet History (Priority: P1)

As an advanced DeFi user, I need The Cab to build a complete, deduplicated historical record of every transaction returned for my wallet before it analyzes anything, so cash movements, approvals, swaps, manual deposits, strategies, pools, rewards, governance, unsupported activity, and failed attempts all share the same immutable source of truth.

**Why this priority**: Without a canonical wallet history, all later classification, accounting, reward attribution, and DataViews can drift or double count.

**Independent Test**: Can be tested by running collection from an empty state against the Moralis decoded address transactions endpoint, or a deterministic fixture captured from that endpoint, and confirming that the canonical transaction count, ordering, source evidence, failed transactions, logs, internal transfers, and duplicate/provider-row report are correct before any DataView totals are produced.

**Acceptance Scenarios**:

1. **Given** an empty analysis store and decoded address transaction results from Moralis or an equivalent deterministic fixture, **When** the collection step completes, **Then** The Cab records a distinct canonical transaction set, reports provider row count versus distinct transaction count, and does not count provider duplicates as separate wallet activity.
2. **Given** a transaction with logs, input, status, and internal transactions, **When** the history is canonicalized, **Then** the transaction, logs, internal activity, decoded hints, and raw source reference are retained for reanalysis.
3. **Given** a failed transaction with reverted internal activity, **When** the canonical history is reviewed, **Then** it is visible as failed activity and cannot create deposits, rewards, cash flow, or governance state.
4. **Given** a wallet history page containing native transfers, approvals, swaps, strategy calls, governance calls, reward claims, unsupported transfers, and failed calls, **When** canonicalization completes, **Then** every row is persisted as canonical evidence before any semantic classification decides whether it becomes a domain event, excluded row, or unresolved row.
5. **Given** Moralis returns decoded event hints but no decoded call for a transaction input, **When** canonicalization completes, **Then** the raw input and provider hints are persisted so the ABI registry can decode the call later without recollecting wallet history.

---

### User Story 2 - Classify Protocol Activity Chronologically (Priority: P1)

As an advanced DeFi user, I need The Cab to classify every canonical transaction from oldest to newest using explicit evidence, so cash movements, approvals, swaps, manual deposits, automated strategies, pools, rewards, governance, unsupported activity, excluded activity, and failed attempts are coherent over time.

**Why this priority**: Historical analysis is stateful. Classifying recent transactions before older ones breaks ownership, capital lots, residual inventory, reward attribution, lock lifecycle, and strategy exposure.

**Independent Test**: Can be tested by processing a canonical wallet fixture in chronological order and checking every supported classification family from the research notes: failed transactions, native cash-in/out, ERC20 approvals, swaps, token transfers, manual Aerodrome deposits, Mellow strategy deposits, Mellow strategy reward claims, direct governance locks, votes, pokes, managed lock deposits, bribe claims, fee claims, rebase claims, unsupported events, excluded spam/phishing/airdrop-like transfers, and unresolved ABI gaps.

**Acceptance Scenarios**:

1. **Given** native ETH or token transfers with wallet direction evidence and no supported protocol call, **When** classification runs, **Then** inbound movements are classified as cash-in or transfer-in, outbound movements are classified as cash-out or transfer-out, and neither is mislabeled as rewards or deposits without a supported claim/deposit surface.
2. **Given** ERC20 approval logs or decoded approve calls, **When** classification runs, **Then** the engine records approval activity with owner, spender, token, and amount evidence and does not create cash flow, reward, deposit, strategy, or governance lifecycle effects.
3. **Given** a swap transaction with router/pool call evidence, decoded swap events, and token movements, **When** classification runs, **Then** the engine records swap activity with input token, output token, pool context when explicit, event-time value needs, and residual allocation evidence for accounting.
4. **Given** a manual Aerodrome liquidity position transaction with position manager or gauge identity, **When** classification runs, **Then** the engine records manual deposit lifecycle events only when explicit position token id, owner, pool, and lifecycle evidence are present.
5. **Given** a Mellow wrapper transaction that emits underlying pool logs and share movements, **When** classification runs, **Then** the engine records a strategy exposure or strategy reward event and does not convert internal pool logs into manual deposit ownership.
6. **Given** a direct veAERO lock creation, increase, extension, withdraw, or transfer transaction, **When** classification runs, **Then** the lock is identified by token id, amount, lock timing, owner evidence, and lifecycle event, and persisted under the correct governance lock identity.
7. **Given** governance vote or poke transactions with Voter input and emitted gauge/bribe accounting logs, **When** classification runs, **Then** votes/pokes are classified by lock token id, pool vote args, weights, and events, while internal protocol deposit/withdraw logs are not classified as user manual deposits.
8. **Given** a managed lock deposit transaction referencing a user lock token id and a managed token id, **When** classification runs, **Then** The Cab records a managed-lock relationship without creating the user lock at that transaction and without treating the managed token id as wallet-owned direct lock.
9. **Given** bribe, fee, or rebase claim evidence from decoded inputs, child calls, and token transfers, **When** classification runs, **Then** the action is classified as a governance claim batch with itemized child reward rows rather than one vague reward.
10. **Given** an incoming transfer with no supported claim surface, suspicious metadata, or phishing/spam evidence, **When** classification runs, **Then** the row remains visible as excluded or unsupported activity and never contributes to reward, pool, deposit, strategy, governance, or portfolio totals.
11. **Given** a transaction selector, event topic, or emitting contract that the ABI registry cannot resolve, **When** classification runs, **Then** the engine records an unresolved ABI/decode gap and keeps the row inspectable instead of guessing a supported category.

---

### User Story 3 - Enrich Missing Evidence Without Guessing (Priority: P2)

As an advanced DeFi user, I need The Cab to identify missing evidence for any classified or unresolved entity and resolve it through explicit enrichment, so partial cash, deposit, strategy, pool, reward, governance, valuation, ABI, token, and ownership results can improve without fabricated heuristics.

**Why this priority**: The product must show uncertainty honestly while giving the engine a path to resolve it through ABI, token metadata, pricing, pool, lock, distributor, and current-state evidence.

**Independent Test**: Can be tested by feeding transactions that reference unknown contracts, unknown selectors/topics, unknown token metadata, missing historical prices, unknown pool definitions, missing position state, unknown strategy wrappers, unknown lock origins, unknown distributor-to-pool mappings, or partial current-state reads, and verifying that deduplicated enrichment needs and reason codes are created instead of fabricated links.

**Acceptance Scenarios**:

1. **Given** an unknown contract, selector, or event topic appears in canonical history, **When** classification or enrichment runs, **Then** The Cab creates ABI/selector/event enrichment needs keyed by chain and contract evidence and leaves the affected semantic fields unresolved until verified ABI evidence exists.
2. **Given** a token movement references a token without metadata, decimals, trust hints, or category, **When** enrichment runs, **Then** The Cab creates token metadata needs and blocks normalized display/accounting for that token field until metadata is available or explicitly marked unavailable.
3. **Given** a token movement lacks historical value, **When** accounting runs, **Then** the movement keeps amount evidence and marks valuation unavailable rather than using current price as historical value.
4. **Given** a pool address is observed in a swap, position, vote, or reward context, **When** enrichment runs, **Then** The Cab resolves pool definition from pool contract/registry evidence and keeps pair/tick-spacing/fee-tier incomplete until explicit pool data exists.
5. **Given** a manual deposit position, strategy exposure, or NFT LP position is referenced without complete current state, **When** enrichment runs, **Then** The Cab may use RPC/LpSugar/current-state reads only to hydrate current display and validation fields, not to rewrite historical lifecycle evidence.
6. **Given** a transaction references a lock token id whose origin is missing from wallet history, **When** classification completes, **Then** The Cab creates a partial lock identity and exactly one deduplicated lock identity backfill need for the voting escrow token id.
7. **Given** a governance reward item has a source distributor but no explicit pool mapping, **When** rewards are materialized, **Then** it is shown as a governance reward with partial pool coverage and does not contribute to pool totals until `Voter.GaugeCreated` or equivalent explicit pool evidence exists.
8. **Given** enrichment evidence conflicts with existing classification evidence, **When** enrichment completes, **Then** The Cab preserves both evidence records, marks a conflict reason code, and prevents confident totals for the conflicting field.

---

### User Story 4 - Materialize DataView Read Models (Priority: P2)

As an advanced DeFi user, I need Activity, Deposits, Strategies, Pools, Rewards, and Governance to all read from the same materialized analysis outputs for every classified entity family, so cash, approvals, swaps, deposits, strategies, pools, rewards, governance, unsupported rows, and excluded rows reconcile without double counting.

**Why this priority**: The current screens are usable but the data is not reliable. This story makes the existing DataViews trustworthy without changing the product into a raw explorer.

**Independent Test**: Can be tested by materializing read models from the classified fixture and checking cross-surface reconciliation: Activity contains every canonical row and selected-detail evidence, Deposits contain only manual deposit-owned events, Strategies contain only strategy-owned events, Pools aggregate only explicit manual/strategy/governance links, Rewards show all historical claim items with ownership/exclusion state, Governance explains locks/epochs/votes/rewards, and portfolio totals count each event once.

**Acceptance Scenarios**:

1. **Given** any canonical transaction, **When** Activity read models are materialized, **Then** it appears as classified, failed, unsupported, unresolved, or excluded activity with tx evidence, decoded evidence, movements, coverage, confidence, and reason codes.
2. **Given** a manual deposit lifecycle has open, increase, collect, decrease, close, stake/unstake, and valuation events, **When** Deposits read models are materialized, **Then** the position timeline and performance decomposition use historical event values and explicit position identity.
3. **Given** a strategy deposit or reward through a Mellow wrapper, **When** Strategies read models are materialized, **Then** it appears as strategy exposure/reward with share-level accounting and not as a manual pool deposit.
4. **Given** pools are observed through swaps, positions, strategy mappings, votes, gauges, or reward distributor links, **When** Pools read models are materialized, **Then** each pool remains keyed by pool address and aggregates only explicitly linked manual deposit, strategy, reward, residual, and governance contributions.
5. **Given** rewards are produced from strategy rewards, LP fees, governance bribes, governance fees, rebases, or unknown claim-like transfers, **When** Rewards read models are materialized, **Then** supported reward items are visible by type/source/owner, unknown items remain unresolved, excluded items remain inspectable, and totals count each item once.
6. **Given** governance history contains locks, managed lock links, votes, pokes, bribe claims, fee claims, rebase claims, or partial lock origins, **When** Governance read models are materialized, **Then** the screen can show lock exposure, vote/epoch context, rewards, managed/relay participation, and coverage without merging identities.
7. **Given** cash-in/out, swaps, residual inventory, deposits, withdrawals, rewards, and current values all affect portfolio state, **When** read models are materialized, **Then** historical values, current values, residual inventory, and aggregate totals are separated and reconcilable.

---

### User Story 5 - Preserve Evidence, Coverage, And Regression Safety (Priority: P3)

As a product owner and analyst, I need the engine to keep reproducible evidence and regression cases for every supported classification family and known bug class, so future changes improve transaction coverage without reintroducing fabricated data.

**Why this priority**: This feature replaces the core analysis model. Known edge cases must become permanent acceptance tests and visible coverage states.

**Independent Test**: Can be tested by running saved decoded-history fixtures and confirming that every classification family from the research notes is classified, enriched, materialized, or explicitly left unresolved/excluded with coverage/confidence/reason codes, including all known bug/gap cases.

**Acceptance Scenarios**:

1. **Given** regression fixtures with native transfers, ERC20 approvals, swaps, failed calls, and unsupported transfers, **When** the regression suite runs, **Then** each row receives the expected activity classification or exclusion state and no unsupported transfer is promoted into a reward/deposit/strategy/governance total.
2. **Given** regression fixtures with manual position-manager lifecycle events and strategy wrapper lifecycle events, **When** the regression suite runs, **Then** manual deposits and strategy exposures remain separated and internal strategy pool actions never become manual deposits.
3. **Given** regression fixtures with both direct lock lifecycle and managed-lock lifecycle, **When** the regression suite runs, **Then** the direct lock, deposited user lock, and managed token identity remain separate.
4. **Given** regression fixtures with votes, pokes, claimBribes, claimFees, multicall/batch claims, and rebase claims, **When** the regression suite runs, **Then** votes/pokes remain governance activity, child reward items are materialized, non-liquid rebase effects update lock lifecycle, and no reward is double counted.
5. **Given** regression fixtures with unresolved ABIs, unknown emitters, missing prices, missing pool mappings, lock origins missing from wallet history, or conflicting evidence, **When** the regression suite runs, **Then** each gap is persisted as a reproducible enrichment need, conflict, partial row, or unresolved row.
6. **Given** read models generated from regression fixtures, **When** cross-surface totals are compared, **Then** Activity, Deposits, Strategies, Pools, Rewards, and Governance reconcile using explicit links and DB-only outputs.

---

### Edge Cases

- Provider history returns more rows than distinct transaction hashes.
- Provider history omits the origin event for a referenced entity such as a lock token id, pool, distributor, strategy, or position.
- A transaction is successful but contains multiple semantic child actions.
- A transaction is reverted and contains no reliable lifecycle effect.
- A governance `claim all` action combines bribes, fees, and rebases.
- A rebase reward is automatically re-locked and is not liquid cash-in.
- A reward source is explicit but its pool or epoch association is not yet explicit.
- A transfer looks like a reward by token movement but has no supported claim surface.
- A Mellow strategy transaction emits pool-like logs but represents strategy-owned activity.
- A governance vote/poke emits internal gauge deposit/withdraw logs that are not user manual deposits.
- A historical price is unavailable or diverges between sources.
- A user has multiple locks, one direct and another managed/relay-related.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST collect a complete historical transaction record for the connected wallet on Base before analysis-derived read models are produced.
- **FR-002**: The system MUST persist provider history as raw source evidence and as a canonical transaction history that can be reanalyzed without recollecting immutable provider data.
- **FR-003**: The system MUST deduplicate canonical wallet transactions by chain, wallet, and transaction hash, while reporting provider row count, distinct transaction count, and any duplicate or skipped rows.
- **FR-004**: The system MUST retain transaction status, timestamp, block order, transaction order, input data, logs, internal transactions, native value, source references, and decoded provider hints for each canonical transaction.
- **FR-005**: The system MUST process canonical transactions in chronological order from oldest to newest before producing analysis outputs.
- **FR-006**: The system MUST classify transactions by explicit evidence from contract identity, decoded function input, decoded events, token movements, known protocol surface, and explicit ownership identifiers.
- **FR-007**: The system MUST NOT infer ownership, pool, deposit, strategy, reward, epoch, or lock association from pool address plus time window.
- **FR-008**: The system MUST persist verified contract ABI evidence and selector/event mappings so missing provider decodes can be resolved without relying on provider labels as final classification.
- **FR-009**: The system MUST support discovery of Aerodrome and Mellow contracts encountered in wallet history, including pools, gauges, reward distributors, bribe/fee distributors, voting escrow, voter, routers, position managers, wrappers, and strategies.
- **FR-010**: The system MUST represent one transaction as zero, one, or many domain events, including parent/child relationships for multicall, claim-all, claimBribes, claimFees, and rebase claim flows.
- **FR-011**: The system MUST create a domain event store that separates canonical evidence from screen-specific read models.
- **FR-012**: The system MUST create explicit entity links from domain events to deposits, strategies, pools, rewards, governance locks, governance epochs, and activity only when evidence supports the relationship.
- **FR-013**: The system MUST create enrichment gaps for missing ABIs, token metadata, historical prices, current prices, pool definitions, position state, strategy state, lock identity, distributor-to-pool mapping, and global log backfills.
- **FR-014**: The system MUST keep partial, unresolved, unsupported, and excluded states visible with reason codes instead of fabricating confident classifications.
- **FR-015**: The system MUST classify incoming spam, phishing, or unsupported airdrop-like transfers as excluded from reward totals unless an explicit supported claim surface proves otherwise.
- **FR-016**: The system MUST reconstruct manual deposit lifecycles only from explicit position identity and lifecycle evidence.
- **FR-017**: The system MUST reconstruct strategy exposures from explicit wrapper, share, strategy, and reward evidence, and MUST NOT convert strategy-owned internal pool actions into manual deposits.
- **FR-018**: The system MUST identify pool entities by chain and pool address, and derive pair/tick-spacing labels from explicit pool definitions and token metadata.
- **FR-019**: The system MUST value historical capital, fees, rewards, cash-in, cash-out, and lifecycle movements at event time, not by current value.
- **FR-020**: The system MUST keep current value calculations separate from historical event valuation.
- **FR-021**: The system MUST reconstruct governance lock identities, lifecycle events, managed lock relationships, vote events, poke events, bribe claims, fee claims, rebase claims, and epoch summaries from explicit governance evidence.
- **FR-021a**: When a `VotingEscrow.createLock` or equivalent verified lock-creation flow is classified, the system MUST persist or update a normalized `governance_locks` identity for the lock token id and MUST persist a linked `governance_lock_events.create_lock` lifecycle event with tx hash, log evidence, amount, owner, lock timing, coverage, and confidence.
- **FR-022**: The system MUST represent direct locks, user managed/deposited locks, and managed or relay token identities as separate governance identities unless explicit evidence links their roles.
- **FR-023**: The system MUST create a lock identity backfill gap when a transaction references a lock token id whose origin is absent from wallet-centric history.
- **FR-024**: The system MUST represent rebase rewards that are re-locked as governance rewards with non-liquid value effect, not as liquid cash-in.
- **FR-025**: The system MUST materialize DB-backed read models for Activity, Deposits, Strategies, Pools, Rewards, and Governance from the same classified domain-event source.
- **FR-026**: The system MUST prevent double counting when one reward or event appears across multiple DataViews.
- **FR-027**: The system MUST allow DataViews to show all historical relevant rows, including unresolved, unsupported, and excluded rows where appropriate.
- **FR-028**: The system MUST ensure request-time DataView reads use persisted analysis outputs only and never trigger provider, explorer, or contract calls.
- **FR-029**: The system MUST provide deterministic regression fixtures captured from the Moralis decoded address transactions endpoint and the known governance/reward/spam/accounting cases identified in the supporting documents.
- **FR-030**: The system MUST expose enough evidence in read models for users to understand why a row is full, partial, unresolved, unsupported, or excluded.

**Business Logic Definitions For Data Model Identification**

- **BL-001**: The engine MUST identify every persisted model from canonical evidence in this order: canonical transaction, canonical logs/internal transactions, canonical movements, decoded call tree, domain event, domain entity link, enrichment result, accounting record, and finally materialized read model.
- **BL-002**: The engine MUST treat Moralis decoded address transactions as the collection/discovery source for wallet history, not as semantic authority for final classification.
- **BL-003**: The engine MUST persist raw provider payloads, provider cursors, source endpoint, query parameters, provider row count, canonical transaction hash, block number, transaction index, log index, and collection version before classification begins.
- **BL-004**: The engine MUST use a chain-aware canonical key for each transaction: `chainId + walletAddress + txHash`. Provider duplicate rows MUST be reported and deduplicated without changing activity totals.
- **BL-005**: The engine MUST create canonical logs keyed by `chainId + txHash + logIndex`, canonical internal transactions keyed by source transaction and internal trace identity, and canonical movements keyed by source transaction/log/trace evidence.
- **BL-006**: The engine MUST persist ABIs, selectors, event topics, contract kind, protocol, provenance, source URL, verification status, fetch status, and decode version in a contract ABI registry.
- **BL-007**: The engine MUST create `canonical_calls` for direct decoded calls and nested calls such as `multicall(bytes[])`, batch calls, or router calls, preserving parent/child call paths and target contract identity.
- **BL-008**: The engine MUST create domain events only after canonical evidence exists; domain events MUST never be the only copy of raw transaction evidence.
- **BL-009**: The engine MUST create domain links only when a domain event has explicit evidence for a deposit, strategy exposure, pool, reward, governance lock, governance epoch, activity row, or protocol registry entity.
- **BL-010**: The engine MUST identify manual deposit entities by explicit position identity, such as NFT position token id, position manager, pool address, mint/increase/decrease/collect/burn events, and ownership evidence.
- **BL-011**: The engine MUST identify strategy exposure entities by explicit wrapper/share/staking-reward/vault evidence, user share movements, strategy contract calls, and confirmed underlying pool mapping; strategy-owned internal pool activity MUST NOT become manual deposit activity.
- **BL-012**: The engine MUST identify pool entities by `chainId + poolAddress`; token pair labels, tick spacing, fee tier, stable/volatile kind, and pool display names are attributes, not identity.
- **BL-013**: The engine MUST identify governance locks by `chainId + votingEscrowAddress + lockTokenId`; direct locks, user locks deposited into managed/relay tokens, and managed token ids MUST remain separate identities.
- **BL-014**: The engine MUST identify governance reward claim items by source transaction/log/call evidence, reward type, token, amount, source contract, lock token id when present, and parent claim batch when present.
- **BL-015**: The engine MUST identify protocol-level reward distributor-to-pool links through contract evidence such as `Voter.GaugeCreated`, validated registry calls, or equivalent protocol registry evidence; the link MUST be reusable across wallets.
- **BL-016**: The engine MUST identify price points by `chainId + tokenAddress + pricedAt/block + source + resolution`, and MUST keep current price points separate from historical event price points.
- **BL-017**: The engine MUST identify enrichment needs by natural dedupe keys, including ABI by contract, token metadata by token address, historical price by token/time, pool definition by pool address, NFT transfer backfill by token contract/token id, transaction decoded backfill by transaction hash, and protocol registry backfill by protocol contract/event.

**Business Logic Definitions For Transaction Classification**

- **BL-018**: The engine MUST classify transactions strictly in chronological order using block timestamp, block number, transaction index, and log order; later transactions MAY depend on entities created or updated by earlier transactions.
- **BL-019**: Failed or reverted transactions MUST be persisted and shown as failed activity, but MUST NOT create deposits, rewards, cash flows, governance lock state, or read-model balances.
- **BL-020**: Native transfers with the connected wallet as recipient and no supported protocol call evidence SHOULD classify as cash-in; native transfers sent by the wallet SHOULD classify as cash-out or gas/native transfer depending on transaction context and internal trace evidence.
- **BL-021**: ERC20 approvals MUST classify as approvals when decoded input/logs prove owner, spender, token, and amount; approvals MUST NOT create cash flow, reward, deposit, or strategy events.
- **BL-022**: Swaps MUST classify from router/pool call evidence, token movements, and decoded swap events; the engine MUST preserve token-in/token-out, wallet movement direction, USD value at event time, and source residual allocation evidence where accounting can resolve it.
- **BL-023**: Manual Aerodrome deposit transactions MUST classify from position manager calls/events and explicit position token id, including mint, increase liquidity, decrease liquidity, collect, burn, stake, unstake, and claim flows where owner identity is explicit.
- **BL-024**: Mellow or other automated strategy transactions MUST classify from strategy wrapper/share/staking-reward contract evidence and user share movements; internal pool rebalances, mints, burns, or collects emitted by strategy contracts MUST remain strategy-owned activity.
- **BL-025**: Pool activity MUST classify as pool context only when pool address, pool definition, gauge relation, vote argument, or position identity explicitly references the pool; pool context alone MUST NOT imply user ownership.
- **BL-026**: Governance lock creation MUST classify from `VotingEscrow.createLock` or equivalent verified lock-creation flows and matching `VotingEscrow.Transfer`/`Deposit` evidence, then create or update `governance_locks` and `governance_lock_events.create_lock`.
- **BL-027**: Governance lock increases, extensions, withdrawals, transfers, and relocks MUST classify from decoded VotingEscrow inputs/events and MUST update the lifecycle for the referenced lock token id only.
- **BL-028**: `depositManaged(userTokenId, managedTokenId)` MUST classify as a managed/relay deposit transition for an existing user lock, not as creation of the user lock or ownership of the managed token id.
- **BL-029**: If a governance method references an unknown lock token id, the engine MUST create a partial lock shell and enqueue lock identity backfill; it MUST NOT fabricate the lock origin from the consuming transaction.
- **BL-030**: Governance vote and poke transactions MUST classify from Voter input/events and lock token id; internal gauge deposit/withdraw logs caused by vote/poke MUST NOT create manual deposits or cash flows.
- **BL-031**: `claimBribes` and `claimFees` MUST classify as governance claim batches with child reward items, derived from decoded input arrays and matching transfer logs, rather than as a single vague reward.
- **BL-032**: `RewardsDistributor.claim` and `claimMany` MUST classify as governance rebase claims when input token id, `Claimed` event, AERO transfer to VotingEscrow, and `VotingEscrow.Deposit` agree on token id and amount.
- **BL-033**: Rebase rewards re-locked into VotingEscrow MUST be recorded as non-liquid governance reward items with `valueEffect=locked_aero_increase`, `cashFlowKind=none`, and a lock lifecycle event; they MUST NOT be cash-in or liquid rewards.
- **BL-034**: Transactions with supported parent calls that contain nested semantic child calls MUST materialize parent and child domain events so DataViews can show both batch summary and itemized effects.
- **BL-035**: Transfer-only token receipts with no supported claim surface MUST classify as unsupported, airdrop-like, spam, phishing, or unknown transfer based on explicit evidence; they MUST NOT contribute to rewards unless a supported claim surface proves ownership and source.

**Business Logic Definitions For Enrichment**

- **BL-036**: Enrichment completes missing evidence but MUST NOT rewrite a previously classified semantic action unless new persisted ABI/on-chain evidence directly contradicts or refines the earlier classification.
- **BL-037**: Enrichment MUST be DB-first and cache-first: check canonical tables, protocol registries, persisted provider records, and persisted enrichment results before any external provider call.
- **BL-038**: Provider/API calls during enrichment MUST be deduplicated by natural key, rate-limit aware, retryable, and persisted with source, request, response reference, attempt count, last error, and retry timing.
- **BL-039**: Request-time APIs for DataViews MUST NOT run enrichment; unresolved gaps remain visible until analysis/enrichment jobs persist new evidence.
- **BL-040**: ABI enrichment MUST fetch or verify ABIs through persisted explorer/Sourcify/GitHub/protocol sources, store selector/event coverage, and make the registry reusable for future wallets.
- **BL-041**: Token metadata enrichment MUST collect decimals, symbol, name, category, spam/trust hints, verification state, and source; metadata hints alone MUST NOT override strong protocol evidence.
- **BL-042**: Historical pricing enrichment MUST prefer event-time/block-aware price data, persist source and resolution, record provider divergence, and mark price unavailable when no reliable event-time price exists.
- **BL-043**: Current-state enrichment through RPC, Alchemy, or LpSugar MAY hydrate current lock, pool, strategy, range, and share state, but MUST NOT replace historical transaction lifecycle evidence.
- **BL-044**: Pool definition enrichment MUST resolve token0, token1, tick spacing/fee tier, stable/volatile kind, pool factory, gauge, reward surfaces, and current state only from explicit pool contract/registry evidence.
- **BL-045**: `protocol_reward_distributor_pool_links` MUST be built primarily from `Voter.GaugeCreated(pool, bribeVotingReward, feeVotingReward, gauge, ...)` or equivalent protocol registry evidence; claim items MUST keep `poolId=null` until that link exists.
- **BL-046**: Lock identity backfill MUST run only for supported protocol methods that reference a strong lock token id absent from canonical history, and MAY use NFT transfer history plus decoded transaction backfill exactly once per deduped entity key.
- **BL-047**: Managed/relay current-state enrichment MAY use Aerodrome helper/sugar or VotingEscrow/Voter calls to validate `userTokenId -> managedTokenId`, but the relationship MUST remain persisted and chain-scoped before UI consumption.
- **BL-048**: Strategy enrichment MAY use Mellow contract calls, staking reward contracts, metadata, and LpSugar only after a strategy wrapper/share identity is discovered from transaction evidence.

**Business Logic Definitions For Accounting**

- **BL-049**: Accounting MUST run after classification and required enrichment planning, and MUST preserve chronological order for lots, residual inventory, ownership state, and lifecycle effects.
- **BL-050**: Accounting MUST separate historical event valuation from current valuation; current prices MUST NOT be substituted for missing historical prices.
- **BL-051**: Cash-in/cash-out accounting MUST classify external wallet funding and exits separately from swaps, deposits, withdrawals, reward claims, gas, and internal strategy/pool movements.
- **BL-052**: Residual inventory accounting MUST track token lots by source event and pool/strategy/deposit context when explicit evidence exists; residual allocation MUST be visible when swaps consume more inventory than one pool/deposit explains.
- **BL-053**: Manual deposit accounting MUST compute opened value, increased/decreased capital, withdrawn value, collected fees/rewards, current or closed value, realized/unrealized PnL, range state, and performance decomposition from explicit position lifecycle evidence.
- **BL-054**: Strategy accounting MUST compute deposited value, withdrawn value, shares received/redeemed/current, share-level current value, claimed rewards, strategy result, and coverage state from explicit strategy exposure evidence.
- **BL-055**: Pool accounting MUST aggregate wallet exposure, capital, rewards, fees, strategy exposure, manual deposits, and residual inventory only from explicit links, and MUST avoid double counting between manual and strategy sources.
- **BL-056**: Reward accounting MUST count each reward item once in portfolio totals, even if it appears in Governance, Rewards, Pools, Activity, Deposits, or Strategies.
- **BL-057**: Governance accounting MUST compute lock exposure, lock lifecycle, vote epochs, bribe/fee/rebase/relay rewards, managed lock participation, and governance return from explicit lock, vote, claim, and enrichment evidence.
- **BL-058**: Pool contribution for rewards MUST be `contributes`, `none`, `unresolved`, or `excluded`; unresolved pool association MUST block pool totals while preserving reward visibility in Rewards/Governance.
- **BL-059**: Excluded spam, phishing, unsupported airdrops, and malicious rows MUST remain inspectable in Activity/Rewards where relevant but MUST NOT affect portfolio, reward, pool, deposit, strategy, or governance totals.

**Resolved Edge Case And Bug Handling Rules**

- **BL-060**: Provider row count mismatch is a collection/canonicalization safeguard: provider rows may exceed distinct transactions, but totals MUST use distinct canonical transactions and report skipped/duplicate rows.
- **BL-061**: When a lock appears first in `depositManaged`, the engine MUST treat `depositManaged` as a managed transition, create a partial lock shell, and resolve origin through lock identity backfill rather than creating the lock at that transaction.
- **BL-062**: A lock received by protocol grant, transfer, or another external mechanism MUST be represented as received by that source only when NFT transfer history, decoded origin transaction, and protocol-known-address evidence support that origin.
- **BL-063**: Direct lock, user lock deposited into managed/relay, and managed token id MUST never be merged by wallet, timing, relay label, or voting behavior.
- **BL-064**: ClaimBribes child items MUST be created by matching each transfer to wallet where transfer source belongs to decoded bribe contracts and transfer token belongs to the decoded token list for that bribe contract.
- **BL-065**: ClaimFees child items inside direct calls or nested multicalls MUST be detected by decoded child call arguments and matching transfer evidence, even when no single top-level event says "claim fees".
- **BL-066**: Governance rebase claims MUST verify equality between decoded input token id, `Claimed` token id, AERO transfer amount, and `VotingEscrow.Deposit` value before producing a high-confidence rebase item.
- **BL-067**: Bribe/fee distributor-to-pool mapping MUST use `Voter.GaugeCreated` or equivalent contractual registry evidence; the engine MUST NOT infer the pool from reward token pair, time window, recent vote, or UI label.
- **BL-068**: If an ABI, selector, event topic, token metadata, historical price, pool definition, lock identity, strategy relation, or distributor link cannot be resolved, the engine MUST persist an enrichment gap with reason codes and keep the affected row partial/unresolved.
- **BL-069**: If evidence conflicts, the engine MUST preserve both evidence records, mark a conflict reason code, avoid confident totals for the conflicting field, and make the issue reproducible through regression fixtures.

### Constitution Alignment Requirements *(mandatory)*

- **CA-001 Brand**: Feature MUST preserve The Cab control-tower brand tone and avoid hype/casino/meme product language in user-facing surfaces.
- **CA-002 Localization**: Feature MUST define i18n namespace impact and prohibit hardcoded user-facing copy in UI.
- **CA-003 Localization Formatting**: Feature MUST specify locale-aware formatting impact for numbers/currency/percentages/dates where applicable.
- **CA-004 Chain Awareness**: Feature MUST define chainId handling across domain identity, API contracts, and query keys.
- **CA-005 Provider Boundaries**: Feature MUST identify data-source ownership: Moralis for wallet history discovery, Alchemy for prices and chain reads, explorer/Sourcify sources for verified ABIs, and persisted read models for request-time DataViews.
- **CA-006 Explainability**: Feature MUST describe coverage/confidence behavior when data reconstruction is partial or unknown.
- **CA-007 Testing Boundary**: Feature MUST define automated validation without Playwright, browser E2E, or automated browser/a11y suites. Auth-gated UI validation, when needed, MUST be manual and recorded as product/developer signoff evidence.

### Key Entities *(include if feature involves data)*

- **Canonical Transaction**: A deduplicated wallet transaction with chain, wallet, hash, chronological order, status, input, value, raw source reference, and decoded hints.
- **Canonical Log**: A transaction log with address, topics, data, order, decoded event evidence, and source linkage.
- **Canonical Internal Transaction**: Internal native movement or call trace associated with a canonical transaction, including errors/reverts.
- **Canonical Movement**: Native, ERC20, ERC721, or protocol movement extracted from transaction evidence before final accounting.
- **Canonical Call**: A decoded call node for a transaction, including direct calls, nested multicall payloads, batch calls, target contract, selector, decoded args, parent call, and decode evidence.
- **Contract ABI Record**: Verified ABI evidence for a chain contract, including provenance, contract kind, protocol, source, and selector/event coverage.
- **Selector/Event Mapping**: Function selector or event topic mapping used to decode inputs/logs and support classification.
- **Domain Event**: A protocol-level semantic event such as swap, manual deposit, strategy deposit, vote, bribe claim, fee claim, rebase claim, unsupported activity, or excluded activity.
- **Domain Event Link**: An explicit evidence-backed relation between a domain event and a deposit, strategy, pool, reward, governance lock, epoch, or activity row.
- **Enrichment Gap**: A persisted missing-evidence record that identifies the entity, evidence needed, source category, status, attempts, and reason codes.
- **Protocol Contract Record**: A chain-scoped registry row for core protocol contracts, discovered contracts, verified known addresses, contract kind, protocol role, source evidence, and versioning.
- **Protocol Reward Distributor Pool Link**: A chain-scoped registry relation connecting a bribe or fee distributor to a gauge and pool using `Voter.GaugeCreated` or equivalent explicit protocol evidence.
- **Token Metadata Record**: Chain-scoped token display, decimals, category, trust, and spam hint data used for display and normalization.
- **Price Point**: Event-time or current token valuation with timestamp, source, confidence, and divergence/availability metadata.
- **Accounting Lot**: A chronological inventory/capital lot created by cash-in, swap, deposit, withdrawal, claim, or residual movement evidence and consumed only by explicit accounting rules.
- **Residual Inventory Record**: Remaining token inventory linked to a source event and, when explicit, a pool/deposit/strategy context for later attribution.
- **Deposit Read Model**: Materialized lifecycle, position, range, valuation, rewards, and performance data for manual deposits.
- **Strategy Read Model**: Materialized exposure, share-level value, rewards, lifecycle, coverage, and pool mapping data for automated strategies.
- **Pool Read Model**: Materialized pool definition, wallet exposure, history, rewards, composition, and timeline data.
- **Reward Read Model**: Materialized historical reward rows and breakdowns with ownership, source, value, pool contribution, and exclusion state.
- **Governance Lock**: A persisted veAERO lock identity keyed by chain, voting escrow contract, wallet, and lock token id. Direct lock creation flows such as `VotingEscrow.createLock` create or update this entity, while managed/deposited and grant/transfer-in flows update lifecycle and relationship state without merging distinct token ids.
- **Governance Lock Event**: A persisted lifecycle event linked to a Governance Lock, including create, increase, extend, rebase relock, managed deposit, managed withdraw, grant/transfer-in, and withdraw events.
- **Governance Managed Lock Link**: An explicit relationship between a user lock token id and a managed/relay token id, sourced from `depositManaged`, VotingEscrow/Voter state, or persisted Aerodrome helper/sugar evidence.
- **Governance Reward Item**: A child reward item inside governance claim flows, including bribe, fee, rebase, relay, or unknown governance reward types.
- **Activity Read Model**: Materialized immutable audit trail row and selected-detail evidence for wallet activity.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: From Moralis decoded address transaction collection results or their deterministic fixtures, 100% of provider rows are either canonicalized, deduplicated, or explicitly reported as skipped/duplicate with reason.
- **SC-002**: 100% of canonical transactions in a run are processed in oldest-to-newest chronological order before dependent read models are materialized.
- **SC-003**: Governance regression cases for direct lock creation, managed-lock deposit relation, vote, poke, bribe claim, and rebase claim are classified with explicit evidence and no identity merging errors.
- **SC-004**: Known spam/phishing/airdrop-like transfers are excluded from reward totals in 100% of regression cases while remaining inspectable as excluded activity.
- **SC-005**: Known claimBribes and rebase claim fixtures produce child reward items and non-liquid rebase value effects with no double counting across Rewards and Governance.
- **SC-006**: For every materialized DataView row with incomplete data, users can see a coverage/confidence state and a reason code explaining what is missing.
- **SC-007**: Request-time DataView loading for Activity, Deposits, Strategies, Pools, Rewards, and Governance completes using persisted analysis outputs only.
- **SC-008**: Manual deposits, strategy exposures, pools, rewards, and governance rows reconcile across DataViews so that a single reward or event is counted once in aggregate totals.
- **SC-009**: Historical valuation uses event-time pricing or records valuation unavailable; no regression case uses current price as historical event value.
- **SC-010**: The feature reduces known analysis drift classes documented in the supporting reports to explicit resolved classifications, enrichment gaps, unsupported rows, or excluded rows.
- **SC-011**: 100% of nested multicall or batch regression transactions produce a decoded call tree and preserve parent/child domain event relationships where ABIs are available.
- **SC-012**: 100% of governance claim regression items with explicit token/amount/source evidence remain visible in Rewards and Governance even when pool mapping is unresolved.
- **SC-013**: 0 regression cases assign pool contribution from reward token pair, time window, UI label, or recent vote without explicit protocol registry evidence.
- **SC-014**: 100% of lock references with missing origin create a partial lock identity and exactly one deduplicated identity backfill need per chain/token contract/token id.
- **SC-015**: 100% of known rebase claim regression cases are non-liquid, update lock lifecycle, and do not count as cash-in.
- **SC-016**: 100% of request-time DataView API contracts can be verified as DB-only with no Moralis, Alchemy, RPC, explorer, Sourcify, or protocol-contract calls.

## Assumptions

- The first supported chain for this feature is Base, and all identities must include chain context.
- The feature targets one connected wallet at a time.
- Overview remains out of scope until historical read models are stable.
- Existing DataView screens remain consumers of materialized read models; this feature changes their data foundation rather than redesigning the screens.
- Existing auth/session and connected wallet flow remain unchanged.
- Provider data and verified ABI data are immutable or versioned enough to cache once and reuse safely, while current values can have shorter freshness windows.
- Moralis wallet history may be incomplete for referenced entities, so the engine must support backfills from other persisted or chain sources.
- Historical prices may be unavailable for some tokens or moments; unavailable valuation is acceptable when explicitly surfaced.
- Deterministic fixture files captured from Moralis decoded address transaction responses remain available under `docs/api-research/moralis` as regression inputs.
- User-facing text generated by this feature will be covered by existing or new i18n namespaces during implementation.

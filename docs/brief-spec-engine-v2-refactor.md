# Brief Para Spec: Analysis Engine V2

Fecha: 2026-05-31

## Proposito

Este documento consolida el aprendizaje del relevamiento del engine actual, los endpoints Moralis/Alchemy, las ABIs de Aerodrome/Mellow, los mockups de DataViews y los gaps detectados en las transacciones reales de la wallet analizada.

Debe usarse como input directo para crear el feature spec del refactor:

```text
Analysis Engine V2: Historical Transaction Processor And DataView Read Models
```

## Problema A Resolver

El engine actual produce datos inconsistentes porque mezcla fases por pantalla, interpretaciones de Moralis y heuristicas contables. Eso genera:

- governance txs no identificadas correctamente;
- rewards falsas por phishing/airdrops;
- rewards reales sin breakdown suficiente;
- rangos historicos de deposits incorrectos;
- cash-in/cash-out mal identificados;
- valuaciones historicas inconsistentes;
- lifecycle incompleto de locks, deposits y strategies;
- request-time/UI dependiendo de read models que nacen de clasificaciones debiles.

El nuevo engine debe ser un analizador historico de transacciones, no un conjunto de fases por DataView.

## Alcance Del Feature

Implementar el Analysis Engine V2 para una wallet conectada en Base, enfocado en reconstruccion historica y materializacion de read models para:

- Activity
- Deposits
- Strategies
- Pools
- Rewards
- Governance

Overview queda fuera del refactor inicial. Se refactorizara despues de que los read models historicos sean confiables.

## Principio Central

El engine debe procesar historicamente:

```text
collect decoded history
  -> persist canonical tx/log/internal tx/movements
  -> decode ABI inputs/logs
  -> classify tx chronologically
  -> enrich missing data
  -> run accounting
  -> materialize read models
```

La clasificacion final se basa en nuestro conocimiento de Aerodrome/Mellow, ABIs, logs, inputs y movimientos. Moralis ayuda a recolectar y descubrir, pero no decide la semantica final.

## Fuentes Y Responsabilidades

### Moralis

Usar para recoleccion historica inicial:

```text
GET /api/v2.2/{address}/verbose?chain=base&order=ASC&include=internal_transactions&limit=100
```

Responsabilidad:

- traer txs en orden historico o paginables;
- incluir logs, decoded events, internal txs, input, status, timestamps;
- proveer hints de metadata/spam;
- no actuar como autoridad final de clasificacion.

### BaseScan / Etherscan / Sourcify

Usar para ABIs verificadas, solo analysis-time:

- DB-first;
- Redis/cache despues;
- provider call solo si falta ABI;
- persistir en `contract_abis`;
- persistir selectors en `contract_abi_selectors`.

### Alchemy

Usar para:

- historical prices;
- current prices;
- RPC `eth_call`;
- `eth_getLogs` backfills;
- LpSugar calls via RPC cuando aplique.

### Moralis Token Metadata / Price Fallback

Usar metadata por batch para symbols, decimals, categories, spam hints. Puede usarse price by block como validacion/fallback puntual, no como fuente unica de pricing historico.

## Pipeline Requerido

### Stage 0: Protocol And ABI Bootstrap

- Persistir contratos core de Aerodrome/Mellow por chain.
- Persistir ABIs verificadas.
- Registrar selectors y event topics.
- Permitir discovery dinamico de pools, gauges, bribe/fee distributors, wrappers y strategies.
- No hardcodear pools ni strategy addresses de una wallet.

### Stage 1: Historical Collection

- Recolectar todas las paginas Moralis decoded history.
- Persistir raw pages.
- Upsert en canonical tx store.
- Deduplicar por `(chainId, walletAddress, txHash)`.
- Reportar provider row count vs distinct tx hash count.
- Si hay paginas pendientes, reencolar collection job.
- No analizar paginas en memoria antes de persistirlas.

### Stage 2: Canonicalization

Persistir:

- `canonical_transactions`
- `canonical_transaction_logs`
- `canonical_internal_transactions`
- canonical token/native/NFT movements
- raw source refs

Orden canonical:

```text
block_timestamp ASC,
block_number ASC,
transaction_index ASC,
tx_hash ASC,
log_index ASC
```

### Stage 3: ABI Decode And Call Tree

- Decodificar input principal con ABI DB-first.
- Decodificar logs con ABI DB-first.
- Decodificar nested `multicall(bytes[])` o batch calls.
- Persistir call tree o nested call evidence.
- Si falta ABI, crear `enrichment_need: fetch_abi`.

### Stage 4: Chronological Classification

Procesar tx por tx desde la mas antigua a la mas reciente.

Emitir `domain_events`, no read models directos.

Clasificar soportado:

- native/token cash-in/cash-out;
- approvals;
- swaps;
- manual LP mint/increase/decrease/collect/burn;
- gauge stake/unstake/reward;
- Mellow strategy deposits/withdrawals/share movements/rewards;
- Aerodrome governance create/increase/extend/rebase/managed deposit/vote/poke/claim bribes/claim fees;
- failed tx;
- unsupported tx;
- phishing/airdrop/excluded transfers.

### Stage 5: Enrichment Planner

Crear needs deduplicados:

- token metadata;
- historical prices;
- current prices;
- ABI fetch;
- pool definition;
- position current state;
- strategy current state;
- lock identity backfill;
- bribe/fee distributor pool mapping;
- LpSugar current snapshot;
- global log backfill for referenced entities missing origin.

### Stage 6: Accounting

Accounting debe correr cronologicamente y producir:

- capital in/out;
- residual inventory;
- deposits lifecycle;
- strategy share accounting;
- rewards at claim value;
- governance lock/epoch/reward accounting;
- pool aggregate accounting;
- coverage/confidence/reason codes.

### Stage 7: Read Model Materialization

Materializar read models DB-only para DataViews:

- Activity ledger and detail.
- Deposits summaries/lifecycle/performance.
- Strategies summaries/lifecycle/rewards.
- Pools summaries/history/timeline.
- Rewards rows/breakdowns/detail.
- Governance locks/epochs/rewards/metrics/detail.

Request-time APIs no deben llamar Moralis, Alchemy, RPC, BaseScan ni Sourcify.

## Modelo De Datos Nuevo O Reforzado

Agregar/formalizar:

- `canonical_transactions`
- `canonical_transaction_logs`
- `canonical_internal_transactions`
- `canonical_calls` o call tree equivalente
- `contract_abis`
- `contract_abi_selectors`
- `token_metadata`
- `domain_events`
- `domain_event_links`
- `enrichment_needs`
- `governance_locks`
- `governance_lock_events`
- `governance_reward_claim_items`

Extender o reforzar:

- `price_points` con block/provider/source metadata.
- `pools` con token0/token1/tickSpacing/factory/gauge/distributor fields o metadata normalizada.
- `reward_events` para child items y no double counting.
- `ledger_events` como materializacion de Activity, no como fuente primaria de clasificacion.

Mantener como read models:

- `deposit_wallet_summaries`
- `deposit_lifecycle_events`
- `deposit_performance_decompositions`
- `strategy_wallet_summaries`
- `strategy_history_snapshots`
- `strategy_lifecycle_events`
- `pool_wallet_summaries`
- `pool_history_snapshots`
- `pool_timeline_events`
- `governance_*` read models actuales, ajustados al nuevo source.

## Reglas De Clasificacion

### Regla General

No inferir ownership, pool, deposit, strategy, reward, epoch o lock sin evidencia explicita.

Evidencia explicita puede ser:

- function args decoded;
- event args decoded;
- tokenId;
- share token/wrapper;
- pool address;
- gauge/distributor mapping;
- transfer logs;
- known protocol contract kind;
- contract state read specific to referenced entity.

### Airdrop / Phishing

Transferencias entrantes sin accion soportada, sin claim surface y con hints de spam quedan:

```text
status = excluded
affectsTotals = false
visibleInActivity = true
visibleInRewardsExcluded = true when relevant
```

No deben entrar como rewards resueltas.

### Composite / Multicall

Una tx puede tener un parent event y N child events.

Ejemplo:

```text
governance_claim_batch
  -> governance_bribe_claim_item
  -> governance_fee_claim_item
  -> governance_rebase_claim_item
```

Rewards/Governance deben mostrar child items. Activity puede mostrar parent con detail/children.

### Governance Locks

Separar identidades:

- direct wallet lock tokenId;
- managed/deposited user tokenId;
- managed/relay tokenId.

Nunca fusionar locks por cercania temporal o por wallet. Si una tx referencia un lock que no vimos nacer, crear shell parcial + backfill.

Caso fixture:

- `110971`: lock creado via `createLock`, lifecycle directo.
- `113464`: aparece en `depositManaged`, requiere identity backfill.
- `10298`: managed token relacionado, no wallet-owned directo.

### Governance Rewards

- `claimBribes` con ABI decodificada puede crear child items de bribe por token/source.
- `claimFees` dentro de claim-all/multicall debe decodificarse como child item.
- `RewardsDistributor.claim` debe crear rebase item linked al lock tokenId.
- Rebase relocked no es cash-in liquido; es reward no liquida con value effect hacia locked AERO/veAERO.

### Deposits

- Crear manual deposit solo si hay tokenId/position identity explicita.
- `Mint/IncreaseLiquidity/DecreaseLiquidity/Collect/Burn` de PositionManager reconstruyen lifecycle.
- Gauge internals dentro de governance vote/poke no son deposits manuales.

### Strategies

- Mellow strategy exposure nace de wrapper/share evidence.
- LpSugar hidrata current state solo despues de match explicito por wrapper/position.
- Mellow internal rebalances no son manual deposits.

### Pools

- Pool identity es address-first.
- Label se deriva de token0/token1/tickSpacing.
- Pool aggregates solo incluyen rewards/deposits/strategies/governance con link explicito.

## DataView Outputs

### Activity

Debe poder mostrar:

- interpreted events;
- action/surface/movement/value;
- coverage/confidence;
- unsupported/excluded rows;
- selected detail evidence, movements, contracts, sources.

### Deposits

Debe poder mostrar:

- manual position list;
- opened/closed/current values;
- range and in-range state;
- lifecycle timeline;
- fees/rewards/performance decomposition.

### Strategies

Debe poder mostrar:

- exposures by strategy/pool;
- share-level value;
- rewards claimed;
- lifecycle;
- coverage notes.

### Pools

Debe poder mostrar:

- pool definitions;
- value/current composition;
- active range;
- fees/rewards/APR/IL;
- pool timeline;
- detail panel.

### Rewards

Debe poder mostrar:

- all historical rewards;
- source/pool/token breakdowns;
- ownership trace;
- excluded/unresolved activity;
- no double counting.

### Governance

Debe poder mostrar:

- KPI strip;
- lock panel;
- epoch timeline;
- rewards table;
- reward-type breakdown;
- selected detail rail;
- relay/managed state when proven or partial with explicit bug/backfill state.

## Regressions Obligatorias

Fixture real: six Moralis pages from `docs/api-research/moralis/address-transactions-decoded-page*.json`.

Must cover:

1. Canonical tx count equals distinct tx hash count.
2. `0xe1132344...` creates lock `110971`.
3. `0xc220cbbd...` creates managed lock event `113464 -> 10298` and enqueues identity backfill.
4. Votes for `110971` do not merge with `113464`.
5. `claimBribes` creates parent + child reward items.
6. `RewardsDistributor.claim` creates non-liquid rebase reward linked to lock.
7. Claim-all/multicall fixture decodes child `claimFees` when present.
8. Airdrop/phishing transfers are excluded and do not affect rewards totals.
9. Manual deposits are created only from explicit position tokenId evidence.
10. Strategy deposits are identified by Mellow wrapper/share evidence, not as manual deposits.
11. Pool totals do not double count rewards shown in Rewards/Governance/Strategies.
12. Historical prices are event-time values, not current values.

## Non Goals

- No transaction execution.
- No raw explorer replacement.
- No generic activity-only page.
- No speculative APR marketing.
- No overview refactor in this feature.
- No request-time provider calls.
- No heuristics by pool + time window.
- No hardcoded user-specific pools/locks/strategies.

## Acceptance Criteria

- Fresh analysis from an empty DB can collect, cache, classify and materialize the wallet history without repeated provider calls for immutable data.
- The engine processes transactions chronologically.
- Every provider/API call is analysis-time, cached and persisted.
- Every visible number has source, coverage and confidence.
- DataViews read only from DB read models.
- Bugs/gaps are persisted as explicit partial/unresolved/excluded states with reason codes and enrichment needs.
- The known governance lock/managed case is represented without merging identities.
- The known bribe/rebase cases produce reward rows with correct ownership and no double counting.
- The spam/airdrop case is excluded from rewards totals.

## Documentos De Soporte

- `docs/informe-analisis-engine-historico.md`
- `docs/informe-refactor-recoleccion-historica-moralis.md`
- `docs/plan-refactor-engine-procesador-transacciones.md`
- `docs/plan-refactor-engine-enrichment-accounting.md`
- `docs/informe-modelo-datos-engine-v2.md`
- `docs/informe-engine-v2-bugs-gaps.md`
- `docs/api-research/moralis/address-transactions-decoded-classification-notes.md`
- `docs/api-research/abis/selector-matches-address-transactions-decoded.md`

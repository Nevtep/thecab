# Plan De Refactor Del Engine: Enrichment, Accounting Y Read Models

## Contexto

Este documento continua `docs/plan-refactor-engine-procesador-transacciones.md` y parte de la conclusion ya validada: el engine nuevo debe clasificar transacciones cronologicamente desde Moralis decoded history + ABIs verificadas, y luego enriquecer/accounting/materializar read models para las dataviews.

Revision complementaria de modelo de datos:

- `docs/informe-modelo-datos-engine-v2.md`
- `docs/brief-spec-engine-v2-refactor.md`

El objetivo de esta etapa no es refactorizar Overview. Overview queda fuera hasta que el analysis engine historico este funcionando y genere modelos coherentes para Deposits, Strategies, Pools, Rewards, Governance y Activity.

Las pantallas actuales y mockups ya expresan bastante bien que datos debe consumir la UI. El problema principal es que la logica actual mezcla fases por pantalla, datos procesados por Moralis y heuristicas contables que producen drift. La nueva arquitectura debe separar:

1. recoleccion historica;
2. decodificacion ABI y clasificacion semantica;
3. enriquecimiento deterministico;
4. accounting cronologico;
5. materializacion de read models.

## Principios De La Siguiente Etapa

- DB primero, Redis/cache despues, provider/API al final.
- Request-time APIs siguen siendo DB-only.
- La clasificacion no usa Moralis como autoridad semantica final.
- Los enrichments completan datos, no cambian la accion clasificada salvo evidencia ABI/onchain nueva.
- No se hardcodean pools, estrategias o contratos de usuario. Se permite bootstrap de contratos core de protocolo por chain, pero pools/gauges/wrappers/strategies se descubren desde tx/logs/ABIs/registries.
- Todo dato visible debe llevar `chainId`, fuente, cobertura y confianza.
- Si no hay evidencia explicita para pool, lock, deposit, strategy, reward ownership o epoch, el read model queda `partial`, `unresolved` o `unknown`.
- Las valuaciones historicas usan precios al momento del evento. Las valuaciones actuales usan estado actual + precio actual.
- Los lifecycles se reconstruyen por identificador explicito observado en la transaccion: `tokenId` para NFT CL/manual deposit, wrapper/share address para Mellow strategy exposure, lock id/tokenId para veAERO, epoch/pool args para governance, y tx/log/movement ids para Activity. No se reconstruye lifecycle por label, pool + ventana temporal o balance actual.

## Salidas Que Debe Alimentar El Engine

### Pools

La UI de Pools necesita que cada pool sea una unidad analitica estable, no una agrupacion por label.

Datos requeridos:

- `poolId` estable por `chainId + poolAddress`.
- `poolAddress`.
- `token0Address`, `token1Address`.
- simbolos, decimales, logos y metadata de token.
- `tickSpacing` / fee tier / pool kind.
- label canonico `TOKEN0 / TOKEN1 - tickSpacing`.
- protocolo/factory/family.
- gauges y reward surfaces asociados, cuando existan.
- briber/fee distributor asociados, cuando Aerodrome lo exponga.
- estado actual: `slot0/currentTick`, rango actual de precio, si aplica.
- capital entrado/salido por pool.
- valor actual atribuido: manual + strategy + residual.
- recompensas totales por pool, sin doble conteo.
- estado activo/inactivo/cerrado.
- historial diario: deployed value, residual value, manual value, strategy value, rewards, capital in/out.
- timeline: deposit, withdraw, fee claim, gauge reward, strategy exposure, governance reward asociado, rebalance parcial/total.
- coverage/confidence y reason codes.

Fuentes propuestas:

- Clasificador/domain events para detectar pools en `Swap`, `Mint`, `IncreaseLiquidity`, `Deposit`, `Withdraw`, `claimFees`, gauge events y governance vote params.
- ABIs verificadas y registry DB para inferir si un address es `Pool`, `Gauge`, `Voter`, `Briber`, `RewardsDistributor`, `LpWrapper`.
- RPC `eth_call`:
  - pool `token0()`, `token1()`, `tickSpacing()` cuando el ABI lo permita;
  - pool `slot0()` para tick actual;
  - router/factory `poolFor(...)` o factory lookup solo para verificar pool, no para inventar ownership;
  - position manager `factory()` para registrar factory.
- Moralis ERC20 metadata batch para metadata de tokens.
- Alchemy current prices para valor actual.
- Alchemy historical prices para capital/reward valuation.
- Aerodrome LpSugar via Alchemy `eth_call` para ranges/current amounts cuando la fila devuelta matchea explicitamente `tokenId` o `alm`/wrapper.
- `eth_getLogs` solo como backfill si Moralis decoded history no trae logs suficientes para un bloque/rango/contrato ya identificado.

### Deposits

Deposits debe modelar exposiciones manuales/user-owned de Aerodrome, principalmente por NFT token ID.

Datos requeridos:

- `depositId` estable por `chainId + positionManagerAddress + tokenId`.
- `walletAddress`, `poolId`, `positionManagerAddress`, `tokenId`.
- estado: open active, open out of range, closed.
- `openedAt`, `closedAt`, txs de apertura/cierre.
- `tickLower`, `tickUpper`, `tickSpacing`.
- `rangeLowerPrice`, `rangeUpperPrice`, quote token para display.
- `isInRange` actual.
- token0/token1 amounts por evento y actual.
- `liquidity` por lifecycle event cuando aplica.
- stake/unstake en gauge cuando existe.
- capital entrado en USD al momento de cada aporte.
- capital retirado en USD al momento de cada retiro/decrease/collect close.
- fees LP colectadas, separadas de gauge emissions.
- rewards claims asociados al tokenId/deposit.
- valor actual si sigue abierto.
- valor al cierre si esta cerrado.
- realized/unrealized PnL.
- asset price effect, reward/fee effect, rebalance effect y unattributed.
- lifecycle cronologico con tx hash, log index, movements, price source, confidence.

Fuentes propuestas:

- Moralis decoded history para tx/logs historicos.
- ABI decode de Position Manager:
  - `mint`, `increaseLiquidity`, `decreaseLiquidity`, `collect`, `burn`, `multicall`;
  - eventos `IncreaseLiquidity`, `DecreaseLiquidity`, `Collect`, `Transfer`.
- RPC `positions(tokenId)` para estado actual de posiciones activas.
- RPC `ownerOf(tokenId)` o transfer history para validar ownership actual/historico.
- RPC pool `slot0()` para rango actual.
- Calculo CL deterministic para convertir `liquidity + ticks + current sqrtPrice` en amounts actuales.
- Gauge events/calls para stake/unstake/rewards.
- Alchemy historical prices para cada token movement en el timestamp del evento.
- Alchemy current prices para posiciones abiertas.
- LpSugar `positions(limit, offset, wallet)` via Alchemy `eth_call` para estado/rango actual cuando el returned `id` coincide con el tokenId conocido. No reemplaza la reconstruccion historica ni crea ownership.

Reglas:

- El lifecycle del deposito se reconstruye de tx/log evidence keyed by tokenId:
  - NFT `Transfer` mint/transfer/burn;
  - PositionManager calls/events para mint/increase/decrease/collect/burn;
  - Gauge stake/unstake/reward calls/events si incluyen o pueden atarse explicitamente al tokenId.
- Si el tokenId falta, no se crea manual deposit.
- LpSugar solo puede complementar identidad/rango/current state despues de que el tokenId ya fue descubierto por tx/log/RPC ownership.

### Strategies

Strategies debe modelar exposiciones automatizadas como Mellow, separadas de Deposits.

Datos requeridos:

- `strategyId` por wrapper/strategy contract.
- `strategyExposureId` por wallet + strategy + wrapper.
- label de strategy.
- protocolo (`mellow` inicialmente).
- wrapper address, staking rewards address, vault/root vault cuando se descubra.
- share token/share behavior, share symbol/decimals si existe.
- underlying pool, con status `confirmed`, `inferred` o `unknown`.
- external strategy position reference, solo si LpSugar da match unico wallet-scoped.
- deposits/withdrawals historicos.
- shares received/redeemed/current share balance.
- token amounts depositados/retirados.
- strategy rewards claims: token, amount, USD at claim, source contract.
- current estimated value.
- current underlying token amounts si se pueden reconstruir.
- lifecycle: strategy_deposit, share_receive, claim, withdraw, share_redeem, close, internal_rebalance si detectable.
- coverage `full`, `share_level`, `partial`, `unknown`.

Fuentes propuestas:

- ABI decode de wrapper/staking rewards:
  - `mint`, `withdraw`, `getRewards`;
  - share Transfer events desde/hacia wallet;
  - reward Transfer events hacia wallet.
- RPC `balanceOf(wallet)` en wrapper/share token para current shares.
- RPC wrapper:
  - `token0()`, `token1()`;
  - `pool()`;
  - `getInfo()` cuando exista, para underlying positions/ticks/liquidity;
  - `previewMint` solo como ayuda de ratio, no como historico.
- LpSugar `positions(limit, offset, wallet)`:
  - obtener posicion actual del wallet;
  - resolver `externalStrategyPositionReference` cuando `alm == wrapperAddress` y hay un unico match;
  - usar amounts/ticks actuales como referencia de display;
  - no usar para inventar deposit lifecycle ni manual NFT.
- Official Mellow metadata:
  - usar como enrichment versionado/cacheado cuando este disponible;
  - si no existe entrada oficial, descubrir wrapper/pool/staking rewards desde ABI/RPC/logs.
- Alchemy historical/current prices.

### Rewards

Rewards debe ser claim-based, time-valued y reconciliable con Pools, Deposits, Strategies y Governance.

Datos requeridos:

- reward event id por `chainId + txHash + logIndex + rewardType`.
- reward type: LP fees, gauge rewards, mellow rewards, voting fees, bribes, rebases, unknown.
- token address/symbol/icon.
- amount raw/decimal.
- USD value at claim.
- occurredAt.
- source surface/contract.
- owner status:
  - manual deposit;
  - strategy;
  - governance;
  - unresolved;
  - excluded.
- linked entity id: depositId, strategyExposureId, governance event/lock/epoch.
- resolved pool id only with explicit evidence.
- pool contribution status: contributes, none, unresolved, excluded.
- affectsTotals flag.
- coverage/confidence and reason codes.
- excluded/spam/airdrop rows visible but not counted.

Fuentes propuestas:

- Domain events emitted by classifiers:
  - manual `collect` / `claimFees`;
  - gauge `getReward`;
  - Mellow `getRewards`;
  - governance `claimBribes`, `claimFees`, `RewardsDistributor.claim`.
- ERC20 Transfer logs to wallet for amount evidence.
- ABI input params for tokenId/pool/epoch/pool arrays when available.
- Alchemy historical prices at claim timestamp.
- Moralis token metadata for metadata/spam hints, not canonical price.
- Anti-spam/exclusion pass:
  - ERC20 airdrops with no supported claim surface stay excluded;
  - Moralis `possible_spam`, unverified metadata and suspicious transfer-only activity are evidence, not sufficient alone when protocol evidence is strong.

Double counting rules:

- One `reward_event` can be displayed in multiple contexts but counted once in portfolio totals.
- Pool aggregates can include manual rewards + strategy rewards + governance rewards only when each has explicit pool association.
- Governance rewards remain explainable in Governance and Rewards, but do not create separate pool reward totals unless Aerodrome provides pool evidence.
- Mellow rewards belong to StrategyExposure and can contribute to the underlying Pool only when the strategy-to-pool mapping is explicit/confirmed.

### Governance

Governance needs both lock state and epoch/reward context.

Datos requeridos:

- lock exposures:
  - lockId/tokenId;
  - createdAt;
  - locked AERO;
  - veAERO exposure;
  - expiry/remaining duration;
  - lifecycle: create, increase, extend, relock, withdraw, managed deposit.
- epoch summaries:
  - epoch id/start/end;
  - vote mode manual/relay/unknown;
  - voted pools;
  - weights when available;
  - reset state;
  - fees/bribes/rebases state;
  - claim/pending status;
  - coverage/confidence.
- governance reward rows:
  - reward type fee/bribe/rebase/relay/unknown;
  - token amount;
  - USD at claim;
  - epoch;
  - pool when explicit;
  - context/source evidence.
- selected-detail evidence:
  - action summary;
  - tx hash/timestamp;
  - protocol surface;
  - token movements;
  - epoch/vote/pool context;
  - evidence sources;
  - coverage notes.

Fuentes propuestas:

- ABI decode of:
  - VotingEscrow create/increase/extend/withdraw/depositManaged;
  - Voter vote/poke/reset/depositManaged/claimBribes/claimFees;
  - RewardsDistributor claim;
  - relay/briber/fee distributor contracts when discovered.
- Event logs:
  - Vote/Voted/Abstained/Reset where available;
  - Deposit/Supply in VotingEscrow;
  - reward transfer logs.
- Epoch derivation:
  - first choice: epoch fields emitted or contract-provided period if ABI/log has it;
  - second choice: Aerodrome weekly epoch calendar derived from timestamp and explicitly marked as derived;
  - never fabricate pool association from time proximity alone.
- Alchemy prices for AERO and reward tokens.
- RPC current lock state only for active/current display, not to rewrite historical events.

### Activity

Activity is the audit trail for all read models.

Datos requeridos:

- one or more activity rows per classified tx/domain event.
- tx hash, block number, timestamp, tx index.
- action/surface/protocol.
- token movements with direction, raw amount, USD value.
- value effect.
- linked pool/deposit/strategy/reward/governance entities.
- classification evidence and missing evidence reason codes.
- coverage/confidence.
- explorer link.
- unsupported/excluded/ambiguous rows visible.

Fuentes propuestas:

- Canonical decoded tx store.
- Domain events.
- Asset movements.
- Entity links created by accounting passes.
- Explorer ABI/source/evidence only if cached or needed during analysis, never request-time.

## Datos Adicionales A Obtener Despues De Clasificar

### 1. Token Metadata

Necesario para:

- symbols/decimals/logos;
- display;
- normalized amount decimals;
- spam/category hints;
- wrapped-token awareness.

Fuentes:

- Moralis batch metadata:
  - `GET /api/v2.2/erc20/metadata?chain=base&addresses=...`
- RPC fallback:
  - ERC20 `symbol()`;
  - `decimals()`;
  - `name()`.
- Existing DB/provider cache.

Persistencia:

- tabla conceptual `token_metadata` por `chainId + tokenAddress`;
- source refs y `updatedAt`;
- spam/trust hints separados de clasificacion final.

### 2. Historical Prices

Necesario para:

- valor de cada cash-in/cash-out;
- capital entered/withdrawn;
- reward value at claim;
- fees collected;
- historical snapshots;
- return and APR estimates.

Fuentes:

- Alchemy Prices historical:
  - `POST /prices/v1/{ALCHEMY_API_KEY}/tokens/historical`
  - input: network, token address, startTime, endTime, interval.
- Moralis ERC20 price by block:
  - `GET /api/v2.2/erc20/{address}/price?chain=base&to_block={blockNumber}`
  - devuelve precio puntual, exchange/pair source y `priceLastChangedAtBlock`.
- Price point DB cache.

Reglas:

- Guardar price points por `chainId + tokenAddress + pricedAt + source + resolution`.
- Para eventos, pedir ventanas agrupadas por token y dia/hora, no una request por movement.
- Preferir `1h` cerca del timestamp del evento; usar `1d` para snapshots largos si el costo lo requiere.
- Si precio no existe, marcar `priceUnavailable` y no inventar USD.
- Wrapped tokens pueden usar precio del underlying solo si el wrapper esta reconocido como canonical wrapped asset.
- Para valuacion puntual de tx, usar block-level pricing cuando exista. Si se usa Moralis `to_block`, guardar `pairAddress`, `exchangeName` y `priceLastChangedAtBlock` como evidencia.
- Para curvas historicas/snapshots diarios, usar Alchemy historical como fuente primaria por su API de series temporales. Moralis `to_block` queda como validacion puntual, fallback o fuente para eventos donde se necesita precio exacto de bloque.
- Si Alchemy y Moralis difieren fuera de tolerancia, marcar `priceProviderDivergence` y degradar coverage del valor.

### 3. Current Prices

Necesario para:

- current/closed value cuando corresponde;
- posiciones abiertas;
- strategy exposure current estimated value;
- residual attributed assets.

Fuentes:

- Alchemy Prices current:
  - `POST /prices/v1/{ALCHEMY_API_KEY}/tokens/by-address`
- Current price cache con TTL corto.

Reglas:

- No usar current price para valuar eventos historicos.
- Guardar source y timestamp de price.

### 4. Contract ABI And Contract Kind

Necesario para:

- decodificar inputs que Moralis no decodea;
- descubrir pools/gauges/strategies/governance surfaces para cualquier wallet;
- evitar hardcodeos por pool.

Fuentes:

- DB `contract_abis` o equivalente.
- Redis/provider cache.
- Etherscan/BaseScan contract source:
  - Etherscan v2 `GET /v2/api?chainid=8453&module=contract&action=getsourcecode&address=...`
  - BaseScan fallback `GET /api?module=contract&action=getsourcecode&address=...`
- Sourcify fallback opcional.

Reglas:

- Fetch solo en analysis-time.
- Guardar ABI, contractName, compiler/source metadata, proxy implementation si aparece.
- Detectar `contractKind` por ABI/signatures/contractName:
  - Pool, Gauge, Voter, VotingEscrow, RewardsDistributor, Briber, Router, PositionManager, LpWrapper, Strategy/Vault.
- Si no hay ABI verificada, dejar clasificacion parcial/unresolved.

### 5. Pool Definition And Current State

Necesario para:

- `token0/token1-tickSpacing`;
- range display;
- current in-range;
- pool-level aggregation.

Fuentes:

- ABI/RPC pool:
  - `token0()`;
  - `token1()`;
  - `tickSpacing()` for CL;
  - `stable()` or pool kind equivalent for basic pools if applicable;
  - `slot0()`.
- Router/factory calls for validation.
- Logs from PositionManager mint/increase where token0/token1/tickSpacing/ticks are already present.

Reglas:

- Pool identity is address-first, not label-first.
- Labels are derived after token metadata.
- Multiple pools with same pair must remain separate by tickSpacing/pool address.
- LpSugar puede hidratar rango/current amounts para display y validacion, pero el lifecycle historico sigue saliendo de decoded txs.

### 6. Manual Position State

Necesario para:

- current value of open deposits;
- closed value at closure;
- range and liquidity accounting.

Fuentes:

- PositionManager `positions(tokenId)`.
- PositionManager ownership checks `ownerOf(tokenId)` where needed.
- Transfer events for NFT ownership history.
- Pool `slot0()` and CL math.
- LpSugar only as current reference, not lifecycle source of truth.

Reglas:

- For closed/burned positions, current RPC may fail or return zero; use historical lifecycle and mark closed.
- For positions transferred into wallet, mark `openedByTransferIn`.
- If tokenId is missing, do not create manual deposit.

### 7. Gauge, Fees And Emission Rewards

Necesario para:

- LP emission rewards;
- staked/unstaked lifecycle;
- reward ownership by tokenId/deposit.

Fuentes:

- Gauge ABI/logs:
  - `deposit`;
  - `withdraw`;
  - `getReward`;
  - reward paid/transfer events.
- Voter/gauge mapping where Aerodrome exposes it.
- Token Transfer logs to wallet.

Reglas:

- Gauge reward claims with explicit tokenId/deposit evidence resolve to manual deposit.
- Gauge internals triggered by governance `vote`/`poke` are not manual user deposits.
- If the claim lacks tokenId/deposit owner evidence, reward remains unresolved or pool-only partial.

### 8. Strategy Definition And Current State

Necesario para:

- current Mellow strategy value;
- share-level accounting;
- underlying pool relation;
- strategy rewards and lifecycle.

Fuentes:

- Wrapper ABI/RPC:
  - `pool()`;
  - `token0()`;
  - `token1()`;
  - `getInfo()`;
  - share `balanceOf(wallet)`;
  - optional share metadata.
- StakingRewards ABI/logs.
- LpSugar `positions(limit, offset, wallet)` for current reference.
- Official Mellow metadata as a versioned enrichment source, not as a fixed hardcoded list.

Reglas:

- Dynamic discovery starts from tx `to_address`, approvals, Transfer token addresses and ABI kind.
- If wrapper/pool mapping is explicit, strategy can contribute to pool aggregate.
- If only share-level data is reliable, coverage is `share_level`.
- Internal strategy rebalances are strategy activity only when tied to known strategy contracts.
- El lifecycle de estrategia se reconstruye por wrapper/share evidence:
  - deposits/withdrawals desde wrapper calls;
  - share Transfer deltas to/from wallet;
  - staking rewards calls/transfers;
  - LpSugar solo hidrata current `alm`/position reference despues de un match unico por wrapper.

### 9. Governance Epoch, Vote And Lock State

Necesario para:

- Governance DataView and reward attribution.

Fuentes:

- VotingEscrow/Voter/RewardsDistributor ABI inputs/logs.
- Token Transfer logs.
- Alchemy prices for AERO and rewards.
- Optional RPC current lock state for active display.

Reglas:

- Epoch grouping can be derived from known Aerodrome weekly epochs but must be marked as derived unless onchain event exposes epoch.
- Pool links require explicit pool arrays, reward distributor/briber association, or persisted evidence.
- `depositManaged` needs product semantics before it impacts returns; until then classify action high but accounting partial.

### 10. Residual Attribution And Cash Inventory

Necesario para:

- pool continuity across withdraw/swap/deposit;
- cash-in/cash-out correctness;
- rebalance explanation.

Fuentes:

- Chronological domain events and asset movements.
- Cash-in native/token transfers.
- Withdraw/decrease events from known deposits/strategies.
- Swaps and transfers after withdrawal.

Reglas:

- Residual lots are per pool + token + source event.
- A withdraw creates residual inventory for the source pool.
- A swap consumes residual lots first only up to available amount.
- Excess comes from source waterfall:
  1. explicit cash-in lots;
  2. liquidation-derived inventory;
  3. pro-rata other residual lots;
  4. unresolved.
- Residual does not expire by time.

## Propuesta De Etapas Del Engine V2 Despues De Clasificacion

### Stage A: Enrichment Need Planner

Input:

- canonical decoded txs;
- classified tx outputs;
- discovered contract candidates;
- token movements;
- domain event candidates.

Output:

- batches de token metadata;
- batches de historical prices;
- ABI fetch queue;
- RPC read queue;
- optional log backfill queue;
- LpSugar current-state queue.

Reglas:

- No provider call directo desde classifiers.
- El planner deduplica por `chainId + address + selector/time range`.
- Cada need tiene owner semantic: pool, deposit, strategy, reward, governance, activity.

### Stage B: Metadata And ABI Registry

Acciones:

- Upsert token metadata.
- Upsert contract ABI records.
- Upsert protocol contract registry.
- Re-run selector decode for txs that were partial due missing ABI.

Output:

- contract kind for discovered addresses.
- stable ABI selector index.
- token metadata map.

### Stage C: Pricing Materialization

Acciones:

- Agrupar movements por token and timestamp bucket.
- Fetch historical price series from Alchemy for snapshot windows.
- Fetch or validate event spot prices from Moralis `to_block` when exact block-level valuation is needed.
- Persist price points.
- Attach price source to movements/events.

Output:

- token movements valued at event time.
- reward USD values at claim.
- capital in/out USD values.

### Stage D: Pool And Position Enrichment

Acciones:

- Materialize pool definitions.
- Enrich current pool state via `slot0`.
- Enrich open manual positions via `positions(tokenId)`.
- Enrich strategy wrappers via wrapper RPC + LpSugar current reference.

Output:

- pools table and metadata complete.
- deposit/strategy identities linked to pools where explicit.
- current state payloads for accounting.

### Stage E: Chronological Accounting Pass

Input order:

```text
block_timestamp ASC,
block_number ASC,
transaction_index ASC,
log_index ASC/domain_sequence ASC
```

Responsabilidad:

- Maintain wallet inventory lots.
- Maintain per-pool residual lots.
- Maintain deposit lifecycles by tokenId.
- Maintain strategy exposure lifecycles by wrapper/share.
- Maintain governance lock/epoch state.
- Resolve reward ownership.
- Create activity rows.

Output:

- domain events with entity refs.
- asset movements with USD.
- deposit lifecycle rows.
- strategy lifecycle rows.
- reward events.
- governance events/rewards.
- attribution states/source lots.

### Stage F: Snapshot And Performance Pass

Acciones:

- Build daily snapshots for pools, deposits, strategies and rewards.
- Compute:
  - capital entered;
  - capital withdrawn;
  - rewards;
  - fees;
  - current value;
  - closed value;
  - realized/unrealized PnL;
  - total return;
  - estimated annualized return.

Reglas:

- Annualized return is estimated and coverage-tagged.
- Rewards return uses historical invested capital, not current value only.
- If capital history is incomplete, mark approximate/partial.

### Stage G: Read Model Materialization

Materializar DB-only models consumed by:

- Pools list/detail.
- Deposits list/detail.
- Strategies list/detail.
- Rewards DataView.
- Governance DataView.
- Activity ledger/detail.

Cada read model debe incluir:

- `chainId`, `walletAddress`;
- covered range;
- latest run id;
- coverage/confidence;
- reason codes;
- source evidence refs where needed.

## Cobertura Y Estados Parciales

Casos que deben degradar explicitamente:

- Missing ABI: action may be unresolved or low-confidence.
- Missing token metadata: amount raw can exist, display decimal/symbol partial.
- Missing price: event remains classified but USD value unavailable.
- Missing tokenId: no manual deposit ownership.
- Missing strategy wrapper/pool mapping: strategy exposure can be share-level but pool contribution unresolved.
- Governance claim without explicit pool/epoch evidence: governance reward visible, pool association unresolved.
- Airdrop/phishing transfer-only activity: excluded, not reward/cash-in/performance.
- `depositManaged` governance semantics incomplete: action high-confidence, accounting partial.

## API/Provider Use Summary

| Need | Provider/API | Request timing | Cache |
| --- | --- | --- | --- |
| Historical decoded txs | Moralis `/{address}/verbose?order=ASC&include=internal_transactions&limit=100` | analysis collection only | DB immutable by wallet/cursor/page/run, Redis debounce |
| Optional wallet hints | Moralis `/wallets/{address}/history` | analysis enrichment only | DB/Redis, not semantic authority |
| Token metadata | Moralis `/erc20/metadata` batch, RPC fallback | analysis enrichment | DB token metadata, long TTL |
| Contract ABI/source | Etherscan v2/BaseScan `contract/getsourcecode` | analysis enrichment | DB ABI registry, long/immutable TTL |
| Historical price series | Alchemy Prices `/tokens/historical` | analysis enrichment | DB price points |
| Historical event spot price | Moralis `/erc20/{address}/price?to_block=` and/or Alchemy nearest interval | analysis enrichment | DB price points with provider/source metadata |
| Current prices | Alchemy Prices `/tokens/by-address` | analysis/current materialization | short TTL cache + stored source timestamp |
| RPC reads | Alchemy RPC `eth_call` | analysis enrichment/materialization | DB/Redis by selector stability |
| Log backfill | Alchemy RPC `eth_getLogs` | analysis backfill only | DB raw provider records |
| LpSugar current positions | Aerodrome LpSugar `positions(limit, offset, wallet)` via RPC | analysis current-state enrichment | short TTL/current snapshot |

## Pricing Smoke Test: Alchemy vs Moralis

Se agrego `scripts/research/compare-price-providers.ts` para comparar proveedores sin tocar el engine. La prueba uso Base, bloque `36079024` (`2025-09-27T04:29:55Z`) y tokens WETH, USDC, AERO y cbBTC.

Resultado observado:

| Token | Alchemy historical | Moralis `to_block` | Observacion |
| --- | ---: | ---: | --- |
| WETH | 4023.82749368 | 4027.65416111784 | Muy cercano; Moralis indica Aerodrome pair y block exacto. |
| USDC | 0.999714017 | 1 | Ambos correctos; Moralis normaliza stable a 1. |
| AERO | 1.0391245036 | 1.0378562668732596 | Muy cercano; Moralis indica Aerodrome pair. |
| cbBTC | 109682.8068852051 | 109813.29211173877 | Muy cercano; Moralis indica Aerodrome pair. |

Decision:

- Mantener Alchemy como fuente primaria para series historicas, snapshots y curvas porque devuelve intervalos temporales consistentes.
- Usar Moralis `to_block` como fuente de precio puntual por evento o como validador/fallback cuando se necesita precio de bloque. Su `pairAddress`, `exchangeName` y `priceLastChangedAtBlock` son evidencia valiosa para explicar la valuacion.
- Persistir ambos tipos como `price_points` con `source`, `resolution`, `blockNumber/pricedAt`, `providerMetadata` y tolerancia de divergencia.
- Si el evento tiene valor critico y los providers divergen por encima de tolerancia, mantener clasificacion pero degradar la valuacion a `partial` hasta revisar source/pair/liquidity.

## No-Gos

- No usar Moralis DeFi Positions para lifecycle historico canonical.
- No usar Wallet History categories como clasificacion final.
- No usar current balances para reconstruir historico.
- No crear manual deposits desde Mellow wrapper internals.
- No asociar rewards a pools por ventana temporal.
- No ocultar unsupported/excluded rows para hacer que totales cierren.
- No hacer llamadas externas desde request-time UI/API routes.

## Validacion Necesaria

Fixtures/regresiones minimas:

1. wallet completa de 533 tx procesada ASC con 533 economic tx + excluded/noop segun corresponda.
2. cash-in native inicial valorado con ETH historical price.
3. approval no genera capital/reward.
4. failed tx visible en Activity, no afecta accounting.
5. swap clasificado y valorado sin asignarse a pool si no consume residual explicito.
6. Mellow deposit crea StrategyExposure, no Deposit manual.
7. Mellow getRewards crea strategy reward con USD at claim.
8. manual CL mint crea Deposit con tokenId/ticks/pool.
9. gauge stake/unstake actualiza deposit lifecycle.
10. gauge reward claim resuelve a deposit solo con tokenId/ownership evidence.
11. pool `claimFees` crea LP fee reward.
12. governance vote/poke no crea manual deposits desde logs internos.
13. governance bribe/fee/rebase claims visibles y reconciliables.
14. spam/airdrop transfer-only no suma rewards ni cash-in.
15. same pair different tickSpacing produces distinct pools.
16. withdraw + swap + deposit preserves pool residual continuity and marks partial attribution when needed.

## Decision Recomendada

El siguiente spec tecnico deberia ser "Analysis Engine V2 Enrichment And Accounting". Su alcance deberia implementar primero:

1. canonical decoded tx store;
2. ABI/token metadata registries;
3. enrichment need planner;
4. historical price materialization;
5. pool/deposit/strategy/governance identity materialization;
6. chronological accounting pass;
7. read model materialization for existing dataviews.

No conviene seguir corrigiendo `phase-deposits`, `phase-rewards`, `phase-governance` y `phase-activity` como fuentes principales. Pueden quedar como adapters temporales o read-model rebuilders mientras se migra, pero el comportamiento canonico debe moverse al procesador cronologico de transacciones + enrichment/accounting.

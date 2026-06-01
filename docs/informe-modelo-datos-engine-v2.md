# Informe De Modelo De Datos Para Engine V2

Fecha: 2026-05-31

## Objetivo

Este informe revisa si el modelo de datos actual alcanza para soportar las DataViews de The Cab con el engine v2 basado en historico de transacciones decodificadas, ABIs verificadas, enriquecimiento onchain y accounting cronologico.

El foco no es implementar codigo todavia. El objetivo es dejar documentado que persistir, como se conectan las entidades y que falta resolver para bajar el refactor a un spec ejecutable.

Fuentes cruzadas:

- `docs/spec/the-cab-product-technical-spec.md`
- `docs/plan-refactor-engine-procesador-transacciones.md`
- `docs/plan-refactor-engine-enrichment-accounting.md`
- `docs/informe-engine-v2-bugs-gaps.md`
- `docs/api-research/moralis/address-transactions-decoded-classification-notes.md`
- `docs/api-research/moralis/address-transactions-decoded-full-classification.json`
- mockups de Activity, Deposits, Governance, Pools, Rewards y Strategies.

## Resumen Ejecutivo

El modelo actual ya tiene muchas tablas correctas para read models de UI: pools, deposits, strategies, rewards, governance, activity/ledger, snapshots y summaries. El problema es que le falta una capa canonica transaccional entre los providers y esos read models.

Para el engine v2 hay que agregar o formalizar una capa previa:

```text
raw provider pages
  -> canonical decoded tx store
  -> canonical logs / internal tx / movements
  -> ABI registry + selector/event registry
  -> domain events clasificados
  -> enrichment/accounting
  -> read models existentes
```

Sin esa capa, los dataviews quedan dependiendo de heuristicas por pantalla o de interpretaciones parciales de Moralis. Eso explica los problemas actuales: governance incompleto, rewards de spam, airdrops mal clasificados, rangos historicos incorrectos, cash-in/cash-out debil y valuaciones incoherentes.

## Modelo Actual: Lo Que Sirve

El esquema actual tiene buena base para consumir desde la UI:

- `pools`: identidad base de pools.
- `deposits`: identidad de posiciones manuales.
- `strategies` y `strategy_exposures`: exposiciones automatizadas.
- `ledger_events` y `asset_movements`: Activity/ledger.
- `reward_events`: rewards normalizadas.
- `price_points`: cache de precios.
- `deposit_wallet_summaries`, `deposit_lifecycle_events`, `deposit_performance_decompositions`: Deposits DataView.
- `strategy_wallet_summaries`, `strategy_history_snapshots`, `strategy_lifecycle_events`: Strategies DataView.
- `pool_wallet_summaries`, `pool_history_snapshots`, `pool_timeline_events`: Pools DataView.
- `governance_events`, `governance_lock_exposures`, `governance_epoch_summaries`, `governance_reward_rows`, `governance_metric_snapshots`: Governance DataView.
- `raw_provider_records`: evidencia cruda de providers.
- `protocol_contracts`: registro basico de contratos de protocolo.
- `protocol_reward_distributor_pool_links`: relacion canonica entre
  bribe/fee distributors, gauges y pools cuando existe evidencia explicita.

Conclusion: no conviene tirar los read models. Conviene alimentar esos read models desde una capa canonica nueva y mas fuerte.

### 0. Protocol Reward Distributor Pool Links

Tabla protocol-level, reutilizable por cualquier wallet, para no inferir pool
desde tokens o ventanas temporales.

Campos sugeridos:

- `id`
- `chain_id`
- `voter_address`
- `pool_address`
- `gauge_address`
- `distributor_address`
- `distributor_kind` (`bribe`, `fee`)
- `pool_factory_address`
- `voting_rewards_factory_address`
- `gauge_factory_address`
- `created_tx_hash`
- `created_log_index`
- `created_block_number`
- `source_event_signature`
- `validated_by_call`
- `validation_block_number`
- `coverage_status`
- `confidence`
- `evidence_json`
- `created_at`
- `updated_at`

Fuente primaria:

- `Voter.GaugeCreated(poolFactory, votingRewardsFactory, gaugeFactory, pool, bribeVotingReward, feeVotingReward, gauge, creator)`.

Reglas:

- persistir dos filas por `GaugeCreated`: una para `bribeVotingReward` y otra
  para `feeVotingReward`;
- validar opcionalmente con `Voter.gaugeToBribe`, `Voter.gaugeToFees` y
  `Voter.poolForGauge` durante enrichment, nunca request-time;
- `governance_reward_claim_items.pool_id` solo se rellena desde esta tabla o
  una fuente equivalente con evidencia contractual;
- si el link no existe, el claim item queda visible con `pool_id=null` y
  `coverage_status=partial_pool_unresolved`;
- no usar token pair, ultimo voto, epoch o timestamp como sustituto del link.

## Gaps Del Modelo Actual

### 1. Falta canonical transaction store

`processed_txs` solo dice que una tx fue procesada. No guarda la tx decodificada, logs, input, status, internal tx, cursor, response source ni version de decoder.

Para engine v2 se necesita persistir cada tx historica en orden ASC, reanalizable por version de classifier.

### 2. Falta logs canonicales

Los logs son la fuente clave para:

- ERC20/721 transfers.
- PositionManager mint/increase/decrease/collect/burn.
- VotingEscrow Deposit/Supply/DepositManaged.
- Voter vote/poke/claimBribes/claimFees.
- Mellow shares/rewards.
- Claims dentro de tx compuestas.

Hoy no hay tabla queryable de logs normalizados. Si quedan solo en JSON crudo, cada materializer termina parseando diferente.

### 3. Falta ABI registry persistido

Ya investigamos ABIs para Aerodrome y Mellow, pero el engine serverless necesita DB-first. No puede depender de archivos locales ni fetch repetido.

Hay que agregar `contract_abis` y, preferentemente, `contract_abi_selectors`.

### 4. Falta domain event store

`ledger_events` existe, pero mezcla evento de UI/activity con clasificacion. Para v2 conviene separar:

- evidencia canonica de tx/log/movement;
- evento semantico clasificado;
- read model materializado.

Un `domain_events` store permite re-materializar Deposits, Rewards, Pools, Governance, Strategies y Activity sin volver a llamar providers.

### 5. Falta soporte explicito para composite/multicall

Aerodrome tiene acciones como "claim all" donde una tx puede:

- llamar `claimFees`;
- llamar `claimBribes`;
- reclamar varios tokens;
- pasar por multicall o llamadas batch;
- emitir multiples transfers desde bribe/fee distributors;
- generar una sola fila de Activity pero muchas filas de Reward/Governance.

El modelo necesita parent/child events y claim items. Una tx no equivale a un solo evento.

### 6. Governance locks necesita identidad estable

`governance_lock_exposures` es buen read model, pero no reemplaza una tabla normalizada de locks. Para explicar "tengo 2 locks y uno esta en relay/managed", se necesita:

- identidad por lock tokenId;
- lifecycle por lock;
- managed/relay relation;
- estado actual;
- eventos de rebase/relock;
- fuente de evidencia.

### 7. Pricing necesita mas metadata de calidad

`price_points` ya existe, pero para accounting historico necesita guardar mejor:

- blockNumber opcional;
- provider;
- source pair / exchange cuando aplique;
- timestamp exacto usado;
- tolerancia/divergencia entre providers;
- razon de fallback;
- si es current, historical hourly, daily o block spot.

Esto puede ir inicialmente en `metadata_json`, pero si se consulta mucho conviene columnas.

### 8. Pool definitions necesitan normalizar mas datos

El product spec y mockups muestran pools como entidades analiticas:

```text
token0 / token1 - tickSpacing
```

`pools.metadata_json` puede guardar esto, pero para filtros, joins y comparaciones conviene normalizar:

- token0/token1;
- tickSpacing;
- pool kind/factory;
- gauge;
- bribe/fee distributor;
- current tick/slot0 snapshot.

## Cambios De Modelo Propuestos

### A. `canonical_transactions`

Una fila por tx recolectada para una wallet/chain.

Campos sugeridos:

- `id`
- `chain_id`
- `wallet_address`
- `tx_hash`
- `block_number`
- `block_timestamp`
- `transaction_index`
- `from_address`
- `to_address`
- `value_native_raw`
- `input`
- `receipt_status`
- `gas_used`
- `transaction_fee_native`
- `source_provider`
- `source_endpoint`
- `source_cursor`
- `raw_provider_record_id`
- `decoded_call_json`
- `collection_run_id`
- `canonicalized_at`

Indices:

- unique `(chain_id, wallet_address, tx_hash)`
- `(chain_id, wallet_address, block_number, transaction_index)`
- `(chain_id, tx_hash)`

Uso:

- analizar siempre desde esta tabla, nunca desde provider response in-memory.
- detectar reanalysis por classifier version sin recollectar.

### B. `canonical_transaction_logs`

Una fila por log.

Campos sugeridos:

- `id`
- `canonical_transaction_id`
- `chain_id`
- `tx_hash`
- `log_index`
- `address`
- `topic0..topic3`
- `data`
- `decoded_event_json`
- `abi_id`
- `decode_status`
- `decode_confidence`

Indices:

- unique `(chain_id, tx_hash, log_index)`
- `(chain_id, address, topic0)`
- `(canonical_transaction_id, log_index)`

Uso:

- decodificar VotingEscrow `Transfer`, `Deposit`, `Supply`, `DepositManaged`.
- decodificar Voter `Voted`, claim events y gauge/bribe internals.
- reconstruir token movements y NFT ownership.

### B.1. `canonical_calls`

Call tree decodificado por transaccion.

Necesario para no perder subacciones dentro de `multicall(bytes[])`, routers o batch calls. El selector externo de una tx no siempre representa todos los efectos semanticos.

Campos sugeridos:

- `id`
- `canonical_transaction_id`
- `chain_id`
- `tx_hash`
- `call_path`
- `parent_call_id`
- `target_address`
- `selector`
- `function_name`
- `decoded_args_json`
- `raw_call_data`
- `abi_id`
- `decode_status`
- `decode_confidence`
- `created_at`

Reglas:

- `multicall(bytes[])` crea un parent call y N child calls.
- Si el multicall ejecuta en el mismo contrato, los children se decodifican con el ABI del parent target.
- Si el batch/router incluye targets por subcall, cada child se decodifica con el ABI del target indicado.
- Domain events pueden linkear a `canonical_calls.id` para distinguir `claimFees`, `claimBribes`, `collect`, `burn`, etc. dentro de la misma tx.

### C. `canonical_internal_transactions`

Una fila por internal tx/traza disponible.

Campos sugeridos:

- `id`
- `canonical_transaction_id`
- `trace_index`
- `from_address`
- `to_address`
- `value_native_raw`
- `call_type`
- `gas`
- `error`
- `raw_json`

Uso:

- failed/reverted classification.
- native transfers/cash-in/cash-out.
- evidencia de llamadas internas cuando Moralis la provee.

### D. `contract_abis`

Tabla DB-first para ABIs verificadas y actualizables.

Campos sugeridos:

- `id`
- `chain_id`
- `address`
- `implementation_address`
- `contract_name`
- `protocol`
- `contract_kind`
- `abi_json`
- `source_provider`
- `source_url`
- `source_reference`
- `bytecode_hash`
- `is_proxy`
- `verified_at`
- `fetched_at`
- `updated_at`
- `metadata_json`

Indices:

- unique `(chain_id, address, coalesce(implementation_address,address))`
- `(chain_id, protocol, contract_kind)`

Regla:

- DB primero.
- Redis/cache despues.
- BaseScan/Etherscan/Sourcify solo en analysis-time si no existe.
- Nunca request-time desde DataView.

### E. `contract_abi_selectors`

Tabla derivada para decodificar rapido.

Campos sugeridos:

- `id`
- `contract_abi_id`
- `chain_id`
- `address`
- `selector_or_topic`
- `kind` (`function` | `event`)
- `signature`
- `name`
- `input_types_json`
- `output_types_json`

Uso:

- resolver `0xe0c11f9a` como `depositManaged(uint256,uint256)` en Voter.
- resolver `0x7715ee75` como `claimBribes(...)`.
- resolver `0x7ac09bf7` como `vote(uint256,address[],uint256[])`.
- resolver nested calls en multicall.

### F. `token_metadata`

Metadata por token, no mezclada con movements.

Campos sugeridos:

- `chain_id`
- `token_address`
- `symbol`
- `name`
- `decimals`
- `logo_url`
- `categories_json`
- `possible_spam`
- `verified_contract`
- `security_score`
- `wrapped_underlying_address`
- `source_provider`
- `updated_at`

Uso:

- display y amount decimals.
- spam hints, no clasificacion final por si solos.
- wrappers/stables awareness.

### G. `domain_events`

Evento semantico clasificado, independiente de la pantalla.

Campos sugeridos:

- `id`
- `chain_id`
- `wallet_address`
- `tx_hash`
- `primary_log_index`
- `event_index`
- `occurred_at`
- `classifier_version`
- `event_type`
- `protocol`
- `surface`
- `status` (`supported`, `partial`, `unresolved`, `unsupported`, `excluded`)
- `coverage_status`
- `confidence`
- `value_usd`
- `entity_refs_json`
- `evidence_json`
- `reason_codes`
- `parent_domain_event_id`

Uso:

- fuente comun para Activity, Rewards, Deposits, Strategies, Pools y Governance.
- re-materializar read models.
- representar una tx con varios efectos.

### H. `domain_event_links`

Links explicitos a entidades.

Campos sugeridos:

- `domain_event_id`
- `entity_type`
- `entity_id`
- `relationship_type`
- `evidence_status`
- `confidence`
- `reason_codes`

Uso:

- link a pool solo si hay evidencia explicita.
- link a strategy exposure por wrapper/share.
- link a deposit por tokenId.
- link a governance lock/epoch/reward.

### I. `governance_locks`

Identidad estable de locks veAERO.

Campos sugeridos:

- `id`
- `chain_id`
- `wallet_address`
- `lock_token_id`
- `voting_escrow_address`
- `created_at`
- `created_tx_hash`
- `current_owner_address`
- `status`
- `managed_status`
- `managed_token_id`
- `relay_address`
- `locked_aero_amount`
- `ve_aero_amount`
- `expires_at`
- `coverage_status`
- `confidence`
- `metadata_json`

Uso:

- explicar multiples locks.
- separar lock normal vs managed/relay.
- alimentar Governance lock panel.

### I.1. `governance_lock_managed_links`

Relacion normalizada entre un lock de usuario y un managed/relay token.

Esta tabla es necesaria porque `depositManaged(userTokenId, managedTokenId)` y los helpers/sugar de Aerodrome devuelven una relacion entre dos identidades distintas. No debe guardarse solo como `metadata_json` del lock ni interpretarse como ownership directo del managed token.

Campos sugeridos:

- `id`
- `chain_id`
- `wallet_address`
- `voting_escrow_address`
- `lock_token_id`
- `managed_token_id`
- `managed_contract_address`
- `relay_address`
- `relation_status` (`active`, `withdrawn`, `unknown_current`)
- `source_event_id`
- `source_tx_hash`
- `source_block_number`
- `source_contract_address`
- `source_selector`
- `source_snapshot_id`
- `coverage_status`
- `confidence`
- `reason_codes`
- `metadata_json`
- `created_at`
- `updated_at`

Fuentes validas:

- `Voter.depositManaged(userTokenId, managedTokenId)` / `VotingEscrow.DepositManaged`.
- `VotingEscrow.idToManaged(userTokenId)` current-state enrichment.
- Aerodrome locks helper/sugar wallet-scoped, por ejemplo `0x4c5d3925fe65dfeb5a079485136e4de09cb664a5` selector `0x47f7e06f(address)`, siempre ejecutado durante analysis enrichment y cacheado/persistido.

Reglas:

- `managed_token_id` no crea un lock wallet-owned.
- El link no reemplaza el lifecycle historico del user lock.
- Request-time APIs consumen esta relacion desde DB/read models; no llaman helper/sugar.
- Si el helper devuelve una relacion que contradice el historial, conservar ambas evidencias y marcar conflicto para revision en vez de sobrescribir silenciosamente.

### J. `governance_lock_events`

Lifecycle normalizado por lock.

Campos sugeridos:

- `id`
- `governance_lock_id`
- `domain_event_id`
- `event_type`
- `tx_hash`
- `log_index`
- `occurred_at`
- `token_id`
- `managed_token_id`
- `aero_amount`
- `value_usd`
- `expires_at_after`
- `coverage_status`
- `confidence`
- `evidence_json`

Tipos:

- `create_lock`
- `increase_amount`
- `extend_lock`
- `rebase_claim_relock`
- `deposit_managed`
- `withdraw_managed`
- `withdraw_lock`

### K. `governance_reward_claim_items`

Item normalizado dentro de un claim governance.

Campos sugeridos:

- `id`
- `parent_domain_event_id`
- `reward_event_id`
- `chain_id`
- `wallet_address`
- `tx_hash`
- `log_index`
- `reward_type`
- `token_address`
- `amount_raw`
- `amount_decimal`
- `value_usd_at_claim`
- `liquid`
- `value_effect`
- `cash_flow_kind`
- `epoch_id`
- `pool_id`
- `lock_token_id`
- `bribe_contract_address`
- `source_log_index`
- `source_contract_address`
- `source_contract_kind`
- `parent_call_id`
- `dedupe_key`
- `affects_totals`
- `coverage_status`
- `confidence`
- `evidence_json`

Uso:

- una tx `claim all` puede tener N items.
- Rewards y Governance pueden mostrar cada item sin doble conteo.
- `claimBribes` materializa un item por transfer validado desde bribe contract hacia wallet, usando `(tx_hash, log_index)` como dedupe.
- `pool_id` y `epoch_id` pueden quedar parciales sin degradar accion/token/amount.
- Activity puede mostrar un parent con children.
- `RewardsDistributor.claim` materializa items `reward_type=rebase`,
  `liquid=false`, `value_effect=locked_aero_increase` y
  `cash_flow_kind=none` cuando el input `claim(tokenId)`, el evento
  `Claimed`, la transferencia AERO al `VotingEscrow` y el evento
  `VotingEscrow.Deposit` coinciden en `tokenId` y `amount`.
- Un rebase re-lock aumenta el lifecycle del lock, pero no es cash-in ni
  recompensa liquida disponible para la wallet.

### L. `enrichment_needs`

Cola persistente de enriquecimientos deduplicados.

Campos sugeridos:

- `id`
- `chain_id`
- `need_type`
- `entity_type`
- `entity_key`
- `priority`
- `status`
- `attempt_count`
- `provider`
- `request_json`
- `result_ref_json`
- `last_error`
- `created_at`
- `updated_at`

Tipos:

- `fetch_abi`
- `fetch_token_metadata`
- `fetch_historical_price`
- `fetch_current_price`
- `eth_call_pool_definition`
- `eth_call_position_state`
- `eth_call_strategy_state`
- `eth_call_lock_state`
- `lp_sugar_position_snapshot`
- `nft_transfer_backfill`
- `transaction_decoded_backfill`
- `lock_identity_backfill`

Uso:

- serverless safe.
- retry/debounce.
- no hardcodear pools/strategies actuales.
- `nft_transfer_backfill` debe deduplicar por
  `(chain_id, token_address, token_id)`.
- `transaction_decoded_backfill` debe deduplicar por `(chain_id, tx_hash)`.
- `lock_identity_backfill` solo se encola cuando un metodo soportado de
  governance/lock referencia un tokenId ausente del canonical store; no corre
  para transfers nativos, ERC20/NFT genericos ni Activity rows comunes.

## Composite, Multicall Y Claim All

El engine v2 debe tratar una tx como contenedor, no como una unica accion.

Caso esperado:

```text
Aerodrome claim all
  parent domain event: governance_claim_batch
  child item 1: governance_fee_claim_item
  child item 2: governance_fee_claim_item
  child item 3: governance_bribe_claim_item
  child item N: governance_rebase_claim_item
```

Reglas:

- si el input es `multicall(bytes[])`, decodificar cada payload con `contract_abi_selectors`;
- si el input es `claimBribes`, `claimFees` o `RewardsDistributor.claim`, crear parent event y luego items por transfer/source/pool/epoch cuando exista evidencia;
- si no se puede resolver pool o epoch, el item queda `partial` pero visible;
- ningun item cuenta dos veces en Rewards/Pools/Governance;
- Activity puede mostrar parent batch y selected-detail con children;
- Rewards/Governance pueden listar los child items.

Este punto es obligatorio para no esconder `claimFees` y bribes dentro de calls compuestas.

## Locks, Relay Y Reglas Genericas De Identidad

El modelo debe soportar multiples locks por wallet y distinguir, sin hardcodeos:

- locks directos creados o recibidos por la wallet;
- locks de usuario depositados en managed/relay;
- managed/relay token ids agregadores;
- eventos de vote, poke, claimBribes, claimFees, rebase claim y depositManaged asociados a cada identidad.

Reglas de clasificacion:

- Un lock directo se crea o actualiza solo cuando hay evidencia explicita de `VotingEscrow`, como `Transfer` desde zero hacia la wallet o un flujo ABI/log verificado de creacion de lock.
- `depositManaged(userTokenId, managedTokenId)` no es creacion de lock. Es una relacion entre un user lock existente y un managed/relay token. Ambos IDs deben quedar separados.
- Si una accion governance referencia un `userTokenId` que no fue creado ni recibido en el wallet-centric history, el engine crea una identidad parcial y dispara `lock_identity_backfill`.
- El backfill se aplica solamente a metodos governance con identidad fuerte de lock ausente, como `depositManaged`, `vote`, `poke`, `claimBribes`, `claimFees` o `RewardsDistributor.claim`; no se aplica a transfers nativos, ERC20 ni NFTs genericos.
- El backfill debe ser minimo y cacheado: primero DB, luego una consulta de NFT transfer history por `(chainId, votingEscrowAddress, tokenId)` y, solo si aparece una tx candidata, una consulta decoded transaction por `(chainId, txHash)`.
- Un lock recibido por grant, transfer o mecanismo externo queda registrado por el origen probado. No se marca como creado por la wallet ni por la accion posterior que lo consume.
- La etiqueta `relay` solo se usa cuando metadata/eventos/estado del managed token o contrato lo prueban. En caso contrario, se muestra como managed con cobertura parcial.
- Nunca fusionar locks por cercania temporal, wallet, pool, epoch o similitud de accion.

Esto responde al caso general de wallets con mas de un lock: el modelo debe reconstruir cada lifecycle por token id y relacionar depositos managed/relay sin mezclar identidades. Los detalles de fixtures reales y bugs de lock identity backfill quedan en `docs/informe-engine-v2-bugs-gaps.md`.

## Datos Por DataView Que Debe Poder Producir El Modelo

### Activity

Mockup exige:

- KPIs de eventos, interpretados, resueltos y cobertura.
- timeline/barras por periodo.
- tabla densa con accion, superficie, movimiento, valor, cobertura, confianza y tx.
- detalle lateral con movimientos, contratos relacionados, evidencia, notas y fuentes.

Modelo requerido:

- `canonical_transactions`
- `canonical_transaction_logs`
- `domain_events`
- `domain_event_links`
- `asset_movements`
- `contract_abis`
- `token_metadata`
- `price_points`

### Deposits

Mockup exige:

- depositos manuales por position tokenId.
- pool, estado, opened/closed, opened value, current/closed value, return, APR, coverage/confidence.
- detalle lateral con current value, lifecycle timeline, performance decomposition, explorer.

Modelo requerido:

- `deposits`
- `deposit_lifecycle_events`
- `deposit_performance_decompositions`
- `domain_events`
- `domain_event_links`
- pool definitions normalizadas.
- price points historicos/current.
- position enrichment por `tokenId`.

### Governance

Mockup exige:

- KPI strip: locked AERO, veAERO exposure, lock expiry, governance rewards, estimated return.
- lock status panel persistente.
- vote timeline por epoch.
- governance rewards table.
- reward breakdown.
- selected detail rail con evidence/source links.

Modelo requerido:

- `governance_locks`
- `governance_lock_events`
- `governance_epoch_summaries`
- `governance_reward_claim_items`
- `governance_reward_rows`
- `governance_metric_snapshots`
- `domain_events`
- explicit pool/epoch links.

### Pools

Mockup exige:

- pool identity con pair/tickSpacing.
- value, impermanent loss, fees, APR, active range.
- composition actual.
- performance history.
- details con pool contract/explorer.

Modelo requerido:

- `pools` extendido/normalizado.
- `pool_wallet_summaries`
- `pool_history_snapshots`
- `pool_timeline_events`
- explicit links desde deposits/strategies/rewards/governance.
- LpSugar/current pool state enrichment.

### Rewards

Mockup exige:

- rewards historicas, no solo 30 dias.
- source breakdown, pool contribution breakdown, token breakdown.
- selected detail con ownership trace, pool contribution, claim details, coverage notes.
- excluded/unresolved activity visible.

Modelo requerido:

- `reward_events`
- `governance_reward_claim_items`
- `domain_event_links`
- `asset_movements`
- `token_metadata`
- price points at claim.
- parent/child composite support para claim all.

### Strategies

Mockup exige:

- strategy exposures separadas de manual deposits.
- share-level coverage.
- rewards claimed.
- lifecycle and coverage note.
- mapping confirmed/partial to pool.

Modelo requerido:

- `strategies`
- `strategy_exposures`
- `strategy_lifecycle_events`
- `strategy_wallet_summaries`
- `domain_events`
- wrapper/share token state.
- LpSugar/Mellow current state enrichment only after explicit wrapper match.

## Review Del Engine V2 Documentado

El engine v2 propuesto queda coherente si se implementa asi:

1. **Collection**
   - Moralis `/verbose?order=ASC&include=internal_transactions` o paginado cursor.
   - Persistir raw page y canonical txs.
   - No clasificar desde memoria.

2. **ABI/selector discovery**
   - Core protocol bootstrap para Aerodrome/Mellow.
   - ABIs verificadas DB-first.
   - BaseScan/Etherscan/Sourcify solo si falta ABI y solo analysis-time.
   - Registrar selectors/events.

3. **Canonical decode**
   - Decodificar input.
   - Decodificar logs por ABI.
   - Decodificar nested multicall payloads.
   - Crear movements canonicos.

4. **Chronological classification**
   - Procesar de mas antigua a mas reciente:

   ```text
   block_timestamp ASC,
   block_number ASC,
   transaction_index ASC,
   log_index ASC
   ```

   - Emitir domain events.
   - Nunca crear ownership si falta tokenId/share/lock/pool explicit evidence.

5. **Enrichment planner**
   - Token metadata.
   - ABIs faltantes.
   - historical/current prices.
   - pool definitions.
   - position/strategy/lock current state.
   - LpSugar snapshots.

6. **Accounting cronologico**
   - capital lots;
   - residual inventory;
   - deposits lifecycle;
   - strategy share accounting;
   - rewards valuation;
   - governance lock/epoch/reward accounting.

7. **Read model materialization**
   - Activity, Deposits, Strategies, Pools, Rewards, Governance.
   - APIs request-time DB-only.

Este flujo esta listo para bajarse a `speckit-specify` como feature de refactor del analysis engine.

## Decisiones Que Ya Estan Claras Para El Spec

- El engine se reemplaza conceptualmente por un procesador historico de tx.
- Moralis decoded history es fuente de recoleccion, no autoridad semantica final.
- ABIs verificadas son necesarias y deben persistirse en DB.
- La clasificacion es tx-by-tx, cronologica, no por pantalla.
- Los dataviews consumen read models materializados.
- Request-time APIs siguen DB-only.
- `claim all`/multicall requiere parent/child events.
- Pool/reward/deposit/strategy/governance associations requieren evidencia explicita.
- Airdrops/phishing sin superficie soportada quedan excluded/visible, no rewards.
- Pricing historico se obtiene despues de clasificar, con Alchemy como fuente primaria para series y Moralis block price como fallback/validacion puntual.
- LpSugar complementa estado/rangos actuales, no inventa lifecycle historico.

## Inputs Que Faltan O Conviene Confirmar

No veo blockers duros para crear el spec. Si queres maxima precision antes de especificar, conviene confirmar estos puntos:

1. **Semantica visible de `depositManaged`**
   - Resolucion: mostrarlo como `Managed lock deposit` con coverage parcial si no se resuelve la identidad completa del lock o del managed token.
   - Etiquetar como `relay` solo cuando el managed token/contract metadata lo pruebe. Hasta entonces, `managed` es la semantica segura.

2. **Lock referenciado sin origen en wallet history**
   - Una tx governance puede usar un lock token id cuyo mint/transfer no aparece en el historial wallet-centric.
   - Resolucion: el engine debe hacer backfill por historial NFT del contrato/token id y, si hace falta, decoded tx de la transferencia candidata.
   - Si el backfill prueba un grant/transfer-in, clasificar el origen como recibido por esa fuente y no como creacion de la wallet.
   - No marcar el lock como creado en la tx que lo consume, por ejemplo `depositManaged`. Crear shell si falta origen y luego actualizar a `origin_status=resolved_from_nft_transfer_history` cuando el backfill encuentre evidencia.

3. **Claim all en Activity**
   - Recomendacion: Activity muestra una fila parent `governance_claim_batch` y el detail rail muestra child items. Rewards/Governance muestran los child reward rows.
   - Falta confirmar si queres que la tabla principal de Activity tambien pueda expandir children.

4. **Rebases re-locked**
   - Recomendacion: contarlos como governance reward con `liquid=false` y efecto de valor hacia locked AERO/veAERO, no cash-in.
   - Falta confirmar si deben entrar en "governance rewards claimed" aunque no sean liquidos.

5. **Tolerancia de pricing**
   - Recomendacion inicial: marcar `priceProviderDivergence` si Alchemy vs Moralis difiere mas de 1% para blue chips/stables o mas de 3% para long-tail tokens.
   - Falta definir tolerancias finales.

6. **Relay metadata source**
   - Recomendacion: identificar relay/managed label por contratos Aerodrome verificados, eventos y/o registry onchain, no por address hardcodeada.
   - Falta validar fuente oficial exacta si existe.

7. **APR/return formulas finales**
   - Los mockups muestran estimated return/APR por pantalla.
   - Recomendacion: documentar formula por DataView en el spec y degradar a `estimated` si falta capital historico completo.

## Conclusion

Si seguimos con engine v2, el modelo debe evolucionar agregando una capa canonica y reusable, no parches por pantalla. Los read models actuales se pueden conservar y alimentar mejor.

La pieza mas importante nueva es:

```text
canonical tx/log store + contract ABI registry + domain events + enrichment needs
```

Con eso The Cab puede clasificar cualquier wallet compatible con Aerodrome/Mellow sin conocer de antemano sus pools o strategies, y puede materializar las DataViews actuales con trazabilidad, coverage y confianza.

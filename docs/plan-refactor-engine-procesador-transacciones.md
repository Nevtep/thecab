# Plan De Refactor: Engine Como Procesador Historico De Transacciones

Fecha: 2026-05-31

## Decision De Arquitectura

El engine actual debe reemplazarse como modelo conceptual. No conviene seguir agregando fases separadas por pantalla o por resultado (`phase-deposits`, `phase-rewards`, `phase-governance`, etc.) sobre datos ya interpretados por Moralis. El nuevo engine debe ser un procesador cronologico de transacciones decodificadas:

```text
Recolectar tx decodificadas -> persistir canonical tx store -> ordenar ASC -> clasificar tx por tx -> materializar read models
```

Moralis debe usarse para recoleccion historica y discovery rapido, no como autoridad semantica final. Alchemy debe usarse para pricing historico/current, RPC reads y enriquecimiento onchain. Aerodrome/Mellow deben clasificarse por conocimiento propio de contratos, funciones, logs y movimientos.

Esta decision esta alineada con el spec de arquitectura:

- Moralis es para wallet-centric data, discovery rapido, wallet history y Overview, no lifecycle analytics canonico.
- Alchemy es para pricing, RPC-backed reconstruction, `eth_getLogs`, `eth_call` y validacion.
- La jerarquia de fuentes dice que onchain RPC reads/event logs son la semantica canonica, Moralis wallet APIs son discovery, y no se deben tratar Moralis decoded labels como clasificacion final.

Referencias locales:

- `docs/spec/the-cab-feature-feasibility-implementation-architecture.md:778`
- `docs/spec/the-cab-feature-feasibility-implementation-architecture.md:876`
- `docs/spec/the-cab-feature-feasibility-implementation-architecture.md:1010`
- `docs/spec/the-cab-product-technical-spec.md:560`
- `docs/spec/the-cab-protocol-mechanics-research-aerodrome-mellow.md:1004`

## Principios Del Nuevo Engine

1. **DB primero, API despues**
   - El engine nunca analiza directamente una pagina recien llegada del proveedor.
   - Primero persiste raw page, tx canonica, logs, decoded call, decoded events e internal transactions.
   - El analisis lee solo nuestro store.

2. **Historico primero**
   - La recoleccion puede paginar en DESC por eficiencia incremental.
   - El analisis siempre procesa en orden:

```text
block_timestamp ASC,
block_number ASC,
transaction_index ASC,
tx_hash ASC,
log_index ASC
```

3. **Clasificacion por protocolo, no por pantalla**
   - No hay fase conceptual de depositos/rewards/governance.
   - Hay una sola pasada cronologica que clasifica cada tx y emite efectos de dominio.
   - Depositos, rewards, governance, pools, activity y strategies son read models derivados.

4. **Moralis no decide clasificacion final**
   - `category`, `summary` y labels de Moralis son evidencia secundaria.
   - La clasificacion final se decide por:
     - contract address;
     - decoded call signature/label/params;
     - decoded event signature/label/params;
     - token movements;
     - known protocol registry;
     - explicit ownership identities.

5. **Unresolved antes que inventado**
   - Si falta evidencia para owner, pool, epoch, deposit, reward, strategy o governance surface, el output queda unresolved/partial.
   - No hay fallback por pool + tiempo.
   - No hay fallback por "parece reward" si no hay superficie explicita.

6. **Enrichment no es autoridad**
   - LpSugar, `eth_call`, Alchemy prices, BaseScan/Etherscan y Moralis Wallet History enriquecen o verifican.
   - No reemplazan la identidad canonica salvo cuando el spec lo permite explicitamente.

## Nuevo Pipeline Propuesto

### Stage 0: Protocol Registry Bootstrap

Objetivo: construir el mapa de conocimiento de Aerodrome/Mellow antes de analizar tx.

Inputs:

- Chain config Base.
- Aerodrome router entrypoint.
- Official/verified contract addresses.
- ABIs versionadas para Router, Pool, Gauge, Voter, VotingEscrow, Briber, FeeDistributor, RewardDistributor, PositionManager, Mellow wrappers/staking.
- Mellow official strategy metadata.

Acciones:

1. Persistir core protocol contracts.
2. Descubrir factory via `router.defaultFactory()`.
3. Descubrir pool/gauge/reward distributor cuando aparezcan en tx/logs.
4. Mantener `ProtocolContract` versionado con provenance.
5. Registrar function selectors y event signatures soportadas.

Output:

- `protocol_contracts`
- `protocol_function_signatures`
- `protocol_event_signatures`
- `strategy_definitions`
- coverage de bootstrap

Notas:

- Router discovery no es suficiente para stake/unstake/rewards/governance.
- Governance debe incluir VotingEscrow, Voter, Relay, Briber, FeeDistributor, RewardDistributor/Rebase.

### Stage 1: Historical Transaction Collection

Objetivo: traer todo el historial decodificado de la wallet y guardarlo sin analizar.

Fuente primaria candidata:

```text
GET /api/v2.2/{address}/verbose?chain=base&include=internal_transactions&limit=100&order=DESC
```

Fuente complementaria:

```text
GET /api/v2.2/wallets/{address}/history?chain=base&include_internal_transactions=true&limit=100&order=DESC
```

Acciones:

1. Crear `wallet_transaction_collection_run`.
2. Pedir pagina decoded tx por cursor.
3. Persistir raw page con request hash y response hash.
4. Upsert de cada tx en canonical transaction store.
5. Upsert de logs decodificados.
6. Upsert de internal transactions.
7. Upsert de enrichment Moralis Wallet History si se decide recolectarlo en paralelo o luego.
8. Si hay cursor y no se alcanzo stop condition, reencolar collection task con el cursor siguiente.
9. Si no hay cursor o se alcanzo fin historico/cache estable, marcar collection complete.

Stop conditions:

- No hay cursor siguiente.
- Se encuentra una tx ya recolectada y no hay gaps historicos pendientes.
- Se alcanza limite defensivo de paginas por job, pero se reencola; no se marca complete.

Regla clave:

```text
tx recolectada != tx analizada
```

Una tx puede estar cacheada y necesitar reanalisis si cambia la version del classifier.

### Stage 2: Canonical Transaction Normalization

Objetivo: transformar el raw provider payload en una representacion neutral propia.

Inputs:

- `wallet_transactions`
- `wallet_transaction_logs`
- `wallet_internal_transactions`
- optional `wallet_history_enrichment`

Outputs:

- `canonical_transactions`
- `canonical_calls`
- `canonical_logs`
- `canonical_movements`
- `canonical_token_metadata_hints`

Normalizacion minima por tx:

- chainId
- walletAddress
- txHash
- blockNumber
- blockTimestamp
- transactionIndex
- from/to
- status
- gas/fee
- input
- decodedCall signature/label/params
- logs con address/topics/logIndex/decodedEvent
- internal transfers
- raw source pointers

Normalizacion de movimientos:

- ERC20 Transfer logs.
- Native value transfers.
- Internal native transfers.
- ERC721/position transfers.
- Direction relative to wallet.
- Counterparty.
- Token metadata hints.
- No pricing todavia, salvo si el provider trae valor como evidencia secundaria.

### Stage 3: Chronological Classification Pass

Objetivo: procesar cada tx una vez, en orden historico, y emitir efectos de dominio.

Orden:

```text
oldest tx -> newest tx
```

Estado en memoria/persistido durante la pasada:

- open manual deposits;
- known NFT tokenIds owned by wallet;
- staked LP positions;
- strategy exposures;
- veAERO locks;
- votes by epoch;
- reward ownership context;
- known spam/phishing assets;
- cash basis/capital lots;
- residual attribution state.

Para cada tx:

1. Construir `TransactionEvidence`.
2. Resolver `ProtocolSurface`.
3. Ejecutar classifiers en orden de especificidad.
4. Emitir `DomainEvent` uno o muchos.
5. Actualizar state.
6. Persistir trace explicable.

Clasificacion por orden recomendado:

1. Failed/reverted tx.
2. Spam/phishing/airdrop exclusion guard.
3. Known protocol direct call.
4. Known protocol event/log evidence.
5. Governance surfaces.
6. Deposit/withdraw/stake/unstake surfaces.
7. Reward/fee/bribe/rebase surfaces.
8. Swap/router/pool surfaces.
9. Strategy wrapper/staking surfaces.
10. Cash-in/cash-out.
11. Unsupported/unknown.

El cash-in/cash-out debe ser ultimo porque es un fallback economico, no una semantica protocolar.

### Stage 4: Protocol Classifiers

Objetivo: reemplazar las heuristicas globales por classifiers especificos versionados.

#### Aerodrome Manual LP Classifier

Detecta:

- add liquidity;
- remove liquidity;
- mint/burn LP;
- concentrated position mint/increase/decrease/collect;
- stake LP;
- unstake LP;
- gauge reward claims.

Evidencia primaria:

- Router/PositionManager decoded call.
- Pool events.
- Gauge events.
- LP/ERC721 token transfers.
- AERO/reward token transfers.

Outputs:

- `deposit_created`
- `deposit_increased`
- `deposit_decreased`
- `deposit_withdrawn`
- `deposit_staked`
- `deposit_unstaked`
- `deposit_reward_claimed`

#### Governance Classifier

Detecta:

- lock creation;
- lock increase;
- lock extension;
- relock;
- lock withdrawal;
- vote;
- vote reset;
- relay participation;
- fee claim;
- bribe claim;
- rebase claim;
- governance reward claim.

Evidencia primaria:

- VotingEscrow decoded calls/events.
- Voter decoded calls/events.
- Briber/FeeDistributor/RewardDistributor events.
- veNFT tokenId.
- epoch/pool params when available.
- token movements around claim.

Outputs:

- `governance_lock_created`
- `governance_lock_increased`
- `governance_lock_extended`
- `governance_vote_cast`
- `governance_vote_reset`
- `governance_fee_claimed`
- `governance_bribe_claimed`
- `governance_rebase_claimed`

#### Strategy/Mellow Classifier

Detecta:

- wrapper deposit;
- wrapper withdraw;
- staking rewards claim;
- share-level accounting;
- strategy rebalance where visible;
- strategy reward flows.

Evidencia primaria:

- Mellow wrapper/staking decoded calls/events.
- Official strategy metadata.
- token/share movements.
- LpSugar enrichment only as external deterministic reference when unique.

Outputs:

- `strategy_exposure_opened`
- `strategy_exposure_increased`
- `strategy_exposure_decreased`
- `strategy_exposure_closed`
- `strategy_reward_claimed`
- `strategy_rebalance_observed`

#### Swap/Cash Classifier

Detecta:

- swaps;
- routing;
- external deposits/cash-in;
- external withdrawals/cash-out.

Regla:

- Si toca contrato de protocolo conocido, no clasificar como cash-in/out sin descartar primero protocol semantics.
- Cash-in/out solo con counterparty externo y movimientos economicos simples o claramente no protocolarios.

#### Trust/Spam/Airdrop Classifier

Detecta:

- phishing airdrops;
- spam tokens;
- untrusted tokens;
- unsolicited inbound transfers;
- fake rewards.

Evidencia:

- Moralis `possible_spam` / `verified_contract`.
- Token metadata.
- Known protocol token registry.
- Contract/source evidence when available.
- No user action / unsolicited transfer.
- No decoded protocol surface.

Output:

- `excluded_airdrop`
- `excluded_phishing`
- `unsupported_spam`

Regla:

- Un excluded no suma rewards, cash-in, performance ni governance totals.
- Puede aparecer en Activity como excluded/unsupported con evidencia.

### Stage 5: Enrichment Passes

Objetivo: completar datos necesarios sin contaminar clasificacion.

#### Alchemy Pricing

Usos:

- historical token prices for event-time valuation;
- current prices for current position valuation;
- no Moralis prices as canonical source.

Regla:

```text
flow valuation = event time
position valuation = current or snapshot time
```

#### RPC/eth_call Enrichment

Usos:

- Router `defaultFactory()`;
- Router `poolFor(...)`;
- gauge-to-pool mapping;
- token decimals/symbol fallback;
- pool slot0/current tick for current position view;
- Mellow wrapper/share state;
- LpSugar positions for dashboard-facing reference.

#### LpSugar

Uso:

- Hidratar Overview/current strategy display.
- Resolver `externalStrategyPositionReference` cuando `row.alm == strategy.wrapperAddress` y hay un unico match wallet-scoped.

No uso:

- No reemplazar `StrategyExposure`.
- No convertir en manual NFT tokenId.
- No usar para inventar ownership.

### Stage 6: Domain Event Store

Objetivo: persistir una secuencia canonica explicable de eventos de dominio.

Tabla conceptual:

```text
domain_events
```

Identidad:

```text
chainId + walletAddress + txHash + eventIndex + classifierVersion
```

Campos:

- eventType
- protocol
- protocolSurface
- occurredAt
- blockNumber
- txHash
- logIndexes
- movementIndexes
- entity refs: depositId, strategyId, strategyExposureId, governanceLockId, poolId, epochId
- valueUsd
- valueSource
- coverage
- confidence
- reasonCodes
- evidenceJson

Esto reemplaza la idea de que `ledgerEvents` por si solo sea suficiente para dataviews.

### Stage 7: Read Model Materialization

Objetivo: construir pantallas desde eventos canonicos, no desde provider payloads.

Materializadores:

- Overview.
- Pools.
- Deposits.
- Strategies.
- Rewards.
- Governance.
- Activity.

Regla:

```text
read models = derivaciones DB-only del domain event store + state snapshots
```

No deben llamar Moralis, Alchemy, RPC ni explorer en request-time.

## Modelo De Datos Recomendado

Nuevas tablas o conceptos:

1. `wallet_transaction_collection_runs`
2. `wallet_transaction_pages`
3. `wallet_transactions`
4. `wallet_transaction_logs`
5. `wallet_internal_transactions`
6. `canonical_transactions`
7. `canonical_asset_movements`
8. `transaction_classification_traces`
9. `domain_events`
10. `domain_state_snapshots`
11. `protocol_function_signatures`
12. `protocol_event_signatures`
13. `analysis_versions`

Tablas existentes a migrar o redefinir:

- `ledger_events`: puede quedar como Activity/read model o renombrarse semanticamente.
- `asset_movements`: debe venir de canonical movements.
- `reward_events`: debe derivarse de `domain_events`.
- `governance_*`: debe derivarse de governance domain events.
- `deposits`, `strategies`, `strategy_exposures`: deben actualizarse por domain events cronologicos.
- `processed_txs`: no debe controlar collection; puede quedar como analysis state o reemplazarse.
- `raw_provider_records`: queda como raw/cache, no como canon.

## Nuevo Task Graph

Propuesta de tareas:

```text
analysis-start
  -> protocol-bootstrap
  -> collect-wallet-transactions-page
      -> collect-wallet-transactions-page(cursor=n)
      -> collection-finalize
  -> normalize-collected-transactions
  -> classify-transactions-chronologically
  -> enrich-valuations
  -> materialize-domain-state
  -> materialize-read-models
  -> analysis-finalize
```

Notas:

- `collect-wallet-transactions-page` puede reencolarse muchas veces.
- `classify-transactions-chronologically` no empieza hasta que collection esta complete o hasta que haya un rango historico cerrado y consistente.
- Para incremental runs, se puede recolectar DESC hasta tx ya cacheada, pero reanalizar el rango afectado en ASC.

## Migracion Desde Engine Actual

### Paso 1: Congelar Pantallas

Mantener dataviews actuales como consumidores DB-only.

No seguir expandiendo `phase-deposits`, `phase-rewards`, `phase-governance` salvo fixes criticos.

### Paso 2: Implementar Collection Store Nuevo

Agregar tablas de collection/canonical tx sin modificar los read models actuales.

Validar con wallet real:

- tx count esperado;
- paginas Moralis;
- cursors;
- duplicados;
- fin historico;
- stop condition por cache.

### Paso 3: Implementar Normalizer

Transformar `/{address}/verbose` a canonical tx/log/movement.

Comparar contra Wallet History y BaseScan para fixtures problematicas.

### Paso 4: Implementar Classifier V2 En Paralelo

Crear `engine_v2` que escribe domain events versionados sin borrar outputs actuales.

Comparar:

- governance tx;
- deposit lifecycle;
- rewards emission/fees;
- bribes/rebases;
- phishing airdrops;
- cash-in/out.

### Paso 5: Materializadores V2

Reescribir materializers para leer domain events.

Mantener adapters para shape actual de APIs si conviene no tocar UI.

### Paso 6: Cutover

Cuando V2 pase regresiones, cambiar analysis-run para usar V2.

Deprecar:

- `phase-deposits` como analizador;
- `phase-rewards` como resolver principal;
- `phase-governance` como clasificador;
- `reclassify-run` actual;
- reliance en `latestRewardCandidates`.

## Regresiones Necesarias

Fixtures minimas:

1. Manual deposit mint/add liquidity.
2. Manual deposit increase/decrease.
3. Stake LP.
4. Unstake LP.
5. Gauge emission reward claim.
6. Pool fee claim.
7. Governance vote.
8. Governance reset.
9. Bribe claim.
10. Voting fee claim.
11. Rebase claim.
12. veAERO lock create/increase/extend/withdraw.
13. Mellow wrapper deposit.
14. Mellow wrapper withdraw.
15. Mellow staking reward claim.
16. Swap.
17. Cash-in from external wallet/CEX.
18. Cash-out to external wallet/CEX.
19. Phishing airdrop.
20. Unknown unsupported protocol tx.

Cada fixture debe verificar:

- classification;
- reason codes;
- protocol surface;
- movements;
- valuation source;
- domain events emitted;
- read model impact;
- totals exclusion/inclusion.

## Criterios De Exito

- El engine puede reconstruir la historia desde purge sin depender de Moralis DeFi Positions para lifecycle.
- El numero de tx recolectadas coincide con el historial esperado de la wallet o explica gaps.
- El orden de analisis es deterministico ASC.
- Governance se identifica por contratos/logs/calls, no por summary.
- Rewards LP, fees, bribes, rebases y strategy rewards quedan separados y reconciliables.
- Phishing/airdrops no suman a rewards ni cash-in.
- Cash-in/out solo aparece cuando no hay superficie protocolar soportada.
- Todas las valuaciones indican fuente: event direct, Alchemy historical, current price, unavailable.
- Las pantallas siguen siendo DB-only.

## Riesgos

- `/{address}/verbose` puede no traer todos los logs/ABIs necesarios para algunos contratos.
- Moralis decoded output puede variar por ABI coverage.
- Internal transactions pueden no ser suficientes para routers complejos.
- Reanalizar toda la historia puede ser costoso si no hay versioning/gaps.
- El cutover requiere mantener compatibilidad con APIs UI existentes.

## Proxima Investigacion

Mientras se prueban endpoints reales, necesitamos decidir el paso de clasificacion:

1. Definir `TransactionEvidence` canonical.
2. Mapear Aerodrome contracts/function selectors/event signatures.
3. Mapear Mellow wrappers/staking calls/events.
4. Definir `DomainEvent` taxonomy.
5. Definir `ClassificationTrace` para auditoria.
6. Elegir fixtures reales de la wallet para comparar Moralis verbose, Wallet History, BaseScan y engine actual.

La proxima decision tecnica deberia salir de comparar respuestas reales de `/{address}/verbose` contra transacciones problematicas concretas.

## Refactor De Helpers Ya Extraidos

Se extrajo la logica probada en los scripts de research a helpers reutilizables bajo `apps/web/src/server/analysis/decoded-history/`.

Responsabilidades nuevas:

- `abi-registry.ts`: normaliza `ContractAbiRecord`, infiere kind por `contractName`, expone `AbiRegistryRepository` para storage DB-first.
- `explorer-abi-client.ts`: consulta Etherscan v2/Base `getsourcecode` y devuelve un record persistible sin acoplarse a filesystem.
- `discovery.ts`: detecta candidatos nuevos desde tx decoded: `to_address`, spenders aprobados y contratos/token emitentes.
- `classifier.ts`: clasifica tx-by-tx con la misma logica validada en el informe de 534 filas.
- `log-evidence.ts`: extrae `Transfer`, `Approval`, swap logs e internal error evidence.
- `history-pages.ts`: carga/deduplica/ordena paginas Moralis decoded ASC antes de clasificar.
- `selector-index.ts`: matchea selectors/topics contra el ABI registry para auditoria.

Implicacion para engine V2:

- El engine no debe depender de un array fijo de contratos.
- El bootstrap puede cargar contratos core de Aerodrome/Mellow conocidos.
- Durante recoleccion/clasificacion, cada contrato nuevo observado se consulta asi:
  1. DB ABI registry por `(chainId,address)`.
  2. cache provider/Redis si aplica.
  3. explorer `getsourcecode` solo en miss, con debounce/rate-limit.
  4. persistencia DB de `ContractAbiRecord`.
- Si el ABI existe y el `contractName` es `Pool`, `CLGauge`, `Gauge`, `LpWrapper`, `UniversalRouter`, `Router`, `Voter`, `VotingEscrow`, `RewardsDistributor` o `NonfungiblePositionManager`, el classifier puede inferir superficie sin conocer previamente la direccion.
- Si no hay ABI verificada, la tx queda parcial/unresolved con evidencia visible; no se inventa pool, strategy ni governance linkage.

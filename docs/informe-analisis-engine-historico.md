# Informe De Analisis Del Engine Historico

Fecha: 2026-05-31

## Objetivo

Este informe releva como funciona hoy el engine historico de The Cab, que tareas ejecuta, que endpoints externos llama, en que lineas esta implementado el flujo, y cual es la secuencia real de procesamiento de datos. El foco es entender por que aparecen errores en transacciones de gobernanza, valuaciones, rangos historicos de depositos, recompensas, phishing/airdrops y cash-in/cash-out.

La expectativa de producto es que el engine sea un analizador historico coherente: primero debe razonar sobre la transaccion mas antigua y finalmente sobre la mas reciente. Hoy esa propiedad no esta garantizada de punta a punta.

## Resumen Ejecutivo

- El run principal se orquesta en `apps/web/src/server/trigger/tasks/analysis-run.task.ts:132`. Planifica slices, ejecuta todas las slices con `batchTriggerAndWait` en `apps/web/src/server/trigger/tasks/analysis-run.task.ts:178`, y despues corre `phase-activity`, `phase-governance`, `phase-pools` y `phase-finalize`.
- Las slices se planifican desde el limite mas reciente hacia atras en `apps/web/src/server/analysis/orchestrator.ts:55` y `apps/web/src/server/analysis/orchestrator.ts:83`. Por eso `sliceIndex 0` representa el periodo mas nuevo, no el mas viejo.
- Dentro de cada slice, primero corre `phase-deposits` y despues `phase-rewards` en `apps/web/src/server/trigger/tasks/analysis-slice.task.ts:131` y `apps/web/src/server/trigger/tasks/analysis-slice.task.ts:149`.
- Moralis Wallet History se pide con `order: "DESC"` en `apps/web/src/server/providers/moralis/getWalletHistory.ts:27`, o sea que dentro del proveedor entra primero lo mas reciente.
- `persistSliceHistory` deduplica e inserta en el orden recibido, sin sort cronologico explicito, en `apps/web/src/server/analysis/enginePersistence.ts:1196` y `apps/web/src/server/analysis/enginePersistence.ts:1211`.
- `runCanonicalInference` si lee `ledgerEvents` ordenados ascendente por `occurredAt` en `apps/web/src/server/analysis/canonicalInference.ts:326`, pero eso ocurre despues de que ya se persistieron movimientos, candidatos de reward y resoluciones parciales.
- Gobernanza depende mucho de evidencia textual o `surfaceKind` preexistente. El clasificador principal de governance es `classifyGovernanceSurface` en `apps/web/src/server/analysis/governance-classification.ts:115`; no es todavia un decoder fuerte por contrato/log/evento de Aerodrome governance.
- Hay llamadas externas en fases que deberian ser entendidas como parte de ingestion/materializacion, no request-time UI. Las principales son Moralis History/Tokens/DeFi Positions, Alchemy RPC, Alchemy Prices y BaseScan/Etherscan proxy/account/contract.

## Secuencia Actual Del Run

1. `analysis-run`
   - Carga el run y lo marca como running/planning en `apps/web/src/server/trigger/tasks/analysis-run.task.ts:132`.
   - Prepara contexto y slices en `apps/web/src/server/trigger/tasks/analysis-run.task.ts:151`.
   - Ejecuta todas las slices con `batchTriggerAndWait("analysis-slice", ...)` en `apps/web/src/server/trigger/tasks/analysis-run.task.ts:178`.
   - Cuando terminan las slices, corre fases globales:
     - `phase-activity`: `apps/web/src/server/trigger/tasks/analysis-run.task.ts:211`.
     - `phase-governance`: `apps/web/src/server/trigger/tasks/analysis-run.task.ts:234`.
     - `phase-pools`: `apps/web/src/server/trigger/tasks/analysis-run.task.ts:256`.
     - `phase-finalize`: `apps/web/src/server/trigger/tasks/analysis-run.task.ts:278`.

2. Planificacion de slices
   - `planAnalysisSlices` empieza desde `latestBoundary` en `apps/web/src/server/analysis/orchestrator.ts:55`.
   - Crea `currentEnd = latestBoundary` en `apps/web/src/server/analysis/orchestrator.ts:60`.
   - Empuja slices y luego retrocede `currentEnd = boundedStart` en `apps/web/src/server/analysis/orchestrator.ts:83`.
   - Resultado: las slices quedan planificadas de nuevo a viejo.

3. `analysis-slice`
   - Saltea slices cacheadas en `apps/web/src/server/trigger/tasks/analysis-slice.task.ts:81`.
   - Marca la slice running en `apps/web/src/server/trigger/tasks/analysis-slice.task.ts:119`.
   - Ejecuta `phase-deposits` en `apps/web/src/server/trigger/tasks/analysis-slice.task.ts:131`.
   - Ejecuta `phase-rewards` en `apps/web/src/server/trigger/tasks/analysis-slice.task.ts:149`.
   - Marca la slice complete en `apps/web/src/server/trigger/tasks/analysis-slice.task.ts:167`.

4. `phase-deposits`
   - Carga Moralis wallet tokens, wallet history, DeFi positions y contratos conocidos en paralelo en `apps/web/src/server/trigger/tasks/phase-deposits.task.ts:350`.
   - Si la ventana de history se trunca, subdivide el rango y carga mitades en paralelo en `apps/web/src/server/trigger/tasks/phase-deposits.task.ts:291`.
   - Consulta `eth_blockNumber` para soporte de reorg/processed txs en `apps/web/src/server/trigger/tasks/phase-deposits.task.ts:398`.
   - Decodifica posiciones/lifecycle de Aerodrome y accounting de Mellow en paralelo en `apps/web/src/server/trigger/tasks/phase-deposits.task.ts:419`.
   - Persiste snapshots raw/provider y records del engine en `apps/web/src/server/trigger/tasks/phase-deposits.task.ts:482`.
   - Persiste posiciones y ledger history en `apps/web/src/server/trigger/tasks/phase-deposits.task.ts:551` y `apps/web/src/server/trigger/tasks/phase-deposits.task.ts:559`.
   - Genera/mergea reward candidates en `apps/web/src/server/trigger/tasks/phase-deposits.task.ts:570`.

5. `phase-rewards`
   - Lee candidatos de recompensas desde metadata del run o raw provider records en `apps/web/src/server/trigger/tasks/phase-rewards.task.ts:214`.
   - Detecta candidates de governance con texto/clasificacion en `apps/web/src/server/trigger/tasks/phase-rewards.task.ts:85`.
   - Detecta airdrop spam por `classification === "airdrop"` o `economicExclusionReason === "airdrop_spam"` en `apps/web/src/server/trigger/tasks/phase-rewards.task.ts:108`.
   - Resuelve ownership con `resolveRewardOwnership` en `apps/web/src/server/trigger/tasks/phase-rewards.task.ts:274`.
   - Persiste claims y accrual snapshots en `apps/web/src/server/trigger/tasks/phase-rewards.task.ts:358`.

6. `phase-activity`
   - Lee `processedTxs` del run y deduplica hashes en `apps/web/src/server/trigger/tasks/phase-activity.task.ts:296`.
   - Carga senales de spam/token desde metadata o fallback raw provider en `apps/web/src/server/trigger/tasks/phase-activity.task.ts:316`.
   - Recoge evidencia de explorer segun modo disabled/cache_only/live en `apps/web/src/server/trigger/tasks/phase-activity.task.ts:102`.
   - Clasifica ledger events con `classifyRunLedgerEvents` en `apps/web/src/server/trigger/tasks/phase-activity.task.ts:350`.
   - Ejecuta inferencia canonica con `runCanonicalInference` en `apps/web/src/server/trigger/tasks/phase-activity.task.ts:371`.

7. `phase-governance`
   - Lee tx hashes del run desde `processedTxs.firstRunId` en `apps/web/src/server/trigger/tasks/phase-governance.task.ts:61`.
   - Lee ledger rows y reward rows en `apps/web/src/server/trigger/tasks/phase-governance.task.ts:70` y `apps/web/src/server/trigger/tasks/phase-governance.task.ts:112`.
   - Construye eventos, rewards y snapshot con `buildGovernanceMaterializationPlan` en `apps/web/src/server/trigger/tasks/phase-governance.task.ts:37`.
   - Persiste read models de governance en `apps/web/src/server/trigger/tasks/phase-governance.task.ts:153`.

8. `phase-pools`
   - Lee `latestPoolTotals` y corre persistencia/sync de pools en paralelo en `apps/web/src/server/trigger/tasks/phase-pools.task.ts:59`.
   - Sincroniza metadata Aerodrome y estrategias Mellow en `apps/web/src/server/trigger/tasks/phase-pools.task.ts:70`.

9. `phase-finalize`
   - Recupera wallet tokens desde metadata o raw provider fallback en `apps/web/src/server/trigger/tasks/phase-finalize.task.ts:119`.
   - Ejecuta `reclassifyAnalysisRun` en `apps/web/src/server/trigger/tasks/phase-finalize.task.ts:139`.
   - Actualiza cursor de procesamiento con `lastProcessedDayUtc = run.utcDayBucket` en `apps/web/src/server/trigger/tasks/phase-finalize.task.ts:148`.
   - Marca freshness y finaliza el run en `apps/web/src/server/trigger/tasks/phase-finalize.task.ts:159` y `apps/web/src/server/trigger/tasks/phase-finalize.task.ts:171`.

## Endpoints Externos Llamados

### Moralis

Cliente base:
- Base URL: `https://deep-index.moralis.io/api/v2.2` en `apps/web/src/server/providers/moralis/client.ts:12`.
- Construccion de URL y query `chain`: `apps/web/src/server/providers/moralis/client.ts:95`.
- Cache DB-first: `apps/web/src/server/providers/moralis/client.ts:119`.
- Lock Redis/inflight: `apps/web/src/server/providers/moralis/client.ts:140`.
- Fetch HTTP real: `apps/web/src/server/providers/moralis/client.ts:168`.

Endpoints:
- `GET /wallets/:walletAddress/history`: `apps/web/src/server/providers/moralis/getWalletHistory.ts:26`.
  - Usa `order: "DESC"` en `apps/web/src/server/providers/moralis/getWalletHistory.ts:27`.
  - Lo llama `phase-deposits` en `apps/web/src/server/trigger/tasks/phase-deposits.task.ts:317`.
  - Tambien lo puede llamar `reclassifyAnalysisRun` al regenerar candidatos en `apps/web/src/server/analysis/reclassify-run.ts:353`.
- `GET /wallets/:walletAddress/tokens`: `apps/web/src/server/providers/moralis/getWalletTokens.ts:11`.
  - Lo llama `phase-deposits` en `apps/web/src/server/trigger/tasks/phase-deposits.task.ts:351`.
- `GET /wallets/:walletAddress/defi/positions`: `apps/web/src/server/providers/moralis/getWalletDefiPositions.ts:9`.
  - Lo llama `phase-deposits` en `apps/web/src/server/trigger/tasks/phase-deposits.task.ts:363`.

### Alchemy RPC

Cliente RPC:
- POST a `env.ALCHEMY_BASE_RPC_URL`: `apps/web/src/server/providers/alchemy/rpc.ts:195`.
- Cache DB-first / Redis en `apps/web/src/server/providers/alchemy/rpc.ts:120`.

Usos detectados:
- `eth_blockNumber` en `phase-deposits`: `apps/web/src/server/trigger/tasks/phase-deposits.task.ts:398`.
- `eth_call` para posiciones Aerodrome manuales: `apps/web/src/server/protocol-positions/readAerodromeManualPositions.ts:179` y `apps/web/src/server/protocol-positions/readAerodromeManualPositions.ts:188`.
- `eth_call` para posiciones Mellow: `apps/web/src/server/protocol-positions/readMellowStrategyPositions.ts:224` y `apps/web/src/server/protocol-positions/readMellowStrategyPositions.ts:258`.
- `eth_call` para metadata/sync Aerodrome: `apps/web/src/server/protocols/aerodrome/syncAerodromeMetadata.ts:124`.
- `eth_call` para decode de lifecycle Aerodrome: `apps/web/src/server/protocols/aerodrome/decodeDepositLifecycle.ts:455` y `apps/web/src/server/protocols/aerodrome/decodeDepositLifecycle.ts:470`.
- `eth_getTransactionByHash` para decode de mints/rewards Aerodrome: `apps/web/src/server/protocols/aerodrome/decodeDepositLifecycle.ts:596` y `apps/web/src/server/protocols/aerodrome/decodeDepositLifecycle.ts:895`.
- `eth_getTransactionByHash` para aprobaciones canonicas: `apps/web/src/server/analysis/canonicalInference.ts:756`.

### Alchemy Prices

Cliente prices:
- Current token prices POST `/tokens/by-address`: `apps/web/src/server/providers/alchemy/prices.ts:359` y fetch en `apps/web/src/server/providers/alchemy/prices.ts:369`.
- Historical token prices POST `/tokens/historical`: `apps/web/src/server/providers/alchemy/prices.ts:508` y fetch en `apps/web/src/server/providers/alchemy/prices.ts:513`.

Usos detectados:
- Current prices para posiciones Aerodrome manuales: `apps/web/src/server/protocol-positions/readAerodromeManualPositions.ts:517`.
- Current prices para posiciones Mellow: `apps/web/src/server/protocol-positions/readMellowStrategyPositions.ts:523`.
- Historical prices para materializacion de pools: `apps/web/src/server/analysis/pool-read-models.ts:568`.

### BaseScan / Etherscan

Cliente explorer:
- BaseScan API base: `https://api.basescan.org/api` en `apps/web/src/server/providers/explorer/client.ts:63`.
- API key BaseScan/Etherscan: `apps/web/src/server/providers/explorer/client.ts:71`.
- Fetch HTTP: `apps/web/src/server/providers/explorer/client.ts:91`.
- `module=proxy&action=eth_getTransactionReceipt`: `apps/web/src/server/providers/explorer/client.ts:176`.
- `module=account&action=txlistinternal`: `apps/web/src/server/providers/explorer/client.ts:195`.
- `module=contract&action=getsourcecode`: `apps/web/src/server/providers/explorer/client.ts:212`.
- Evidence por tx con receipt + internal transfers: `apps/web/src/server/providers/explorer/client.ts:228`.
- Cache DB-first/inflight/rate-limit: `apps/web/src/server/providers/explorer/client.ts:282`.
- Read cache-only: `apps/web/src/server/providers/explorer/client.ts:391`.

Uso:
- `phase-activity` usa explorer supplemental evidence en `apps/web/src/server/trigger/tasks/phase-activity.task.ts:102`.
- Si `ANALYSIS_EXPLORER_SUPPLEMENTAL_EVIDENCE_MODE=disabled`, no llama explorer.
- Si `cache_only`, solo lee cache.
- Si `live`, lee cache y despues llama BaseScan/Etherscan para faltantes.

## Secuencia De Procesamiento De Un Dato

### Transaccion de Moralis history

1. Moralis history trae records por pagina desde `/wallets/:walletAddress/history` con orden DESC.
2. `phase-deposits` filtra por ventana y pagina en `apps/web/src/server/trigger/tasks/phase-deposits.task.ts:216`.
3. Si la ventana se trunca, subdivide y concatena mitades en `apps/web/src/server/trigger/tasks/phase-deposits.task.ts:291`.
4. `persistSliceHistory` filtra records por fecha y hash en `apps/web/src/server/analysis/enginePersistence.ts:1180`.
5. Deduplica unseen records en el orden recibido en `apps/web/src/server/analysis/enginePersistence.ts:1196`.
6. Inserta `ledgerEvents` en `apps/web/src/server/analysis/enginePersistence.ts:1211`.
7. Inserta `assetMovements` en `apps/web/src/server/analysis/enginePersistence.ts:1242`.
8. Inserta `processedTxs` en `apps/web/src/server/analysis/enginePersistence.ts:1269`.
9. Extrae reward candidates desde records reward-like en `apps/web/src/server/analysis/enginePersistence.ts:1281`.
10. `phase-rewards` resuelve candidatos y persiste `reward_events`.
11. `phase-activity` clasifica los `ledgerEvents`.
12. `runCanonicalInference` vuelve a leer eventos ordenados ascendente por `occurredAt` en `apps/web/src/server/analysis/canonicalInference.ts:326`.
13. `phase-governance`, `phase-pools`, `phase-finalize` materializan read models.

### Movimiento de token

1. `buildAssetMovementRows` transforma movimientos nativos/ERC20 en `apps/web/src/server/analysis/enginePersistence.ts:580`.
2. Toma amount/USD desde payload del proveedor cuando esta disponible.
3. `classifyRunLedgerEvents` usa movimientos, price points y wallet token signals para clasificacion economica en `apps/web/src/server/analysis/enginePersistence.ts:1321`.
4. La valuacion historica de snapshots usa `resolveHistoricalUsdBackfill`: primero respeta `directAmountUsd` y solo usa price point fallback si falta valor directo en `apps/web/src/server/analysis/computeSnapshots.ts:184`.
5. Si no hay price point diario, queda `priceUnavailable` en `apps/web/src/server/analysis/computeSnapshots.ts:216`.

### Recompensa

1. `phase-deposits` genera candidates desde Aerodrome lifecycle y Mellow accounting en `apps/web/src/server/trigger/tasks/phase-deposits.task.ts:458`.
2. `persistSliceHistory` tambien genera candidates desde history provider reward-like en `apps/web/src/server/analysis/enginePersistence.ts:1281`.
3. `phase-rewards` toma `latestRewardCandidates` desde metadata del run si existe, y si no desde raw provider records en `apps/web/src/server/trigger/tasks/phase-rewards.task.ts:214`.
4. `resolveRewardOwnership` aplica reglas por `surfaceKind`, tokenId, wrapper, staking rewards o fallback unresolved en `apps/web/src/server/analysis/rewardResolution.ts:76`.
5. Los fee claims pueden asignarse por `wallet_pool_single_holder` o `wallet_pool_aggregate` si hay pool explicito en `apps/web/src/server/analysis/rewardResolution.ts:132`.
6. Governance rewards quedan resueltos como `governance_claim` sin owner deposit/strategy en `apps/web/src/server/analysis/rewardResolution.ts:113`.

### Gobernanza

1. `classifyRunLedgerEvents` llama `classifyGovernanceSurface` al clasificar ledger rows en `apps/web/src/server/analysis/enginePersistence.ts:1523`.
2. `classifyGovernanceSurface` prioriza `surfaceKind` explicito en `apps/web/src/server/analysis/governance-classification.ts:120`.
3. Si no hay `surfaceKind`, usa texto de category/summary/protocol/method/rewardType/metadata en `apps/web/src/server/analysis/governance-classification.ts:130`.
4. Reconoce voting escrow, vote/voter, relay, bribe, fees, rebase y reward distributor por regex/texto en `apps/web/src/server/analysis/governance-classification.ts:143`.
5. `phase-governance` materializa eventos/rewards/snapshot desde ledger rows y reward rows en `apps/web/src/server/trigger/tasks/phase-governance.task.ts:37`.

## Auditoria De Orden Cronologico

Propiedad requerida: el analisis semantico debe procesar primero la transaccion mas antigua y ultimo la mas reciente.

Estado actual:

- Slices: se planifican de nuevo a viejo, no de viejo a nuevo.
- Ejecucion de slices: se dispara en batch, por lo que no hay garantia de orden temporal entre slices.
- History provider: Moralis entra en DESC, nuevo a viejo.
- Persistencia inicial: `persistSliceHistory` no ordena explicitamente por `occurredAt` antes de insertar ledger/movements/candidates.
- Rewards por slice: `phase-rewards` corre despues de `phase-deposits` dentro de la misma slice, pero como las slices corren en batch, puede resolver rewards de slices nuevas antes que depositos/rangos antiguos.
- Inferencia canonica: si ordena ascendente, pero ocurre tarde.
- Finalize/reclassify: vuelve a clasificar todos los `processedTxs`, pero no corrige el hecho de que candidates y snapshots intermedios pudieron generarse sobre metadata de run mezclada o incompleta.

Conclusion: el engine hoy no es deterministico como analizador historico viejo-a-nuevo. Tiene una etapa canonica cronologica, pero no todo el pipeline se apoya en esa propiedad.

## Hallazgos De Drift Y Riesgo

### 1. Orden historico inconsistente

El mayor drift contra el comportamiento esperado es la combinacion de slices nuevo-a-viejo, batch paralelo y history DESC. Esto afecta deposit ranges, ownership temporal, reward attribution y cash-in/cash-out porque parte del estado historico se construye antes de conocer eventos antiguos.

### 2. Reward candidates pueden mezclarse entre slices

`phase-rewards` prefiere `run.metadataJson.latestRewardCandidates` sobre el raw provider record de la slice en `apps/web/src/server/trigger/tasks/phase-rewards.task.ts:214`. Como `latestRewardCandidates` se mergea/escribe desde `phase-deposits`, y las slices corren en batch, hay riesgo de que una slice resuelva candidates que no corresponden a su ventana o que use un set parcial/mutante.

El mismo patron existe en `reclassify-run`, que tambien prefiere metadata del run en `apps/web/src/server/analysis/reclassify-run.ts:188`.

### 3. Gobernanza depende de evidencia debil

El clasificador de governance usa `surfaceKind` si existe, pero cuando no existe se apoya en texto y regex. Esto explica que tx reales de Aerodrome governance puedan no entrar si Moralis no etiqueta bien el metodo, o que queden en `claim`, `other`, `cash_in/out` o `unsupported`.

Para gobernanza robusta falta que la deteccion primaria sea por contratos/protocol surfaces/logs/decoded input de Aerodrome: VotingEscrow, Voter, Relay, Briber, FeeDistributor, RewardDistributor/Rebase.

### 4. Explorer evidence esta en activity y es supplemental

BaseScan/Etherscan se usa como evidencia suplementaria de `phase-activity`. No es una fuente primaria estructural para governance ni para rewards. Si el modo esta `cache_only` o `disabled`, no corrige faltantes de decoding. Si esta `live`, puede ser lento y caro para un run cold.

### 5. Valuaciones mezclan fuentes directas, historicas y actuales

Los movimientos usan USD directo del evento si existe. Para backfill historico se usan price points diarios, pero si faltan queda unavailable. A la vez, posiciones manuales y Mellow leen precios actuales con Alchemy Prices. Esto puede mezclar valuacion historica de flujo con valuacion actual de posicion si no esta claramente separado por read model.

### 6. Rango historico de depositos puede depender de reconstruccion tardia

Aerodrome tiene backfill de rango historico para posiciones fallidas usando `eth_getTransactionByHash` sobre mints y `slot0` actual en `apps/web/src/server/protocols/aerodrome/decodeDepositLifecycle.ts:568`. Eso ayuda, pero usa estado actual para aspectos de rango/current tick y no reemplaza un ledger historico old-to-new completo.

### 7. Phishing/airdrops dependen de senales de token y texto

`classifyRunLedgerEvents` excluye airdrop/spam si hay Moralis spam/untrusted/valueless inflow. Pero casos de phishing con token transfer fake pueden no estar en token signals, o pueden tener USD value contaminado. El filtro existe, pero la precision depende de provider signals y del timing de classification.

### 8. Cash-in/cash-out puede ser fallback demasiado amplio

Despues de detectar protocol/gobernanza/claim/airdrop, el clasificador cae a `cash_in` o `cash_out` segun flujo neto. Si una tx compleja o mal decodificada llega sin surface explicita, puede terminar como cash-in/cash-out aunque sea governance, claim, unsupported o phishing.

### 9. `processedTxs.firstRunId` limita fases globales

`phase-activity` y `phase-governance` cargan txs del run por `processedTxs.firstRunId`. En un rerun o re-clasificacion con datos ya vistos, esto puede dejar fuera txs historicas si no se fuerza una ruta que las vuelva a incluir. `phase-finalize` reclassifica todos los `processedTxs` por wallet/chain, pero governance phase previa trabaja con firstRunId.

### 10. Cursor de procesamiento avanza por run day

`phase-finalize` guarda `lastProcessedDayUtc = run.utcDayBucket` en `apps/web/src/server/trigger/tasks/phase-finalize.task.ts:148`. Esto esta bien si todas las slices historicas quedaron completas y coherentes, pero combinado con orden no cronologico puede ocultar drift historico hasta que se purga o fuerza reprocess.

## Hipotesis Sobre Los Errores Observados

- Gobernanza no identificada correctamente: falta decoder fuerte por contratos/logs de governance; hoy gobierna texto/surfaceKind.
- Rewards emission + fees mal generados: candidates se generan desde varias fuentes y se resuelven por metadata de run que puede estar mezclada entre slices; ademas fee claims tienen fallback por pool holder aggregate cuando hay evidencia de pool pero no necesariamente evidencia de owner temporal robusta.
- Deposit historical ranges incorrectos: las slices no se procesan old-to-new y algunas reconstrucciones usan estado actual (`latest`) para completar datos.
- Valuaciones erraticas: conviven USD directo del provider, price point diario y current price; la semantica no siempre separa flujo historico vs posicion actual.
- Phishing/airdrops mal identificados: la exclusion depende de senales de spam/token y texto; falta un pipeline de trust historico por token/contract/log provenance.
- Cash-in/cash-out mal clasificado: el fallback net-flow puede tragarse txs complejas cuando falla la deteccion de surface.

## Recomendacion Para La Proxima Fase De Correccion

Antes de tocar UI, conviene estabilizar el engine con estos cambios de arquitectura:

1. Separar ingestion de analisis semantico.
   - Ingestion: traer y persistir raw txs/movements de todo el rango.
   - Analisis: ordenar todo por `occurredAt asc`, `blockNumber asc`, `transactionIndex asc`, `logIndex asc`, y recien ahi clasificar.

2. Cambiar planificacion/ejecucion a old-to-new.
   - Slices planificadas desde la fecha mas antigua.
   - Slices ejecutadas secuencialmente cuando el resultado de una puede afectar estado de otra.
   - Solo paralelizar llamadas de provider que no cambian estado semantico.

3. Hacer governance decoder-first.
   - Detectar contratos Aerodrome governance por chain config/protocol contracts.
   - Decodificar input/logs para VotingEscrow, Voter, Relay, Briber, FeeDistributor, RewardDistributor/Rebase.
   - Usar texto solo como evidencia secundaria.

4. Normalizar reward candidates por tx/component/log.
   - Evitar `latestRewardCandidates` global mutante durante slices.
   - Persistir candidates con slice/window/tx/component identity antes de resolver ownership.
   - Resolver despues del ledger historico completo.

5. Endurecer airdrop/phishing.
   - DB-first cache de explorer/proveedor por tx y contract.
   - Trust model por token/contract con evidencia persistida.
   - No permitir que spam/phishing compute reward ni cash-in positivo salvo evidencia explicita.

6. Separar valuacion de flujos historicos y posiciones actuales.
   - Flujos: valor al momento del evento, fuente/event direct o price point historico.
   - Posiciones: valor actual, fuente current price/RPC.
   - Snapshots: documentar si representan end-of-day reconstructed o current-state backfill.

7. Agregar trace deterministico del engine.
   - Para cada tx: provider source, chronological index, classifier input, classifier output, reason codes, value source, reward candidate ids, governance evidence, final read-model links.
   - Esto permitiria auditar tx concretas como governance, phishing airdrop, fee claim, emission claim y cash flow.

## Archivos Clave Para La Revision Profunda

- Orquestacion: `apps/web/src/server/trigger/tasks/analysis-run.task.ts`
- Planificacion de slices: `apps/web/src/server/analysis/orchestrator.ts`
- Slice task: `apps/web/src/server/trigger/tasks/analysis-slice.task.ts`
- Ingestion deposits/history: `apps/web/src/server/trigger/tasks/phase-deposits.task.ts`
- Rewards: `apps/web/src/server/trigger/tasks/phase-rewards.task.ts`
- Activity/classification: `apps/web/src/server/trigger/tasks/phase-activity.task.ts`
- Governance materialization: `apps/web/src/server/trigger/tasks/phase-governance.task.ts`
- Pools: `apps/web/src/server/trigger/tasks/phase-pools.task.ts`
- Finalize/reclassify: `apps/web/src/server/trigger/tasks/phase-finalize.task.ts`, `apps/web/src/server/analysis/reclassify-run.ts`
- Ledger persistence/classification: `apps/web/src/server/analysis/enginePersistence.ts`
- Canonical inference: `apps/web/src/server/analysis/canonicalInference.ts`
- Governance classifier: `apps/web/src/server/analysis/governance-classification.ts`
- Reward ownership: `apps/web/src/server/analysis/rewardResolution.ts`
- Historical snapshots/valuation: `apps/web/src/server/analysis/computeSnapshots.ts`
- Pool read models/prices: `apps/web/src/server/analysis/pool-read-models.ts`
- Moralis client: `apps/web/src/server/providers/moralis/client.ts`
- Alchemy RPC/prices: `apps/web/src/server/providers/alchemy/rpc.ts`, `apps/web/src/server/providers/alchemy/prices.ts`
- Explorer client: `apps/web/src/server/providers/explorer/client.ts`

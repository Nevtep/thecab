# Informe De Refactor: Recoleccion Historica Moralis

Fecha: 2026-05-31

## Objetivo

Este documento complementa `docs/informe-analisis-engine-historico.md` con el relevamiento especifico de endpoints Moralis para definir una primera fase correcta de recoleccion historica. La meta es que el engine deje de analizar mientras pagina datos externos y pase a operar en dos etapas:

1. Recolectar y cachear historicamente las transacciones decodificadas de la wallet.
2. Analizar exclusivamente nuestros datos persistidos, ordenados de mas antiguo a mas reciente.

No propone cambios de codigo en este paso; documenta el refactor recomendado.

## Fuentes Consultadas

- Moralis Wallet History: `https://docs.moralis.com/data-api/evm/wallet/wallet-history`
- Moralis Address Transactions Decoded: `https://docs.moralis.com/data-api/evm/blockchain/address-transactions-decoded`
- Moralis Address Transactions Raw: `https://docs.moralis.com/data-api/evm/blockchain/address-transactions`
- Moralis Transaction Decoding overview: `https://docs.moralis.com/data-api/data-features/data-enrichment/transaction-decoding`

## Endpoint Actual: Wallet History

Endpoint:

```text
GET https://deep-index.moralis.io/api/v2.2/wallets/{address}/history
```

Uso actual en The Cab:

- Wrapper: `apps/web/src/server/providers/moralis/getWalletHistory.ts:17`.
- Path: `apps/web/src/server/providers/moralis/getWalletHistory.ts:26`.
- Orden hardcodeado actual: `order: "DESC"` en `apps/web/src/server/providers/moralis/getWalletHistory.ts:27`.
- Llamado principal en ingestion: `apps/web/src/server/trigger/tasks/phase-deposits.task.ts:317`.
- Llamado adicional para regenerar candidates: `apps/web/src/server/analysis/reclassify-run.ts:353`.

Segun la documentacion, este endpoint devuelve historial de wallet decodificado, categorizado y resumido. Incluye campos de transaccion base, `summary`, transferencias NFT/ERC20, `possible_spam`, `verified_contract`, entidades/labels y eventos decodificados en transfer/log sections.

Parametros relevantes documentados:

- `chain`
- `from_block` / `to_block`
- `from_date` / `to_date`
- `include_internal_transactions`
- `nft_metadata`
- `cursor`
- `order` con `ASC` o `DESC`, default `DESC`
- `limit`

Ventajas:

- Es comodo para una vista wallet/activity porque trae una capa semantica de Moralis.
- Ya incluye categorias y resumen human-readable.
- Incluye transferencias ERC20/NFT normalizadas.
- Expone senales de spam/verified contract en transferencias.

Riesgos para el engine:

- Es una respuesta ya procesada/categorizada por Moralis. Si Moralis clasifica mal una tx DeFi/gobernanza, el engine hereda ese sesgo.
- No es una fuente canonica suficiente para protocolo: governance, fee claims, bribes, relays y rewards necesitan evidencia por contrato/log/input, no solo `summary` o `category`.
- Al estar hardcodeado en `DESC`, hoy alimenta fases que todavia procesan mientras recolectan.
- Aunque soporta `ASC`, para incremental collection desde la punta mas reciente `DESC` puede ser correcto, pero nunca deberia determinar el orden de analisis.

## Endpoint Candidato: Address Transactions Decoded

Endpoint:

```text
GET https://deep-index.moralis.io/api/v2.2/{address}/verbose
```

Segun la documentacion, devuelve transacciones nativas ABI-decoded por wallet, ordenadas por block number en orden descendente por default. La respuesta incluye campos base de transaccion, labels/entities, `decoded_call`, logs con `decoded_event`, topics, cursor y paginacion.

Parametros relevantes documentados:

- `chain`
- `from_block` / `to_block`
- `from_date` / `to_date`
- `include=internal_transactions`
- `cursor`
- `order` con `ASC` o `DESC`, default `DESC`
- `limit`

Ventajas:

- Mejor fuente primaria para el engine que `Wallet History`, porque conserva mas materia prima ABI/log/input.
- `decoded_call` permite reconocer metodos de contracts como `vote`, `reset`, `getReward`, `claimBribes`, `claimFees`, `createLock`, `increaseAmount`, `increaseUnlockTime`, etc. cuando el ABI esta disponible.
- `decoded_event` en logs permite detectar Transfer, Vote, RewardPaid, ClaimRewards u otros eventos por signature/label/params.
- Permite incluir internal transactions con `include=internal_transactions`, reduciendo dependencia de BaseScan para trazas simples.
- Sigue siendo DB/cacheable con cursor y request hash.

Limitaciones:

- No reemplaza por completo a transfer normalization del Wallet History. Hay que transformar logs ERC20/NFT y native/internal movements nosotros.
- La decodificacion es best-effort segun ABIs disponibles; contratos desconocidos pueden caer a labels genericos.
- Puede no traer precios/USD ni categorias wallet-level que hoy algunas pantallas consumen indirectamente.
- Sigue siendo una API externa paginada y descendente por default: requiere una fase de recoleccion historica separada del analisis.

## Comparacion De Respuestas

| Aspecto | Wallet History `/wallets/{address}/history` | Address Transactions Decoded `/{address}/verbose` |
|---|---|---|
| Nivel semantico | Alto, wallet activity ya categorizada/resumida | Medio/bajo, transaccion nativa ABI-decoded |
| Categoria Moralis | Si, orientada a actividad wallet | No como fuente principal; trae decoded call/logs |
| Summary human-readable | Si | No como Wallet History |
| `decoded_call` | Parcial/no central | Si, campo central |
| `decoded_event` logs | Presente en secciones de logs/transfers | Si, campo central en logs |
| ERC20/NFT transfers normalizadas | Si | Hay que derivarlas de logs o combinar endpoint |
| Internal transactions | `include_internal_transactions=true` | `include=internal_transactions` |
| Orden | `ASC`/`DESC`, default `DESC` | `ASC`/`DESC`, default `DESC` |
| Mejor uso | Enriquecimiento/UI/fallback semantico | Fuente primaria para ingestion historica del engine |

Conclusion: `/{address}/verbose` parece mejor como primera fuente de recoleccion historica para el engine, porque entrega datos mas cercanos a la ejecucion onchain. `Wallet History` puede quedar como fuente complementaria de labels, summaries, spam hints y transfer normalization, pero no deberia ser la autoridad primaria para clasificar protocolo.

## Problema Actual Del Engine Frente A Estos Endpoints

Hoy el engine usa Wallet History directamente dentro de `phase-deposits`, y esa fase tambien dispara decoding/protocol accounting/persistencia. Eso mezcla tres responsabilidades:

1. Paginacion externa.
2. Normalizacion/persistencia de transacciones.
3. Analisis semantico de producto.

Con APIs paginadas en DESC, esa mezcla rompe el modelo historico. Aunque el proveedor permita `ASC`, la ingestion debe ser robusta a:

- runs interrumpidos;
- paginas ya cacheadas;
- wallets con muchas paginas;
- nuevos tx durante pagination;
- reanalisis desde purge;
- diferencia entre tx cacheada y tx semanticamente procesada.

## Modelo Recomendado De Recoleccion Historica

### Fase 1: `collect-wallet-transactions`

Responsabilidad unica: traer paginas de transacciones decodificadas y guardarlas en DB/cache. No clasifica, no calcula rewards, no materializa dataviews.

Entrada:

- `walletAddress`
- `chainId`
- `cursor` opcional
- `collectionRunId`
- `endpointVersion`
- `order`, recomendado `DESC` para incremental collection desde la punta reciente
- `limit`, recomendado `100`
- `include=internal_transactions`

Proceso:

1. Consultar primero DB por request/page cache.
2. Si no existe, consultar Redis.
3. Si no existe, llamar Moralis.
4. Persistir la pagina raw immutable con endpoint, cursor, request hash, fetchedAt y responseJson.
5. Upsert de cada tx en una tabla canonica de transacciones recolectadas, por identidad:

```text
(chain_id, wallet_address, tx_hash)
```

6. Upsert de logs decodificados por:

```text
(chain_id, tx_hash, log_index)
```

7. Upsert de internal transactions por identidad estable disponible:

```text
(chain_id, tx_hash, trace_index o hash derivado del payload)
```

8. Registrar page cursor state:

```text
collection_run_id, next_cursor, completed, stop_reason
```

9. Si hay `next_cursor` y no se alcanzo stop condition, disparar la misma task con `cursor=next_cursor`.
10. Si no hay `next_cursor` o se alcanzo stop condition, marcar collection complete y disparar la fase de analisis.

### Stop Conditions

Para incremental collection en DESC:

- Stop por fin historico: no hay cursor siguiente.
- Stop por cache historica: la pagina contiene una tx ya cacheada de forma estable para esa wallet/chain y no hay gaps pendientes antes de esa tx.
- Stop por run policy: limite defensivo de paginas por job, que debe reencolar automaticamente, no cortar el analisis como completo.

Importante: "tx cacheada" no debe significar "tx ya analizada". La recoleccion debe tener su propio estado. Una transaccion puede estar cacheada y aun asi requerir reanalisis si cambia la version del classifier/materializer.

### Fase 2: `analyze-wallet-transactions`

Responsabilidad: leer solo DB propia y procesar historicamente.

Entrada:

- `collectionRunId` o `analysisRunId`
- `walletAddress`
- `chainId`
- `classifierVersion`
- rango opcional de bloques/fechas

Proceso:

1. Leer transacciones canonicas desde DB.
2. Ordenar deterministamente:

```text
block_timestamp ASC,
block_number ASC,
transaction_index ASC,
tx_hash ASC
```

3. Para movements/logs:

```text
log_index ASC,
trace_index ASC
```

4. Ejecutar pipeline semantico viejo-a-nuevo:
   - normalizacion de movimientos;
   - trust/spam/phishing;
   - cash-in/cash-out;
   - deposit lifecycle;
   - strategy lifecycle;
   - reward candidates;
   - governance surfaces;
   - ownership/reconciliation;
   - valuation historica;
   - read-model materialization.

5. Persistir outputs con versionado de classifier/materializer.

## DB/Cache Recomendado

La tabla actual `raw_provider_records` guarda request/response y tiene request hash en `apps/web/src/server/db/schema.ts:135`. Sirve como cache raw, pero no alcanza como store canonico de transacciones porque:

- no tiene identidad unica por tx;
- no representa page cursor state;
- no permite saber rapidamente si una tx ya fue recolectada;
- no separa raw provider page de canonical transaction/log/internal movement;
- no modela gaps historicos.

Se recomienda agregar stores separados:

1. `wallet_transaction_collection_runs`
   - run id, wallet, chain, endpoint version, status, started/completed, stop reason.

2. `wallet_transaction_pages`
   - provider, endpoint, chain, wallet, cursor input, cursor output, order, limit, request hash, response hash, fetchedAt.

3. `wallet_transactions`
   - chain, wallet, tx hash, block number, timestamp, tx index, from/to, status, raw decoded payload, source endpoint, firstSeenAt, lastSeenAt.

4. `wallet_transaction_logs`
   - chain, tx hash, log index, address, topics, decoded event, raw payload.

5. `wallet_internal_transactions`
   - chain, tx hash, trace identity, from/to/value/type/error/raw payload.

6. `wallet_transaction_analysis_state`
   - chain, wallet, tx hash, classifier version, analyzedAt, analysis status.

## Endpoint Strategy Recomendada

Primario:

```text
GET /api/v2.2/{address}/verbose?chain=base&include=internal_transactions&limit=100&order=DESC
```

Complementario:

```text
GET /api/v2.2/wallets/{address}/history?chain=base&include_internal_transactions=true&limit=100&order=DESC
```

Uso del complementario:

- labels human-readable;
- `summary`;
- `category`;
- possible spam / verified contract hints;
- transfer normalization cuando el decoded raw no alcance;
- comparacion/regresion contra clasificador propio.

No recomendado:

- Usar `Wallet History` como unica fuente para decidir governance/rewards/cash-flow.
- Clasificar durante pagination.
- Guardar solo pages raw sin canonical tx rows.
- Usar `processed_txs` como stop condition de ingestion: esa tabla representa procesamiento semantico, no cache historica.

## Implicancias Para Governance

Con `/{address}/verbose`, governance puede detectarse primero por evidencia onchain:

- `to_address` o log address contra contratos Aerodrome conocidos.
- `decoded_call.signature` y `decoded_call.label`.
- `decoded_event.signature`, `decoded_event.label` y params.
- tokenId, pool address, gauge/bribe/reward distributor si aparecen en params/logs.

Despues, `Wallet History` puede enriquecer con summary/category, pero no debe sobreescribir evidencia protocol-derived.

Esto reduce los falsos negativos de governance cuando Moralis no categoriza bien la actividad wallet, y reduce falsos positivos cuando un airdrop/phishing usa texto engañoso.

## Preguntas Abiertas Para Validar Con Datos Reales

1. Si `/{address}/verbose` trae logs ERC20 completos para todas las tx relevantes de Base.
2. Si `include=internal_transactions` cubre suficientemente swaps/routers o si hace falta mantener explorer/RPC traces para casos puntuales.
3. Si `decoded_call` trae ABIs de Aerodrome Voter, VotingEscrow, Briber, FeeDistributor y RewardDistributor con labels utiles.
4. Si el endpoint respeta `order=ASC` con cursor de forma estable; si lo hace, podria usarse ASC para backfill inicial y DESC para incremental.
5. Si Wallet History aporta `possible_spam` mas confiable que el decoded endpoint para tokens de phishing.

## Recomendacion De Proxima Investigacion

Antes de implementar, conviene correr una comparacion controlada con la wallet real:

1. Tomar 10-20 tx hashes problematicas:
   - governance vote;
   - bribe claim;
   - fee claim;
   - rebase;
   - emission reward;
   - phishing airdrop;
   - cash-in real;
   - cash-out real;
   - swap;
   - deposit mint/increase/withdraw.
2. Para cada tx, comparar:
   - `Wallet History`;
   - `Address Transactions Decoded`;
   - BaseScan receipt/logs cacheados;
   - Alchemy `eth_getTransactionByHash`;
   - outputs actuales del engine.
3. Definir el mapping canonico del engine desde `decoded_call`/`decoded_event` hacia:
   - governance surface;
   - protocol action;
   - economic component;
   - ownership evidence;
   - valuation source;
   - exclusion/trust reason.

Hasta no hacer esa comparacion, la recomendacion tecnica es usar `/{address}/verbose` como primary collection source y mantener `Wallet History` como enrichment/fallback, no como autoridad semantica.

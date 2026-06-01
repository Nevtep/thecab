# Engine V2: Bugs Y Gaps De Evidencia Aisladados

Fecha: 2026-05-31

## Principio

En engine v2, "no lo puedo probar" no es una conclusion final. Es un bug o gap de evidencia que debe quedar aislado, reproducible y accionable.

La UI puede mostrar `partial`, `unresolved` o `unsupported`, pero el engine debe registrar:

- que dato falta;
- que tx/log/input lo expone;
- que enrichment o decoder falta;
- que tabla debe persistir la evidencia cuando se resuelva;
- que regression debe cubrirlo.

Este documento convierte los gaps detectados durante el analisis de las 533/534 tx locales en items listos para estudiar y parchear.

## Evidencia Local Disponible

Archivos usados:

- `docs/api-research/moralis/address-transactions-decoded-page0-response.json`
- `docs/api-research/moralis/address-transactions-decoded-page1-response.json`
- `docs/api-research/moralis/address-transactions-decoded-page2-response.json`
- `docs/api-research/moralis/address-transactions-decoded-page3-response.json`
- `docs/api-research/moralis/address-transactions-decoded-page4-response.json`
- `docs/api-research/moralis/address-transactions-decoded-page5-response.json`
- `docs/api-research/moralis/address-transactions-decoded-full-classification.json`
- ABIs bajo `docs/api-research/abis/base-8453/`

Conteo observado:

- Los seis archivos locales suman 534 filas.
- El usuario espera 533 tx para la wallet.
- BaseScan muestra 533 tx para la wallet, por lo que este item queda descartado como bug funcional mientras la canonicalizacion dedupe por `(chain_id, tx_hash)` y no materialice duplicados. Debe quedar como safeguard de recoleccion, no como blocker del engine v2.

## BUG-EV2-002: Lock `113464` Aparece En `depositManaged`; Su Origen Requiere NFT Transfer Backfill

### Sintoma

Se detecta:

```text
tx: 0xc220cbbd038c723dc7a0106b85dff89190d1ce09ed4acfb522244278d036dba4
to: Aerodrome Voter 0x16613524e02ad97edfef371bc883f2f5d6c480a5
function: depositManaged(uint256,uint256)
args: tokenId=113464, mTokenId=10298
event: VotingEscrow.DepositManaged
owner: wallet
```

Pero en el wallet-centric Moralis history local no aparece el mint/transfer/create lifecycle de `tokenId=113464`. El origen si aparece al consultar historial NFT del contrato `VotingEscrow` para `token_id=113464`.

### Evidencia Decodificada

`depositManaged`:

```text
function: Voter.depositManaged
args:
  tokenId: 113464
  mTokenId: 10298
```

`VotingEscrow.DepositManaged`:

```text
owner: wallet
tokenId: 113464
mTokenId: 10298
weight: 1528 AERO-ish raw units
```

Luego la misma tx emite muchos eventos `Voter.Abstained` y `Voter.Voted` sobre `tokenId=10298`, lo que indica que el managed token queda asociado a votos/weights del managed/relay side.

### Evidencia De Origen Por NFT Transfer History

Consulta provista por el usuario para el NFT `VotingEscrow`:

```text
token_address: 0xebf418fe2512e7e6bd9b87a8f0f294acdc67e6b4
token_id: 113464
```

Resultado relevante:

```text
tx: 0x60b661cee4ae2ed5a2cb0361aff4bf49ba63b6dc0c19dcd45e86cabde8645f23
block: 42328225
timestamp: 2026-02-18T20:16:37Z

log_index: 1143
Transfer:
  from: 0x0000000000000000000000000000000000000000
  to:   0xc27c8b3ce02349f4916bfc8fd45a586d8787ee5e
  token_id: 113464

log_index: 1150
Transfer:
  from: 0xc27c8b3ce02349f4916bfc8fd45a586d8787ee5e
  to:   wallet
  token_id: 113464
```

Lectura:

- Si, hubo transfer-in de ese lock a la wallet.
- El NFT fue minteado desde zero address y transferido a la wallet en la misma tx.
- La tx de origen no aparece en el wallet-centric decoded history local, probablemente porque la wallet no fue `from_address`/`to_address` de la transaccion externa aunque si fue receptora del ERC721 en logs.
- Metadata NFT no aporta lifecycle suficiente; el historial de transfers NFT si aporta evidencia historica valida porque trae `tx_hash`, `block_number`, `log_index`, `token_address`, `token_id`, `from` y `to`.
- El decoded de `tx 0x60b661...` confirma Protocol Grants: `to_address=0x51e171d2fde9b37bbbb624a53ef54959422388e4`, address publico de Aerodrome Protocol Grants / Flight School, y los logs incluyen el transfer del veNFT `113464` hacia la wallet.

### Resolucion Confirmada Por Aerodrome

No se debe asumir que `depositManaged` crea el lock.

Fuentes oficiales revisadas:

- `aerodrome-finance/contracts/SPECIFICATION.md`
- `aerodrome-finance/contracts/contracts/VotingEscrow.sol`
- `aerodrome-finance/contracts/contracts/Voter.sol`
- `aerodrome-finance/docs/content/relay.mdx`
- `aerodrome-finance/relay/README.md`

Semantica confirmada:

- `VotingEscrow` define tres estados de veNFT: `NORMAL`, `LOCKED`, `MANAGED`.
- Cuando un usuario deposita un NFT normal dentro de un managed NFT, el NFT del usuario pasa a estado `LOCKED`.
- Los deposits/withdraws de managed NFTs pasan por `Voter`.
- `VotingEscrow.createManagedLockFor(address)` es la funcion que crea un managed NFT: incrementa `tokenId`, mintea el mToken, lo marca `MANAGED` y crea sus rewards contracts.
- `VotingEscrow.depositManaged(uint256 _tokenId, uint256 _mTokenId)` exige que `_tokenId` ya sea `NORMAL`, que `_mTokenId` ya sea `MANAGED`, mueve el peso desde el user lock al managed lock, registra `idToManaged[_tokenId] = _mTokenId`, cambia `escrowType[_tokenId] = LOCKED` y emite `DepositManaged`.
- `Voter.depositManaged(uint256 _tokenId, uint256 _mTokenId)` valida owner/approval, llama a `VotingEscrow.depositManaged`, luego hace `poke` del managed token para sincronizar voting power.

Conclusion del bug:

```text
depositManaged(113464, 10298) != creation of lock 113464
depositManaged(113464, 10298) == managed/relay deposit transition for an existing normal veNFT
```

Por lo tanto, si la primera aparicion de `tokenId=113464` en el historial wallet-centric es `depositManaged`, el engine debe crear una identidad parcial de lock existente y un evento `governance_lock_deposit_managed`, no un evento de creacion.

### Resolucion Del Origen

El origen se resuelve con NFT transfer history:

```text
origin_tx_hash: 0x60b661cee4ae2ed5a2cb0361aff4bf49ba63b6dc0c19dcd45e86cabde8645f23
origin_block_number: 42328225
origin_timestamp: 2026-02-18T20:16:37Z
origin_kind: protocol_grant_mint_then_transfer_in
origin_source: protocol_grants
initial_mint_to: 0xc27c8b3ce02349f4916bfc8fd45a586d8787ee5e
wallet_received_at_log_index: 1150
```

El engine v2 debe considerar el lock `113464` como wallet-owned desde el transfer-in log, no desde `depositManaged`. Pero debe separar:

- creator/issuer/initiator: Aerodrome Protocol Grants address `0x51e171d2fde9b37bbbb624a53ef54959422388e4`, not wallet;
- recipient/owner after transfer: wallet;
- origin event type: protocol grant veNFT received;
- later event type: managed/relay deposit transition to managed token `10298`.

Evidencia concreta del decoded:

```text
tx: 0x60b661cee4ae2ed5a2cb0361aff4bf49ba63b6dc0c19dcd45e86cabde8645f23
from: 0x4e805029b8613d4fc5b4631c26e2c2e630d3724a
to:   0x51e171d2fde9b37bbbb624a53ef54959422388e4
input selector: 0x6a761202
status: success

log 1143:
  contract: VotingEscrow 0xebf418fe2512e7e6bd9b87a8f0f294acdc67e6b4
  event: Transfer
  from: zero
  to: 0xc27c8b3ce02349f4916bfc8fd45a586d8787ee5e
  tokenId: 113464

log 1145:
  contract: AERO 0x940181a94a35a4569e4529a3cdfb74e38fd98631
  event: Transfer
  from: 0xc27c8b3ce02349f4916bfc8fd45a586d8787ee5e
  to: VotingEscrow
  amount: 1528 AERO

log 1146:
  contract: VotingEscrow
  event: Deposit
  provider: 0xc27c8b3ce02349f4916bfc8fd45a586d8787ee5e
  tokenId: 113464
  value: 1528 AERO

log 1150:
  contract: VotingEscrow
  event: Transfer
  from: 0xc27c8b3ce02349f4916bfc8fd45a586d8787ee5e
  to: wallet
  tokenId: 113464
```

Conclusion:

```text
tokenId=113464 is a protocol grant veNFT received by wallet.
It is not a user-created lock.
It is later deposited into managed tokenId=10298 via depositManaged.
```

### Como Confirmar Si Es Protocol Grant

`protocol_grant_candidate` pasa a `protocol_grant_lock_received` solo si el engine obtiene una de estas evidencias:

1. El `from_address`, `to_address` o `operator` de la tx de origen coincide con un contrato/address persistido como `Aerodrome Protocol Grants`, `Flight School`, `Public Goods Fund`, `Momentum Fund` o distributor oficial, con evidencia de fuente.
2. La tx de origen decodifica una funcion/evento de distribucion de grants o lock-bonus, y el recipient final es la wallet.
3. Los logs de `VotingEscrow.Transfer` muestran mint + transfer-in en una tx cuyo contrato llamador esta verificado y etiquetado como grants/distributor por BaseScan/Sourcify/ABI registry.
4. Una fuente oficial o lista de distribucion verificable enlaza la wallet/tokenId/tx con un programa de grants.

Fuente publica revisada:

- Aerodrome Token Transparency Framework Q2 2025 lista los wallets de Foundation, Public Goods, Protocol Grants / Flight School y related buckets.
- Direcciones relevantes para registry inicial verificable:
  - `0x834C0DA026d5F933C2c18Fa9F8Ba7f1f792fDa52`: Public Goods Wallet.
  - `0x51E171d2FDe9b37BBBb624A53Ef54959422388E4`: Protocol Grants, descrito como bucket que devino Flight School / lock bonus.
  - `0x623CF63A1fA7068EBBDBa9F2EB262613EaB557a1`: wallet de buyback/locked funds delegated to Flight School.
  - `0x5b1892b546002Ff3dd508500575bD6Bf7a101431`: Velodrome Foundation Aerodrome Airdrop.

Estas direcciones no deben hardcodearse en classifiers sueltos. Deben persistirse en `protocol_contracts` / `protocol_known_addresses` con `source_url`, `source_label`, `verified_at`, `chain_id`, `confidence` y versionado. La clasificacion del token `113464` como grant requiere que la tx `0x60b661...` o sus callers/logs conecten con una de estas direcciones o con un contrato/distributor verificado equivalente.

### Flujo Operacional Desde Wallet History

Este caso no cambia el flujo principal del engine. Es un fallback extremo de identidad para entidades fuertes de protocolo, no una regla para transfers nativas o transfers ERC20/ERC721 comunes.

Aplica solo cuando:

- una tx soportada de protocolo decodifica un identificador fuerte, por ejemplo:
  - `Voter.depositManaged(tokenId, mTokenId)`;
  - `Voter.vote(tokenId, pools, weights)`;
  - `Voter.poke(tokenId)`;
  - `Voter.claimBribes(..., tokenId)`;
  - `Voter.claimFees(..., tokenId)`;
  - `RewardsDistributor.claim(tokenId)`;
  - otros metodos governance/lock que carguen `tokenId`;
- ese `tokenId` no existe todavia en `governance_locks`, `domain_events` o `canonical_transaction_logs`;
- el contrato del token id esta identificado como `VotingEscrow`/veNFT de Aerodrome o entidad de protocolo equivalente.

No aplica para:

- ETH/native transfers simples;
- ERC20 transfers comunes;
- NFT transfers generales sin relacion con una accion de protocolo soportada;
- airdrops/phishing;
- activity rows genericas sin una entidad fuerte que el product spec requiera reconstruir.

1. El collector historico obtiene wallet decoded history en orden ASC y persiste tx/logs/internal tx.
2. El classifier ve `Voter.depositManaged(tokenId=113464, mTokenId=10298)` en `tx 0xc220cbbd...`.
3. Antes de clasificar el lock como completo, busca en DB:
   - `governance_locks(chainId, tokenId=113464)`;
   - `canonical_transaction_logs` de `VotingEscrow.Transfer/Deposit` para `tokenId=113464`;
   - `domain_events` previos `governance_lock_created`, `governance_lock_transfer_in`, `governance_lock_grant_received`.
4. Si no hay origen, no inventa creacion. Persiste una shell:
   - `origin_status=missing_origin`;
   - `managed_status=deposit_observed`;
   - `managed_token_id=10298`;
   - `enrichment_need=lock_identity_backfill`.
5. El backfill consulta NFT transfers por `VotingEscrow + tokenId`. Moralis expone el endpoint:

```text
GET https://deep-index.moralis.io/api/v2.2/nft/{token_address}/{token_id}/transfers?chain=base
```

Ejemplo real del caso:

```text
GET https://deep-index.moralis.io/api/v2.2/nft/0xebf418fe2512e7e6bd9b87a8f0f294acdc67e6b4/113464/transfers?chain=base
```

Donde:

- `0xebf418fe2512e7e6bd9b87a8f0f294acdc67e6b4` es el contrato `VotingEscrow`/veNFT de Aerodrome en Base.
- `113464` es el lock token id detectado en `depositManaged`.
- El resultado debe persistirse como evidencia historica por `(chain_id, token_address, token_id, transaction_hash, log_index)`.

6. Si encuentra tx de mint/transfer-in, persiste esos logs como evidencia canonica aunque la tx no pertenezca al wallet history normal.
7. Luego consulta tx decoded por hash de la tx de origen. Moralis documenta `GET /api/v2.2/transaction/{transaction_hash}/verbose`, util para obtener la transaccion decodificada por hash.
8. Con la tx decoded de origen, el classifier intenta resolver:
   - caller/initiator;
   - contrato/distributor;
   - decoded call;
   - logs alrededor del mint/transfer;
   - match contra `protocol_known_addresses`.
9. Si el source coincide con Grants/Flight School/Public Goods, promueve `protocol_grant_candidate` a `protocol_grant_lock_received`.
10. Si no, deja `governance_lock_external_transfer_in` con `origin_hypothesis=protocol_grant_candidate` o `origin_hypothesis=unknown_external_source`.

Reglas de costo:

- Este backfill no corre para todos los NFTs.
- Solo corre cuando una tx soportada de protocolo referencia una identidad fuerte (`tokenId`) que no existe en el canonical store.
- Todos los resultados son DB-first y se cachean/persisten por `(chain_id, token_address, token_id)` y `(chain_id, tx_hash)`.
- El request path de la UI nunca llama estos endpoints.
- Los llamados externos son el minimo posible:
  - primero DB/canonical store;
  - luego cache persistido de `nft_transfer_backfills`;
  - si falta, **un solo** llamado a NFT transfers por `(chain_id, token_address, token_id)`;
  - si el transfer history devuelve una tx de origen no canonicalizada, **un solo** llamado a tx decoded por `(chain_id, tx_hash)`;
  - ambos resultados quedan persistidos de forma inmutable y reutilizable entre wallets/runs.
- `enrichment_needs` debe deduplicar por llave natural:

```text
nft_transfer_backfill:
  unique(chain_id, token_address, token_id)

transaction_decoded_backfill:
  unique(chain_id, tx_hash)
```

- Si el backfill ya fallo por rate limit/provider error, no se reintenta en loop dentro del mismo analysis run; queda `retry_after`/`attempt_count` para una corrida posterior.

Si solo existe el transfer history del NFT, la clasificacion conservadora es:

```text
event_type: governance_lock_external_transfer_in
origin_hypothesis: protocol_grant_candidate
confidence: medium
coverage_status: partial_origin_source
```

Si se confirma grant:

```text
event_type: governance_lock_grant_received
origin_source: protocol_grants | flight_school | public_goods_fund | momentum_fund
confidence: high
coverage_status: full_identity_origin
```

### Por Que Es Bug

El Governance DataView debe explicar lifecycle de los locks. Si una tx usa un lock con owner wallet y el wallet-centric history no trae el origen, el engine debe abrir un subproceso de backfill NFT/logs para reconstruirlo. Este caso prueba que el backfill es obligatorio: sin el historial NFT, el engine pierde un segundo lock real.

### Fix Esperado

Agregar enrichment:

```text
lock_identity_backfill(chainId, votingEscrowAddress, walletAddress, tokenId)
```

Estrategia DB/provider:

1. DB-first: buscar en `canonical_transaction_logs` cualquier `VotingEscrow.Transfer/Deposit/DepositManaged/Withdraw` con `tokenId=113464`.
2. Si no existe, consultar cache persistido de provider/enrichment para `chainId + votingEscrow + tokenId`.
3. Si falta, intentar historial NFT por contrato/tokenId en Moralis/Alchemy. Este endpoint es evidencia historica valida si devuelve transfer/mint con `tx_hash`, `block_number`, `log_index` y contrato `VotingEscrow`; metadata/tokenURI por si sola no prueba creacion.
4. Si falta, usar Alchemy/RPC `eth_getLogs` sobre `VotingEscrow` filtrando `Transfer` por `tokenId` cuando sea indexed; para `Deposit`/`DepositManaged` usar logs por rango alrededor de la primera aparicion si el tokenId no permite topic filter suficiente.
5. Complementar con `eth_call` de estado actual: `ownerOf(tokenId)`, `locked(tokenId)`, `escrowType(tokenId)`, `idToManaged(tokenId)`, `balanceOfNFT(tokenId)`, `voted(tokenId)` y `tokenURI(tokenId)`. Estos calls validan estado actual, pero no sustituyen evidencia historica de creacion.

Materializacion luego del backfill NFT resuelto:

```text
governance_locks:
  lock_token_id: 113464
  wallet_address: wallet
  origin_status: resolved_from_nft_transfer_history
  origin_tx_hash: 0x60b661cee4ae2ed5a2cb0361aff4bf49ba63b6dc0c19dcd45e86cabde8645f23
  origin_kind: protocol_grant_mint_then_transfer_in
  origin_source: protocol_grants
  received_from: 0xc27c8b3ce02349f4916bfc8fd45a586d8787ee5e
  managed_status: deposited
  managed_token_id: 10298
  current_state_source: depositManaged event + optional eth_call
  coverage_status: full_identity_partial_accounting

governance_lock_events:
  - event_type: governance_lock_grant_mint
    lock_token_id: 113464
    tx_hash: 0x60b661cee4ae2ed5a2cb0361aff4bf49ba63b6dc0c19dcd45e86cabde8645f23
    log_index: 1143
    from: zero
    to: 0xc27c8b3ce02349f4916bfc8fd45a586d8787ee5e
  - event_type: governance_lock_grant_received
    lock_token_id: 113464
    tx_hash: 0x60b661cee4ae2ed5a2cb0361aff4bf49ba63b6dc0c19dcd45e86cabde8645f23
    log_index: 1150
    from: 0xc27c8b3ce02349f4916bfc8fd45a586d8787ee5e
    to: wallet
  event_type: governance_lock_deposit_managed
  source_lock_token_id: 113464
  managed_token_id: 10298
  tx_hash: 0xc220cbbd...
  confidence: high_for_transition
  coverage_status: full_identity_partial_managed_metadata
```

Regla dura:

```text
Do not mark tokenId=113464 as created at tx 0xc220cbbd...
Do not mark tokenId=113464 as user-created at tx 0x60b661...
Do mark tokenId=113464 as external transfer-in by wallet at tx 0x60b661... log_index 1150 when NFT transfer history is available
Do classify it as protocol_grant_lock_received when tx decoded/log evidence connects to Protocol Grants address 0x51e171...
Do not merge tokenId=113464 with tokenId=110971
Do not treat managedTokenId=10298 as wallet-owned direct lock
```

### Persistencia Requerida

- `governance_locks`
- `governance_lock_events`
- `enrichment_needs` con type `lock_identity_backfill`
- `canonical_transaction_logs` para logs globales backfilled no necesariamente wallet-centric.

### Regression

Fixture debe probar:

```text
Given tx 0xc220cbbd... references depositManaged(113464,10298)
And wallet-centric history does not include lock origin
When lock_identity_backfill reads NFT transfer history for VotingEscrow tokenId=113464
Then it records mint zero -> 0xc27c... at tx 0x60b661... log 1143
And records transfer-in 0xc27c... -> wallet at tx 0x60b661... log 1150
And updates governance_locks tokenId=113464 with origin_status resolved_from_nft_transfer_history
And classifies the origin as protocol_grant_lock_received because tx.to is the verified Protocol Grants address 0x51e171...
And records managedTokenId=10298 from tx 0xc220cbbd...
And does not merge it into tokenId=110971
```

## BUG-EV2-003: Lock `110971` Lifecycle Debe Ser Completo Y Separado De `113464`

### Sintoma

El lock `110971` si tiene lifecycle claro:

```text
tx: 0xe1132344...
function: VotingEscrow.createLock
args:
  amount: 10879930269062516265282
  duration: 125798400
Transfer: zero -> wallet, tokenId=110971
Deposit: tokenId=110971, depositType=1
Supply: updated
```

Luego `110971` aparece en:

- votes;
- pokes;
- claimBribes;
- RewardsDistributor.claim;
- rebase/relock `Deposit` events.

### Riesgo

Si el engine actual ve `depositManaged(113464,10298)` y luego muchos Voter events de `10298`, podria mezclar:

- lock normal `110971`;
- user lock `113464`;
- managed token `10298`.

Eso romperia Governance KPI, timeline, relay state y returns.

### Fix Esperado

El modelo debe tener tres identidades separadas:

```text
lockTokenId=110971  -> wallet-owned direct lock
lockTokenId=113464  -> wallet-owned/managed-deposited lock, partial origin until backfill
managedTokenId=10298 -> managed/relay aggregate token used by Voter events
```

Y debe registrar links:

```text
113464 --depositManaged--> 10298
110971 --vote/claim/rebase--> normal direct governance lifecycle
```

### Regression

Fixture con txs `0xe1132344...`, `0xc220cbbd...`, `0x0190dd5e...`, `0x50d02e...` debe afirmar:

- dos lock identities no se fusionan;
- managed token id se trata como related managed identity, no como wallet-owned lock;
- votes posteriores de `110971` no se asignan a `113464`;
- abstained/voted events dentro de `depositManaged` sobre `10298` quedan asociados al managed context.

## BUG-EV2-004: `depositManaged` Semantics Incompletas

### Sintoma

La accion se decodifica bien, pero aun no sabemos si UI debe etiquetarla como:

- relay deposit;
- managed lock deposit;
- managed relay exposure;
- deposit into managed veNFT.

### Por Que Es Bug

No afecta solo copy. Afecta:

- lock status panel;
- governance return;
- ownership;
- votes manual vs relay;
- reward attribution;
- whether rewards remain direct or managed/relay.

### Fix Esperado

Crear adapter Aerodrome governance que modele:

```text
depositManaged(userTokenId, managedTokenId)
```

Como evento:

```text
eventType: governance_lock_deposit_managed
sourceLockId: userTokenId
managedLockId: managedTokenId
status: managed
coverage: partial until managed metadata resolved
```

Luego agregar enrichment:

```text
managed_lock_metadata_backfill(managedTokenId)
```

para resolver si corresponde a relay, que relay/protocol surface es, y como mostrarlo.

### Evidencia Del HAR De Aerodrome Locks

El HAR reducido de `docs/research/locks-dashboard-aerodrome-finance.har` muestra que la pantalla de locks de Aerodrome carga estado con Alchemy `eth_call` batched, no con un endpoint REST semantico de locks:

- `Multicall3.aggregate3((address,bool,bytes)[])` sobre `0xca11bde05977b3631167028862be2a173976ca11`.
- `LpSugar.count()`, `LpSugar.tokens(...)` y `LpSugar.all(...)` sobre `0x69dd9db6d8f8e7d83887a704f447b1a584b599a1` para inventario/pools/tokens actuales.
- `RewardsSugar.rewards(uint256 limit,uint256 offset,uint256 veNftId)` sobre `0x1b121efdaf4abb8785a315c51d29bce0552a7678` para rewards por `veNFT id`.
- `Voter.poke(uint256)` sobre `0x16613524e02ad97edfef371bc883f2f5d6c480a5`, capturado como simulacion/read de accion para `tokenId=110971`.
- Un helper/sugar wallet-scoped `0x4c5d3925fe65dfeb5a079485136e4de09cb664a5` con selector `0x47f7e06f(address)`, llamado dentro de `Multicall3`, devuelve la lista de locks visibles para la wallet.

En este HAR solo aparecen requests con `tokenId=110971` como argumento explicito. Sin embargo, `113464` y `10298` si aparecen en responses:

```text
HAR entry: 10
RPC: Alchemy eth_call -> Multicall3.aggregate3
inner call:
  target: 0x4c5d3925fe65dfeb5a079485136e4de09cb664a5
  selector: 0x47f7e06f
  arg: wallet
response:
  dynamic array length: 2
  item 1 includes tokenId=110971
  item 2 includes tokenId=113464
  item 2 includes managedTokenId=10298
```

Tambien aparecen en otros responses grandes:

```text
HAR entry: 21
target: 0x3dd0849d66dbd63d06f11442502e200601c50790
selector: 0x9788802f
arg: wallet
response: contiene 113464 y 10298 en una lista wallet-scoped grande
```

El ABI/name exacto de `0x4c5d...` y `0x3dd0...` aun debe registrarse via ABI fetch/verificacion. Lo que si queda probado por el HAR es que Aerodrome usa helpers/sugar wallet-scoped para devolver el estado visible de locks y managed/relay linkage.

La conclusion para Engine V2 es:

```text
tx historica depositManaged(userTokenId, managedTokenId)
  -> fuente primaria de identidad relacional

HAR Locks/Aerodrome eth_call wallet-scoped helpers
  -> fuente secundaria de estado actual, lista de locks visibles, managedTokenId y rewards por veNFT
  -> no reemplaza evidencia historica ni crea ownership
```

### Regla De Hidratacion Para Managed/Relay

Cuando el classifier ve `depositManaged(userTokenId, managedTokenId)`:

1. Persistir `userTokenId` como lock de usuario, aunque su origen historico este parcial.
2. Persistir `managedTokenId` como managed/relay token separado, no como lock directo de la wallet.
3. Crear link explicito `userTokenId -> managedTokenId` con source event `depositManaged`.
4. Marcar la accion como `governance_lock_deposit_managed`.
5. Encolar current-state enrichment minimo, cacheado y DB-first solo para esos IDs:
   - registrar el helper/sugar `0x4c5d3925fe65dfeb5a079485136e4de09cb664a5` en `protocol_contracts`;
   - registrar selector `0x47f7e06f(address)` en `contract_selectors`/ABI registry cuando el ABI este verificado;
   - ejecutar `eth_call` contra ese helper durante analysis enrichment, nunca en request-time UI/API;
   - persistir el snapshot wallet-scoped en `protocol_state_snapshots` o tabla equivalente con `source_contract`, `selector`, `block_number`, `wallet_address`, `raw_result`, `decoded_json`, `fetched_at`;
   - persistir la relacion normalizada en DB, por ejemplo `governance_lock_managed_links(chain_id, wallet_address, lock_token_id, managed_token_id, source_contract, source_selector, source_tx_hash, source_block_number, coverage_status, confidence)`;
   - `VotingEscrow.idToManaged(userTokenId)` si el ABI lo expone;
   - `VotingEscrow.escrowType(userTokenId)` y `VotingEscrow.escrowType(managedTokenId)` si el ABI lo expone;
   - `VotingEscrow.locked(tokenId)` / `balanceOfNFT(tokenId)` / `ownerOf(tokenId)` para estado actual;
   - `RewardsSugar.rewards(limit, offset, userTokenId)` solo para rewards visibles del lock, no para probar origen.
6. Resolver label `relay` solo si metadata/verificacion del managed token o contrato lo prueba. Si no, mantener `managed lock` con cobertura parcial.

No se debe ejecutar NFT transfer backfill para transfers nativos, ERC20 ni NFTs genericos. Ese backfill queda reservado para metodos governance con identidad fuerte de lock que referencia un `tokenId` no visto antes por el engine.

### Input Usuario/Research Necesario

Ya no debe depender de memoria del usuario. La memoria del usuario puede ayudar a validar fixtures, pero el engine debe resolver la relacion desde `depositManaged(userTokenId, managedTokenId)`, estado onchain cacheado y, cuando falte origen historico del user lock, backfill minimo de NFT transfers + decoded tx.

### Criterio De Cierre Del Bug

Este bug se considera cerrado cuando Engine V2:

```text
given depositManaged(userTokenId, managedTokenId)
and/or Aerodrome locks helper response containing lock_token_id + managed_token_id

persists:
  governance_locks.lock_token_id = userTokenId
  governance_locks.managed_status = deposited
  governance_locks.managed_token_id = managedTokenId
  governance_lock_managed_links.lock_token_id = userTokenId
  governance_lock_managed_links.managed_token_id = managedTokenId
  governance_lock_managed_links.source = depositManaged tx and/or helper snapshot

and:
  does not classify managedTokenId as a wallet-owned direct lock
  does not call helper/sugar from request-time APIs
  exposes the relation to Governance read models from DB only
```

## BUG-EV2-005: Claim All / ClaimBribes No Materializa Items Con Breakdown Completo

### Sintoma

Se detectan `claimBribes` con argumentos completos:

```text
function: Voter.claimBribes(address[] bribes, address[][] tokens, uint256 tokenId)
tokenId: 110971
```

Ejemplo:

```text
tx 0x58490d8b...
bribes: [0x685b..., 0x9636..., ...]
tokens per bribe:
  [AERO]
  [WETH, USDS]
  [USDC, AERO, ...]
  ...
```

Pero la clasificacion actual lo marca como `high_action_partial_breakdown`.

### Por Que Es Bug

Con ABI ya tenemos:

- tokenId;
- bribe contracts;
- tokens reclamados;
- transfer logs de tokens hacia wallet.

El engine debe poder crear child claim items con confianza alta para accion y token amount. Lo que puede quedar partial es pool/epoch si no se mapea bribe contract -> pool/epoch.

### Fix Esperado

Para cada `claimBribes`:

1. Crear parent `governance_claim_batch`.
2. Crear child `governance_bribe_claim_item` por cada transfer/token/bribe pair.
3. Linkear `tokenId`.
4. Linkear bribe contract.
5. Encolar enrichment `bribe_contract_pool_backfill` si no hay pool.
6. Valuar cada item con historical price.

### Resolucion Con Evidencia ABI + Logs

La tx fixture `0x58490d8b78d0626e1cd008dd8870c3e8667aa27ee11d8d12f8da118394cb324f` cierra la regla general:

```text
to: Voter 0x16613524e02ad97edfef371bc883f2f5d6c480a5
function: claimBribes(address[] bribes,address[][] tokens,uint256 tokenId)
tokenId: 110971
```

El input decodificado trae:

```text
bribe[0] 0x685b... -> [AERO]
bribe[1] 0x9636... -> [WETH, USDS]
bribe[2] 0x42fa... -> [USDC, AERO, token 0xa885...]
bribe[3] 0x765d... -> [WETH, USDC]
bribe[4] 0xb236... -> [WETH, cbBTC]
bribe[5] 0x6948... -> [USDC, cbBTC]
```

Los logs contienen transfers hacia la wallet desde esos mismos bribe contracts:

```text
log 91  AERO  from bribe[0] -> wallet
log 93  WETH  from bribe[1] -> wallet
log 95  USDS  from bribe[1] -> wallet
log 97  USDC  from bribe[2] -> wallet
log 99  AERO  from bribe[2] -> wallet
log 101 token 0xa885... from bribe[2] -> wallet
log 103 WETH  from bribe[3] -> wallet
log 105 USDC  from bribe[3] -> wallet
log 107 WETH  from bribe[4] -> wallet
log 109 cbBTC from bribe[4] -> wallet
log 111 USDC  from bribe[5] -> wallet
log 113 cbBTC from bribe[5] -> wallet
```

Por lo tanto, `high_action_partial_breakdown` es demasiado conservador para accion/token/amount. La regla correcta es:

```text
if decoded function is Voter.claimBribes(bribes,tokens,tokenId):
  create one parent governance_claim_batch
  for each ERC20 Transfer log:
    require transfer.to == wallet
    require transfer.from in decoded bribes[]
    require transfer.token_address in decoded tokens[indexOf(transfer.from)]
    create governance_bribe_claim_item
      token_id = tokenId
      bribe_contract = transfer.from
      token_address = transfer.token_address
      amount_raw = transfer.amount
      source_log_index = transfer.log_index
      confidence = high
      coverage = full_action_token_amount
```

Lo que puede seguir parcial:

- `pool_id`, si no se resolvio bribe contract -> gauge/pool con evidencia de contrato.
- `epoch_id`, si no hay periodo emitido o derivacion de calendario marcada como derivada.
- `value_usd_at_claim`, hasta completar historical price.

Lo que no debe quedar parcial:

- accion `claimBribes`;
- `tokenId`;
- bribe contract source;
- token address;
- raw amount;
- direccion de ingreso a wallet.

### Persistencia Requerida

Persistir:

```text
domain_events:
  event_type = governance_claim_batch
  tx_hash = 0x58490d8b...
  lock_token_id = 110971

governance_reward_claim_items:
  reward_type = bribe
  parent_domain_event_id = governance_claim_batch.id
  token_id = 110971
  source_contract_address = bribe contract
  source_contract_kind = bribe_voting_reward
  token_address = transfer token
  amount_raw = transfer amount
  log_index = transfer log_index
  coverage_status = full_action_token_amount
  confidence = high
  pool_id = null until bribe_contract_pool_backfill resolves it
```

Encolar `bribe_contract_pool_backfill` una sola vez por `(chain_id, bribe_contract)` y cachear/persistir el resultado. Si no hay evidencia explicita de pool, el item queda visible y valuado por token pero con `pool_id=null`, `coverage_status=partial_pool_context`.

### Criterio De Cierre Del Bug

Este bug queda cerrado cuando `claimBribes` produce child rows deterministas con:

```text
child count == count(Transfer logs where to=wallet and from in decoded bribes and token in decoded tokens[bribeIndex])
no duplicate item for same tx_hash + log_index
high confidence for action/token/amount
partial only for pool/epoch/value enrichment when missing
Rewards/Governance count the child items once
Activity can show parent batch + children
```

### Regression

Fixture `0x58490d8b...`:

```text
parent event count = 1
child bribe claim item count >= token transfers to wallet from listed bribe contracts
tokenId = 110971
coverage = full for action/token/amount
coverage = partial only for pool/epoch if mapping missing
```

## BUG-EV2-006: `claimFees` Debe Detectarse Dentro De Multicall/Batch, No Solo Como Tx Directa

### Sintoma

El usuario observa que Aerodrome Finance tiene funcion "claim all" que reclama fees de pools votados y bribes. Estas actividades pueden quedar dentro de multicall/batch.

### Riesgo

Si el engine solo mira el selector externo:

- pierde `claimFees`;
- clasifica todo como generic governance claim;
- no separa fees vs bribes;
- no reconcilia Rewards/Governance/Pools;
- produce totals incorrectos.

### Fix Esperado

Decoder nested:

```text
if functionName == multicall(bytes[]) or batch-like:
  decode each payload with same contract ABI or target-specific ABI
  emit child call records
```

Persistencia:

- `canonical_calls` o call tree dentro de `canonical_transactions`;
- `domain_events.parent_domain_event_id`;
- `governance_reward_claim_items`.

### Fixture Multicall Analizado

En los seis archivos fixture no aparece un `Voter.claimFees(...)` dentro de multicall governance. Si aparece el mismo patron ABI en Aerodrome Slipstream:

```text
tx: 0x8bb147ba50aaa7582a57d7f50d4299840ae9fbc1922f3d6272b926405319a763
to: Slipstream Nonfungible Position Manager
contract: 0x827922686190790b37229fd06084350e74485b72
outer selector: 0xac9650d8
outer function: multicall(bytes[])
```

Moralis muestra el outer como `data`, pero el ABI local decodifica `multicall(bytes[])`. Los subcalls son:

```text
subcall[0]
  selector: 0x0c49ccbe
  function: decreaseLiquidity
  tokenId: 56113878
  liquidity: 10736471064307

subcall[1]
  selector: 0xfc6f7865
  function: collect
  tokenId: 56113878
  recipient: wallet

subcall[2]
  selector: 0x42966c68
  function: burn
  tokenId: 56113878
```

Los transfer logs confirman el `collect`:

```text
log 604: WETH  pool -> wallet
log 605: cbBTC pool -> wallet
```

Esto prueba la mecanica necesaria: no alcanza mirar el selector externo. El engine debe crear un call tree y clasificar cada subcall.

### Regla General Para Governance `claimFees`

El ABI de `Voter` expone:

```text
claimBribes(address[] bribes,address[][] tokens,uint256 tokenId)
claimFees(address[] fees,address[][] tokens,uint256 tokenId)
```

Si una tx governance llega como:

```text
outer function: multicall(bytes[])
target: Voter or router/batch contract with known target semantics
```

el classifier debe:

1. Persistir el outer call como parent call.
2. Decodificar cada `bytes` subcall con el ABI del target si el multicall ejecuta sobre el mismo contrato.
3. Si el multicall/router permite targets por subcall, decodificar cada payload con el ABI del target especifico.
4. Crear `canonical_calls` con:
   - `tx_hash`
   - `call_path` (`0`, `0.1`, etc.)
   - `parent_call_id`
   - `target_address`
   - `selector`
   - `function_name`
   - `decoded_args_json`
5. Si una subcall es `claimFees(fees,tokens,tokenId)`, crear:
   - parent `governance_claim_batch` si hay mas de una claim subcall;
   - child `governance_fee_claim_item` por transfer validado desde `fee` contract hacia wallet;
   - `lock_token_id = tokenId`;
   - `source_contract_address = fee contract`;
   - `coverage_status = full_action_token_amount` cuando token/amount salen de transfer log.

Si no hay evento especifico de `claimFees`, la subcall ABI + transfer logs es evidencia suficiente para accion/token/amount. Lo unico partial puede ser `pool_id`/`epoch_id` hasta resolver `fee contract -> gauge/pool`.

### Persistencia Requerida Para Nested Calls

Agregar o formalizar una tabla `canonical_calls`:

```text
canonical_calls:
  id
  chain_id
  tx_hash
  call_path
  parent_call_id
  target_address
  selector
  function_name
  decoded_args_json
  raw_call_data
  abi_source_id
  confidence
  created_at
```

`domain_events` y `governance_reward_claim_items` deben poder linkear a `canonical_calls.id`, no solo a `canonical_transactions.tx_hash`.

### Criterio De Cierre Del Bug

Este bug queda cerrado cuando:

```text
given outer multicall(bytes[])
when one subcall decodes to claimFees(...)
then Engine V2 persists the nested canonical_call
and materializes governance_fee_claim_item rows from matching transfer logs
and Activity can show the parent tx with claimFees children
and Rewards/Governance count child items once
```

### Regression

Fixture con tx de claim all:

```text
outer call = multicall/batch
inner calls include claimFees and claimBribes
Activity parent = governance_claim_batch
Rewards rows include fee and bribe child items
No double counting
```

## BUG-EV2-007: Rebase Claims Tienen Accion Clara Pero Value Effect Parcial

### Sintoma

Varias tx `RewardsDistributor.claim` estan clasificadas como:

```text
governance_rebase_claim
confidence: high_action_partial_value_effect
```

Ejemplos:

- `0x17198d3f...`
- `0x2b29e51e...`
- `0xbad0c8e9...`
- `0x751e1e3c...`
- `0x96838ad6...`
- `0x87c5df15...`
- `0xd0eada15...`
- `0x3afd6d...`
- `0x810fe5...`
- `0x22b574...`

### Por Que Es Bug

Si AERO se re-lockea al lock, el engine debe explicar:

- reward amount;
- USD at claim;
- whether liquid or non-liquid;
- lock tokenId affected;
- resulting locked AERO/veAERO effect.

### Fix Esperado

Para cada `RewardsDistributor.claim`:

1. Decodificar input para tokenId.
2. Decodificar VotingEscrow `Deposit` event.
3. Linkear to `governance_lock_id`.
4. Crear reward item:
   - `rewardType = rebase`
   - `liquid = false`
   - `valueEffect = locked_aero_increase`
5. Valuar AERO at block timestamp.

### Resolucion Verificada

La tx `0x17198d3f3e7d2edea92588e1087e121a08b92111047db491731b561b1d87f79e`
demuestra que el rebase claim tiene evidencia suficiente para pasar de
`high_action_partial_value_effect` a `high_action_token_amount_non_liquid`.

Evidencia decodificada:

- input `RewardsDistributor.claim(uint256)`:
  - `tokenId = 110971`
- event `RewardsDistributor.Claimed(uint256 tokenId, uint256 epochStart, uint256 epochEnd, uint256 amount)`:
  - `tokenId = 110971`
  - `epochStart = 1768435200`
  - `epochEnd = 1770854400`
  - `amount = 19547489696785702711`
- ERC20 `Transfer` de AERO:
  - `from = RewardsDistributor`
  - `to = VotingEscrow`
  - `amount = 19547489696785702711`
- event `VotingEscrow.Deposit(address provider, uint256 tokenId, uint8 depositType, uint256 value, uint256 locktime, uint256 ts)`:
  - `provider = RewardsDistributor`
  - `tokenId = 110971`
  - `depositType = 0`
  - `value = 19547489696785702711`
  - `locktime = 1894233600`
- event `VotingEscrow.Supply(prevSupply, supply)`:
  - `supply - prevSupply = 19547489696785702711`
- event `VotingEscrow.MetadataUpdate(tokenId)`:
  - `tokenId = 110971`

Regla de clasificacion:

```text
if tx.to == RewardsDistributor
and input decodes as claim(tokenId) or claimMany(tokenIds)
and Claimed.tokenId matches input tokenId
and AERO Transfer.from == RewardsDistributor
and AERO Transfer.to == VotingEscrow
and VotingEscrow.Deposit.tokenId == tokenId
and Deposit.value == Claimed.amount == AERO transfer amount
then classify governance_rebase_claim_item
```

Persistencia esperada:

- `governance_reward_claim_items.reward_type = rebase`
- `governance_reward_claim_items.lock_token_id = tokenId`
- `governance_reward_claim_items.token_address = AERO`
- `governance_reward_claim_items.amount_raw = amount`
- `governance_reward_claim_items.liquid = false`
- `governance_reward_claim_items.value_effect = locked_aero_increase`
- `governance_reward_claim_items.affects_totals = true`
- `governance_reward_claim_items.cash_flow_kind = none`
- `governance_lock_events.event_type = rebase_claim_relock`
- `governance_lock_events.aero_amount = amount`
- `governance_lock_events.expires_at_after = Deposit.locktime`
- `governance_locks`/lock read model aumenta `locked_aero` por el evento o por replay del lifecycle.

Contabilidad:

- No contar como cash-in.
- No contar como reward liquido disponible.
- Si existe precio historico de AERO, `value_usd_at_claim` puede ser completo.
- Si falta precio historico, dejar `value_usd_at_claim` parcial sin degradar
  action/token/amount/lock identity.
- Si cualquier equality check falla, persistir `unresolved_rebase_claim_conflict`
  con los valores observados en `evidence_json`.

### Regression

Fixture `0x17198d3f...`:

```text
creates governance_rebase_claim_item
links tokenId=110971
records liquid=false
updates lock lifecycle with rebase_claim_relock
does not count as cash-in
```

## BUG-EV2-008: Bribe/Fee Contract -> Pool Mapping No Puede Ser Heuristico

### Sintoma

Claims traen bribe contract arrays y token arrays. Para mostrar pool en Governance/Rewards/Pools, el engine necesita mapear bribe/fee distributor a pool.

### Riesgo

Si se usa pool + tiempo o token pair guessed, se recrea el bug historico de attribution falsa.

### Fix Esperado

Agregar enrichment:

```text
reward_distributor_pool_backfill(chainId, distributorAddress)
```

Fuente primaria:

- `Voter.GaugeCreated(poolFactory, votingRewardsFactory, gaugeFactory, pool, bribeVotingReward, feeVotingReward, gauge, creator)`.

El evento `GaugeCreated` contiene explicitamente `pool`, `bribeVotingReward`,
`feeVotingReward` y `gauge`. Ese evento es la fuente correcta para mapear un
distributor reclamado en `claimBribes`/`claimFees` hacia un pool sin mirar token
pair ni ventanas de tiempo.

Validacion opcional por `eth_call` durante enrichment:

- `Voter.gaugeToBribe(gauge) == distributor` para bribes.
- `Voter.gaugeToFees(gauge) == distributor` para fees.
- `Voter.poolForGauge(gauge) == pool`.

Secuencia DB-first/cache-first:

1. Buscar `protocol_reward_distributor_pool_links` por `(chain_id, distributor_address)`.
2. Si no existe, buscar en logs canonicos ya persistidos de `Voter.GaugeCreated`.
3. Si tampoco existe, encolar un unico backfill por `(chain_id, voter_address, event=GaugeCreated)` usando Alchemy/Base RPC `eth_getLogs` durante analisis.
4. Decodificar todos los `GaugeCreated` obtenidos y persistir:
   - `bribeVotingReward -> pool/gauge/kind=bribe`
   - `feeVotingReward -> pool/gauge/kind=fee`
   - `gauge -> pool`
5. Reintentar resolver los claim items pendientes por distributor.

Esto evita llamadas por cada claim item o por cada wallet. La consulta remota se
hace como backfill protocol-level, cacheada y reutilizable para cualquier wallet.

Fuentes secundarias:

- ABI/RPC del bribe/fee distributor solo si expone una relacion explicita hacia
  gauge/pool.
- Registry oficial del protocolo si replica la relacion con evidencia verificable.
- Event logs de factories, si el `Voter.GaugeCreated` no esta disponible para
  una version futura del protocolo.

Si no hay evidencia explicita:

```text
poolId = null
coverage = partial_pool_unresolved
```

No permitido:

- resolver pool por tokens reclamados;
- resolver pool por token pair del bribe;
- resolver pool por "ultimo voto del tokenId";
- resolver pool por ventana temporal;
- mezclar bribe/fee distributor con pool hasta que exista `GaugeCreated` o
  una relacion de contrato equivalente.

### Regression

Claim item con distributor desconocido debe:

- aparecer en Governance/Rewards;
- contar como governance reward si amount/token/source son claros;
- no contribuir a Pool totals hasta resolver pool.

Fixture `0x58490d8b...`:

- `claimBribes` trae 6 bribe distributor addresses.
- Cada child item debe quedar con `pool_id=null` hasta que
  `protocol_reward_distributor_pool_links` resuelva el distributor.
- Cuando el backfill de `GaugeCreated` resuelve un distributor, el item actualiza
  `pool_id` sin cambiar `amount`, `token`, `reward_type` ni dedupe key.

## BUG-EV2-009: Provider Wallet History No Alcanza Para Todas Las Identidades

### Sintoma

`tokenId=113464` aparece por referencia, pero no aparece su origen en wallet history local.

### Conclusion

El engine no puede depender solo de address-centric history para reconstruir entidades referenciadas por tokenId.

Este gap queda resuelto por la regla general documentada en
`BUG-EV2-002`: cuando una accion de protocolo soportada referencia una entidad
fuerte ausente del canonical store, el engine crea una shell parcial y encola
un backfill minimo de identidad. Para locks veNFT, el backfill usa:

1. DB/canonical store local.
2. Cache persistido de NFT transfer backfill por `(chain_id, token_address, token_id)`.
3. Un unico `GET /api/v2.2/nft/{token_address}/{token_id}/transfers?chain=...`
   si no hay cache.
4. Un unico `GET /api/v2.2/transaction/{transaction_hash}/verbose?chain=...`
   si el transfer history encuentra una tx de origen no canonicalizada.

Esta regla no aplica a transfers nativos, ERC20/NFT genericos ni filas de
Activity comunes. Solo aplica cuando un metodo soportado de protocolo trae una
identidad fuerte que el producto necesita reconstruir, por ejemplo lock
`tokenId`, managed token id, pool, gauge, distributor, strategy wrapper o NFT LP
position.

### Fix Esperado

Cuando una tx referencia una entidad no conocida:

```text
entity_reference_detected_but_missing_origin
```

Debe crear:

- entity shell parcial;
- enrichment need especifico;
- regression failure si se pierde silenciosamente.

Ejemplos:

- lock tokenId;
- managed tokenId;
- pool address;
- gauge address;
- bribe/fee distributor;
- Mellow wrapper/strategy;
- NFT position tokenId.

### Persistencia Esperada

- `enrichment_needs.need_type = lock_identity_backfill` para locks veNFT.
- `enrichment_needs.need_type = nft_transfer_backfill` por
  `(chain_id, token_address, token_id)`.
- `enrichment_needs.need_type = transaction_decoded_backfill` por
  `(chain_id, tx_hash)`.
- `domain_entities` o tabla equivalente crea shell con
  `origin_status=missing_origin`.
- Al resolver el origen, actualizar shell/read model sin cambiar el evento que
  originalmente disparo el backfill.

### Regression Generica

```text
Given a supported protocol call references an unknown entity id
When canonical history has no prior origin for that id
Then the engine creates a partial entity shell
And enqueues exactly one deduped identity backfill for that entity
And does not fabricate creation, ownership, pool, strategy, reward or lock origin
And request-time APIs continue reading only persisted DB rows
```

## Cambios Documentales Realizados

Este documento complementa:

- `docs/informe-modelo-datos-engine-v2.md`
- `docs/plan-refactor-engine-procesador-transacciones.md`
- `docs/plan-refactor-engine-enrichment-accounting.md`

El spec de engine v2 debe incluir estos bugs como casos de aceptacion/regresion, no como notas opcionales.

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
- Esto ya debe tratarse como gap de recoleccion/canonicalizacion, no como detalle menor.

## BUG-EV2-002: Lock `113464` Aparece En `depositManaged` Pero No Tiene Origen En Wallet History

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

Pero en el wallet-centric Moralis history local no aparece el mint/transfer/create lifecycle de `tokenId=113464`.

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

### Hipotesis A Estudiar

1. El lock `113464` se creo en una tx que Moralis wallet history no incluye porque la wallet no fue `from/to` directo en la forma esperada.
2. El lock `113464` vino de una accion de increase/create que Aerodrome abstrajo y el provider no la conecto como tx wallet-centric.
3. El lock fue creado/transferido por un contrato/intermediario y solo aparece luego al hacer `depositManaged`.
4. El dataset local de seis paginas no incluye algun evento por paginacion/corte/provider mismatch.

### Por Que Es Bug

El Governance DataView debe explicar lifecycle de los locks. Si una tx usa un lock con owner wallet, el engine debe poder abrir un subproceso de backfill para reconstruirlo o dejar un bug de evidencia concreto, no solo decir "partial".

### Fix Esperado

Agregar enrichment:

```text
lock_identity_backfill(chainId, votingEscrowAddress, walletAddress, tokenId)
```

Estrategia DB/provider:

1. DB-first: buscar en `canonical_transaction_logs` cualquier `VotingEscrow.Transfer/Deposit/DepositManaged/Withdraw` con `tokenId=113464`.
2. Si no existe, usar cache Redis/provider.
3. Si falta, usar Alchemy `eth_getLogs` sobre `VotingEscrow` filtrando topics de `Transfer` y eventos de lock donde `tokenId` esta indexed.
4. Si el evento no tiene indexed tokenId suficiente, usar logs por rango de bloque alrededor de la primera aparicion y decodificar ABI.
5. Complementar con `eth_call` de estado actual si el contrato expone ownership/locked balance para tokenId.

### Persistencia Requerida

- `governance_locks`
- `governance_lock_events`
- `enrichment_needs` con type `lock_identity_backfill`
- `canonical_transaction_logs` para logs globales backfilled no necesariamente wallet-centric.

### Regression

Fixture debe probar:

```text
Given tx 0xc220cbbd...
When classifier sees depositManaged(113464,10298)
Then it creates/updates governance_locks tokenId=113464 with status partial_identity
And enqueues lock_identity_backfill
And records managedTokenId=10298
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

### Input Usuario/Research Necesario

Si el usuario puede recordar si eligio un relay especifico, ayuda para validar el label final. Pero no debe ser requisito para el engine: se debe resolver por onchain/contracts.

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

Fuentes posibles:

- ABI/RPC del bribe/fee distributor si expone pool/gauge/voter.
- Voter/gauge registry.
- Factory/gauge mappings.
- Event logs de creacion del distributor/gauge.
- Protocol registry persistido.

Si no hay evidencia explicita:

```text
poolId = null
coverage = partial_pool_unresolved
```

### Regression

Claim item con distributor desconocido debe:

- aparecer en Governance/Rewards;
- contar como governance reward si amount/token/source son claros;
- no contribuir a Pool totals hasta resolver pool.

## BUG-EV2-009: Provider Wallet History No Alcanza Para Todas Las Identidades

### Sintoma

`tokenId=113464` aparece por referencia, pero no aparece su origen en wallet history local.

### Conclusion

El engine no puede depender solo de address-centric history para reconstruir entidades referenciadas por tokenId.

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

## Cambios Documentales Realizados

Este documento complementa:

- `docs/informe-modelo-datos-engine-v2.md`
- `docs/plan-refactor-engine-procesador-transacciones.md`
- `docs/plan-refactor-engine-enrichment-accounting.md`

El spec de engine v2 debe incluir estos bugs como casos de aceptacion/regresion, no como notas opcionales.

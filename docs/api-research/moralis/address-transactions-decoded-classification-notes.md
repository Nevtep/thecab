# Moralis Decoded Transactions: Clasificacion Inicial De Las Primeras 100 Tx

Fecha: 2026-05-31

Wallet analizada:

```text
0x0eCD939b7fcA4dC4A0675d8D28BAd12cefaE0954
```

Endpoint probado:

```text
GET https://deep-index.moralis.io/api/v2.2/0x0eCD939b7fcA4dC4A0675d8D28BAd12cefaE0954/verbose?chain=base&order=ASC&include=internal_transactions
```

Archivos fuente:

- `docs/api-research/moralis/address-transactions-decoded-response.json`
- `docs/api-research/moralis/token-metadata-response.json`

## Conclusiones Del Sample

- El endpoint soporta `order=ASC`, por lo que puede traer paginas en orden historico.
- La respuesta trae `logs`, `decoded_event`, `internal_transactions`, `input`, `receipt_status`, `transaction_index`, `block_number` y `block_timestamp`, suficiente para iniciar un canonical tx store.
- Moralis no siempre trae `decoded_call`. En muchos contratos de interes el `decoded_call` viene `null` aunque el `input` esta disponible.
- Los eventos ERC20/Swap/Mint/Burn/Collect/Increase Liquidity vienen mayormente decodificados.
- Para clasificar bien Mellow/Aerodrome, el engine necesita ABIs propias/cached por contrato, no depender de `decoded_call`.
- Token metadata se puede cargar por batch y asociar por `tokenAddress`. Debe usarse para metadata/trust/category, no para pricing canonico historico.

## Token Metadata Observada

El batch de metadata probado incluye:

| Token | Address | Categoria | Trust |
|---|---|---|---|
| WETH | `0x4200000000000000000000000000000000000006` | `Wrapped-Tokens` | `possible_spam=false`, `verified_contract=true`, `security_score=98` |
| USDC | `0x833589fcd6edb6e08f4c7c32d4f71b54bda02913` | `Stablecoins` | `possible_spam=false`, `verified_contract=true`, `security_score=100` |

Regla recomendada:

- Guardar metadata por `(chainId, tokenAddress)`.
- Usar `categories` para interpretar wrappers, stables y risk/trust.
- Usar Alchemy historical prices para valuacion en `block_timestamp`, no Moralis metadata/prices.

## Logica De Clasificacion Propuesta

### 1. Failed Transaction Guard

Si `receipt_status != "1"` o cualquier `internal_transactions[].error` indica revert:

```text
classification = failed_transaction
```

No materializa deposits/rewards/cash flows. Se puede decodificar input luego para Activity/intento fallido.

Ejemplo:

- Tx 4 y 22/23: `internal_transactions.error = "execution reverted"`.

### 2. Native ETH Transfer / Cash-In

Si:

- `to_address == wallet`
- `value > 0`
- `input == "0x"`
- no hay logs relevantes
- internal transaction es simple CALL sin error

Entonces:

```text
classification = cash_in_native
token = ETH
amount = value
valuation = Alchemy historical ETH price at block_timestamp
```

Ejemplos:

- Tx 1, 2, 17, 18, 19.

### 3. ERC20 Approval

Si hay `Approval(address owner,address spender,uint256 amount)` y `owner == wallet`:

```text
classification = token_approval
token = log.address
spender = decoded_event.params.spender
amount = decoded_event.params.amount
```

Si el spender esta en protocol registry:

- spender = router -> `approval_router`
- spender = Mellow wrapper -> `approval_strategy_wrapper`
- spender = VotingEscrow/veAERO -> `approval_governance_lock`

Observacion: Moralis `decoded_call` para `approve` a veces solo muestra label `spender` sin params utiles. El log decodificado es la fuente mas confiable.

### 4. Swap

Si:

- tx exitosa;
- hay `Swap(...)` decoded_event desde pool;
- hay transfer out de wallet y transfer in a wallet;
- `to_address` es router/swap router/protocol router;

Entonces:

```text
classification = swap
surface = router + pool
inputToken = transfer from wallet
outputToken = transfer to wallet
pool = Swap event address
```

El evento sin decode `0xaa2dd386...` aparece en routers `0x01d400...` y `0x6df1...`. No hace falta para clasificar el swap si Transfer + Swap ya alcanzan, pero hay que resolverlo con ABI del router para evidence completa.

### 5. Mellow Strategy Deposit

Patron observado:

- `from_address == wallet`
- `to_address` es wrapper/strategy contract (`0xcd975...`, `0x55f54...`, `0xb9db...`, `0x0df5...`)
- selector `0xfed9fbb0`
- transfers de underlyings desde wallet al wrapper;
- eventos Aerodrome internos: `Burn`, `Collect`, `Mint`, `Increase Liquidity`;
- wrapper emite share ERC20 a la wallet (`Transfer` desde zero hacia wallet en address del wrapper).

Entonces:

```text
classification = strategy_deposit
strategy = wrapper address
underlyings = wallet outbound transfers
sharesMinted = wrapper Transfer zero -> wallet
positionEvidence = Mint/IncreaseLiquidity/Burn/Collect logs
```

Esto NO debe crear manual Aerodrome deposit. Debe crear/actualizar `StrategyExposure`.

### 6. Mellow Strategy Reward Claim / Harvest

Patron observado:

- `from_address == wallet`
- `to_address` es wrapper/strategy contract;
- selector `0x79ee54f7`;
- AERO transfer desde gauge/internal contract hacia wrapper y/o wallet;
- wrapper transfiere AERO a wallet en varios casos.

El ABI verificado de BaseScan confirma:

```text
classification = strategy_reward_claim
rewardToken = AERO
owner = StrategyExposure
evidence = LpWrapper.getRewards(address) + token transfers
```

La accion puede tener confianza alta. La valuacion y atribucion contable quedan separadas: requieren token transfers completos, metadata de token, precio historico y link explicito al `StrategyExposure`.

### 7. Governance Lock / veAERO

Patron observado:

- AERO approval a contrato governance.
- Tx posterior transfiere AERO desde wallet hacia contrato.
- Hay `Transfer` desde zero hacia wallet en el contrato governance/veNFT.
- Hay evento `Supply(uint256,uint256)`.

El ABI verificado de `VotingEscrow` confirma `createLock(uint256,uint256)` para lock creation:

```text
classification = governance_lock_created_or_increased
surface = voting_escrow
token = AERO
```

La distincion create/increase/extend/relock debe salir del selector exacto y de eventos `Deposit`/`Supply`, no de heuristica por transfer.

### 8. Aerodrome Voter `0x16613524...`

El contrato `0x16613524e02ad97edfef371bc883f2f5d6c480a5` esta verificado en BaseScan como `Voter` de Aerodrome. El ABI resuelve los selectors observados:

- `0x7ac09bf7` -> `vote(uint256,address[],uint256[])`
- `0x32145f90` -> `poke(uint256)`
- `0x7715ee75` -> `claimBribes(address[],address[][],uint256)`
- `0xe0c11f9a` -> `depositManaged(uint256,uint256)`

Entonces:

```text
vote => governance_vote
poke => governance_poke
claimBribes => governance_bribe_claim
depositManaged => governance_deposit_managed
```

Los `Deposit` / `Withdraw` logs de otros contratos durante `vote` y `poke` representan staking/unstaking o accounting interno de gauges/bribes provocado por el `Voter`; no deben convertirse en depositos de usuario ni en cash-in/cash-out. Para detalle por pool se usan los args `_poolVote` y `_weights`, mas eventos `Voted`/`Abstained`.

## Solucion Para Decodificar Inputs

El engine debe decodificar inputs en este orden:

1. **Known ABI registry interno**
   - ERC20, ERC721.
   - Aerodrome Router, Pool, CL Pool, Gauge, VotingEscrow, Voter, Briber, FeeDistributor, RewardDistributor, PositionManager.
   - Mellow wrappers/staking rewards.

2. **Verified ABI cache**
   - DB-first por `(chainId, contractAddress, bytecodeHash)`.
   - Fetch una vez desde BaseScan/Sourcify/Moralis contract metadata si falta.
   - Persistir ABI y selectors.

3. **Selector registry como pista, no autoridad**
   - 4byte/open signature DB solo para sugerir label.
   - No usar como clasificacion final si no hay contrato/protocol evidence.

4. **Manual protocol adapters**
   - Para wrappers/protocols conocidos con ABI incompleta, declarar selector -> parser versionado en el engine.

Implementacion conceptual:

```text
decodeFunctionData({ abi, data: tx.input })
decodeEventLog({ abi, topics, data })
```

La clasificacion final debe guardar:

- selector;
- decoded function;
- ABI source;
- decode confidence;
- reason codes;
- raw fallback cuando no decodea.

## Clasificacion De Las Primeras 100 Tx

| # | Tx | Clasificacion propuesta | Confianza | Evidencia / notas |
|---:|---|---|---|---|
| 1 | `0x8e3d183e...` | `cash_in_native` | Alta | ETH hacia wallet, `value > 0`, sin logs. |
| 2 | `0xef6aeceb...` | `cash_in_native` | Alta | ETH hacia wallet, `value > 0`, sin logs. |
| 3 | `0xf6e11d5c...` | `approval_router` | Alta | USDC Approval wallet -> `0x01d400...`, amount `7500000000`. |
| 4 | `0xf943b6f3...` | `failed_transaction` | Alta | Internal error `execution reverted`, sin logs. Intento contra `0x01d400...`. |
| 5 | `0x9ee36d6f...` | `swap` | Alta | USDC sale de wallet, WETH entra a wallet, `Swap` en pool `0xdbc699...`; evento router `0xaa2dd...` sin decode. |
| 6 | `0x97eb722d...` | `approval_strategy_wrapper` | Alta | USDC Approval a Mellow wrapper `0xcd975...`. |
| 7 | `0x9b5e7856...` | `approval_strategy_wrapper` | Alta | WETH Approval a Mellow wrapper `0xcd975...`. |
| 8 | `0x1ef7fcdb...` | `approval_strategy_wrapper` | Alta | WETH Approval a Mellow wrapper `0xcd975...`. |
| 9 | `0x25353bfc...` | `approval_strategy_wrapper` | Alta | WETH Approval a Mellow wrapper `0xcd975...`. |
| 10 | `0x3e57a8c2...` | `approval_aerodrome_router` | Alta | WETH Approval a Aerodrome router `0xcF77...`. |
| 11 | `0xca8e9a62...` | `strategy_deposit` | Alta accion / media contable | Wrapper `0xcd975...`, ABI resuelve `LpWrapper.mint((uint256,uint256,uint256,address,uint256))`, WETH/USDC out, Mint/IncreaseLiquidity, share mint to wallet. |
| 12 | `0x5c598864...` | `approval_router` | Alta | WETH Approval a `0x01d400...`. |
| 13 | `0xcaac84e1...` | `swap` | Alta | Router `0x01d400...`, `Swap` + Transfer logs. |
| 14 | `0x88479729...` | `approval_strategy_wrapper` | Alta | WETH Approval a `0xcd975...`. |
| 15 | `0x08c5f36b...` | `approval_strategy_wrapper` | Alta | USDC Approval a `0xcd975...`. |
| 16 | `0xa3077ce9...` | `strategy_deposit` | Alta accion / media contable | Wrapper `0xcd975...`, ABI resuelve `LpWrapper.mint((uint256,uint256,uint256,address,uint256))`, Mint/IncreaseLiquidity, share mint. |
| 17 | `0x69fc9f96...` | `cash_in_native` | Alta | ETH hacia wallet. |
| 18 | `0x38e58c25...` | `cash_in_native` | Alta | ETH hacia wallet. |
| 19 | `0xe865db78...` | `cash_in_native` | Alta | ETH hacia wallet. |
| 20 | `0x9467afd8...` | `approval_strategy_wrapper` | Alta | USDC Approval a `0x0df5...`. |
| 21 | `0xa27a0c53...` | `approval_strategy_wrapper` | Alta | cbBTC Approval a `0x0df5...`. |
| 22 | `0xfd6064c4...` | `failed_transaction` | Alta | Internal error `execution reverted`, target `0x0df5...`. |
| 23 | `0xd0531d0f...` | `failed_transaction` | Alta | Internal error `execution reverted`, target `0x0df5...`. |
| 24 | `0x52d83cab...` | `approval_strategy_wrapper` | Alta | WETH Approval a `0xb9db...`. |
| 25 | `0x273886e1...` | `approval_strategy_wrapper` | Alta | cbBTC Approval a `0xb9db...`. |
| 26 | `0x9fd04915...` | `approval_strategy_wrapper` | Alta | cbBTC Approval a `0xb9db...`. |
| 27 | `0x3665bad7...` | `approval_strategy_wrapper` | Alta | EURC Approval a `0x55f54...`. |
| 28 | `0x27573e3f...` | `approval_strategy_wrapper` | Alta | USDC Approval a `0x55f54...`. |
| 29 | `0x0ae194b5...` | `strategy_deposit` | Alta accion / media contable | Wrapper `0x55f54...`, ABI resuelve `LpWrapper.mint((uint256,uint256,uint256,address,uint256))`, 55 logs, Mint/IncreaseLiquidity. |
| 30 | `0xcb5ea774...` | `strategy_deposit` | Alta accion / media contable | Wrapper `0xb9db...`, ABI resuelve `LpWrapper.mint((uint256,uint256,uint256,address,uint256))`; requiere valuacion posterior para accounting. |
| 31 | `0x4254bfea...` | `approval_strategy_wrapper` | Alta | USDC Approval a `0x0df5...`. |
| 32 | `0x1ebcbb22...` | `strategy_deposit` | Alta accion / media contable | Wrapper `0x0df5...`, ABI resuelve `LpWrapper.mint((uint256,uint256,uint256,address,uint256))`; requiere valuacion posterior para accounting. |
| 33 | `0xe2db2fd3...` | `strategy_reward_claim` | Alta accion | Wrapper `0xcd975...`, ABI resuelve `LpWrapper.getRewards(address)`, AERO transfer to wallet. |
| 34 | `0xf8669ccb...` | `strategy_reward_claim` | Alta accion | Wrapper `0xcd975...`, ABI resuelve `LpWrapper.getRewards(address)`, Transfer + wrapper event. |
| 35 | `0xdc502301...` | `strategy_reward_claim` | Alta accion | Wrapper `0x0df5...`, ABI resuelve `LpWrapper.getRewards(address)`. |
| 36 | `0xda11fa18...` | `strategy_reward_claim` | Alta accion | Wrapper `0xb9db...`, ABI resuelve `LpWrapper.getRewards(address)`. |
| 37 | `0x46f63be7...` | `strategy_reward_claim` | Alta accion | Wrapper `0x55f54...`, ABI resuelve `LpWrapper.getRewards(address)`. |
| 38 | `0x035391c1...` | `strategy_reward_claim` | Alta accion | Wrapper `0xb9db...`, ABI resuelve `LpWrapper.getRewards(address)`, Transfer events. |
| 39 | `0x1e3105c8...` | `strategy_reward_claim` | Alta accion | Wrapper `0xcd975...`, ABI resuelve `LpWrapper.getRewards(address)`, Transfer event. |
| 40 | `0x2db41ef9...` | `strategy_reward_claim` | Alta accion | Wrapper `0x0df5...`, ABI resuelve `LpWrapper.getRewards(address)`. |
| 41 | `0xf8b05758...` | `strategy_reward_claim` | Alta accion | Wrapper `0x55f54...`, ABI resuelve `LpWrapper.getRewards(address)`. |
| 42 | `0x2bd87cc8...` | `strategy_reward_claim` | Alta accion | Wrapper `0x55f54...`, ABI resuelve `LpWrapper.getRewards(address)`. |
| 43 | `0x535cacfe...` | `strategy_reward_claim` | Alta accion | Wrapper `0xcd975...`, ABI resuelve `LpWrapper.getRewards(address)`. |
| 44 | `0x35a4b016...` | `strategy_reward_claim` | Alta accion | Wrapper `0x0df5...`, ABI resuelve `LpWrapper.getRewards(address)`. |
| 45 | `0xf927889f...` | `strategy_reward_claim` | Alta accion | Wrapper `0xb9db...`, ABI resuelve `LpWrapper.getRewards(address)`. |
| 46 | `0x9cadeb75...` | `approval_governance_lock` | Alta | AERO Approval a `VotingEscrow` `0xebf418...`. |
| 47 | `0xe1132344...` | `governance_lock_created` | Alta accion | `VotingEscrow.createLock(uint256,uint256)`, AERO transfer wallet -> escrow, `Deposit`, `Supply`, ERC721 transfer from zero to wallet. |
| 48 | `0xa6fcbc9d...` | `governance_vote` | Alta | `Voter.vote(tokenId=110971, pools=[0xb2cc...,0x70ac...,0x4e96...], weights=[33.003e18,33.997e18,33.000e18])`; emitted `Voted` events. |
| 49 | `0x7d72704b...` | `governance_vote` | Alta | `Voter.vote(tokenId=110971, pools=[0xb2cc...,0x70ac...,0x4e96...], weights=[33.252...,34.253...,33.249...])`; includes prior `Abstained`/withdraw then new `Voted` deposits. |
| 50 | `0x17198d3f...` | `governance_rebase_claim` | Alta accion | `RewardsDistributor.claim(uint256)`, AERO transfer to `VotingEscrow`, `Deposit`/`Supply`; classify as governance rebase/lock balance effect, not regular reward cash-in. |
| 51 | `0x8aa467e2...` | `governance_vote` | Alta | `Voter.vote(tokenId=110971, pools=[0xb2cc...,0x70ac...,0x4e96...], weights=[33.485...,34.494...,33.482...])`; includes prior abstain/withdraw and new voted deposits. |
| 52 | `0x46b3a89a...` | `strategy_reward_claim` | Alta accion | Wrapper `0x55f54...`, ABI resuelve `LpWrapper.getRewards(address)`. |
| 53 | `0xfebf87d2...` | `strategy_reward_claim` | Alta accion | Wrapper `0xb9db...`, ABI resuelve `LpWrapper.getRewards(address)`. |
| 54 | `0x58490d8b...` | `governance_bribe_claim` | Alta accion / media detalle | `Voter.claimBribes(address[],address[][],uint256)`; many inbound tokens to wallet. Requires bribe/reward contract ABI for per-source breakdown, but action is confirmed. |
| 55 | `0x71ea8c3a...` | `strategy_reward_claim` | Alta accion | Wrapper `0x0df5...`, ABI resuelve `LpWrapper.getRewards(address)`. |
| 56 | `0xac6bb0e2...` | `strategy_reward_claim` | Alta accion | Wrapper `0xcd975...`, ABI resuelve `LpWrapper.getRewards(address)`. |
| 57 | `0x29d25c14...` | `approval_router` | Alta | AERO Approval a `0x6df1...`. |
| 58 | `0x3069550f...` | `swap` | Alta | Router `0x6df1...`, Swap + Approval reset + Transfer logs. |
| 59 | `0x1c699962...` | `approval_strategy_wrapper` | Alta | cbBTC Approval a `0xb9db...`. |
| 60 | `0x8435c828...` | `approval_strategy_wrapper` | Alta | WETH Approval a `0xb9db...`. |
| 61 | `0xda316d85...` | `approval_strategy_wrapper` | Alta | WETH Approval a `0xb9db...`. |
| 62 | `0x8442cbca...` | `approval_strategy_wrapper` | Alta | WETH Approval a `0xb9db...`. |
| 63 | `0xb08e60fe...` | `approval_strategy_wrapper` | Alta | cbBTC Approval a `0xb9db...`. |
| 64 | `0xa2545d77...` | `approval_strategy_wrapper` | Alta | WETH Approval a `0xb9db...`. |
| 65 | `0xbe26bd15...` | `approval_router` | Alta | AERO Approval a `0x6df1...`. |
| 66 | `0x6805a1bc...` | `swap` | Alta | Router `0x6df1...`, `Swap`, `Fees`, `Sync`, Transfer logs. |
| 67 | `0x88f2f3d1...` | `approval_strategy_wrapper` | Alta | cbBTC Approval a `0x0df5...`. |
| 68 | `0xfeef9a15...` | `approval_strategy_wrapper` | Alta | USDC Approval a `0x0df5...`. |
| 69 | `0x87cc39d3...` | `strategy_deposit` | Alta accion / media contable | Wrapper `0x0df5...`, ABI resuelve `LpWrapper.mint((uint256,uint256,uint256,address,uint256))`; requiere valuacion posterior para accounting. |
| 70 | `0x1e84e1b1...` | `approval_strategy_wrapper` | Alta | cbBTC Approval a `0xb9db...`. |
| 71 | `0x55d090ab...` | `approval_strategy_wrapper` | Alta | WETH Approval a `0xb9db...`. |
| 72 | `0xfa8cf0e9...` | `strategy_deposit` | Alta accion / media contable | Wrapper `0xb9db...`, ABI resuelve `LpWrapper.mint((uint256,uint256,uint256,address,uint256))`; requiere valuacion posterior para accounting. |
| 73 | `0x86c4cbbd...` | `approval_strategy_wrapper` | Alta | USDC Approval a `0xcd975...`. |
| 74 | `0x3f45c60d...` | `approval_strategy_wrapper` | Alta | WETH Approval a `0xcd975...`. |
| 75 | `0x803a174a...` | `strategy_deposit` | Alta accion / media contable | Wrapper `0xcd975...`, ABI resuelve `LpWrapper.mint((uint256,uint256,uint256,address,uint256))`; requiere valuacion posterior para accounting. |
| 76 | `0xc2a30b60...` | `approval_strategy_wrapper` | Alta | WETH Approval a `0xb9db...`. |
| 77 | `0x34f52929...` | `strategy_deposit` | Alta accion / media contable | Wrapper `0xb9db...`, ABI resuelve `LpWrapper.mint((uint256,uint256,uint256,address,uint256))`; requiere valuacion posterior para accounting. |
| 78 | `0xbfbc7b8c...` | `approval_router` | Alta | AERO Approval a `0x6df1...`. |
| 79 | `0x9040cd73...` | `swap` | Alta | Router `0x6df1...`, `Swap`, `Fees`, `Sync`, Transfer logs. |
| 80 | `0xb1464213...` | `cash_out_token_transfer` | Alta | USDC `transfer(address,uint256)` from wallet to external `0xb20c...`. |
| 81 | `0xc220cbbd...` | `governance_deposit_managed` | Alta accion / media semantica | `Voter.depositManaged(tokenId=113464, mTokenId=10298)`. Moves an owner lock into a managed veNFT/managed voting context; requires Aerodrome managed-lock semantics for product explanation and effect valuation. |
| 82 | `0x0190dd5e...` | `governance_vote` | Alta | `Voter.vote(tokenId=110971, pools=[0xb2cc...,0x70ac...,0x4e96...], weights=[33.098...,34.095...,33.095...])`; emitted abstain/withdraw and voted/deposit logs. |
| 83 | `0x50d02e75...` | `governance_poke` | Alta | `Voter.poke(tokenId=110971)`. Refreshes/reapplies current vote weights; should not be treated as a new user-selected vote allocation unless product marks it as poke/refresh. |
| 84 | `0xdad3c265...` | `approval_router` | Alta | USDC Approval a `0x6df1...`. |
| 85 | `0xacde3263...` | `swap` | Alta | Router `0x6df1...`, Swap + Transfer logs. |
| 86 | `0x979c124d...` | `approval_router` | Alta | USDC Approval a `0x6df1...`. |
| 87 | `0x8c804f30...` | `swap` | Alta | Router `0x6df1...`, Swap + Transfer logs. |
| 88 | `0x738437aa...` | `approval_router` | Alta | USDC Approval a `0x6df1...`. |
| 89 | `0x7cad560b...` | `swap` | Alta | Router `0x6df1...`, Swap + Transfer logs. |
| 90 | `0xa8f1360a...` | `approval_router` | Alta | USDC Approval a `0x6df1...`. |
| 91 | `0x2e86de53...` | `swap` | Alta | Router `0x6df1...`, Swap + Transfer logs. |
| 92 | `0xab5b791d...` | `approval_strategy_wrapper` | Alta | USDC Approval a `0x0df5...`. |
| 93 | `0xf8e28080...` | `approval_strategy_wrapper` | Alta | cbBTC Approval a `0x0df5...`. |
| 94 | `0x4bb8bf02...` | `strategy_deposit` | Alta accion / media contable | Wrapper `0x0df5...`, ABI resuelve `LpWrapper.mint((uint256,uint256,uint256,address,uint256))`; requiere valuacion posterior para accounting. |
| 95 | `0x05e80a04...` | `approval_strategy_wrapper` | Alta | USDC Approval a `0xcd975...`. |
| 96 | `0x52329124...` | `approval_strategy_wrapper` | Alta | WETH Approval a `0xcd975...`. |
| 97 | `0x9ac0d554...` | `approval_strategy_wrapper` | Alta | WETH Approval a `0xb9db...`. |
| 98 | `0x443bc9c4...` | `approval_strategy_wrapper` | Alta | cbBTC Approval a `0xb9db...`. |
| 99 | `0x9614fe02...` | `approval_strategy_wrapper` | Alta | cbBTC Approval a `0xb9db...`. |
| 100 | `0xceb533b5...` | `approval_strategy_wrapper` | Alta | WETH Approval a `0xcd975...`. |

## Validacion Con ABI Registry

Se genero un registry local verificable en `docs/api-research/abis/protocol-abi-registry.json` usando BaseScan `contract/getsourcecode` sobre Base `chainId=8453`.

Fuentes usadas:

- Aerodrome publica sus contratos de Base Mainnet en el repo oficial `aerodrome-finance/contracts` y lista `RewardsDistributor`, `Router`, `AERO`, `Voter` y `VotingEscrow`.
- Mellow publica el repo `mellow-finance/mellow-alm-toolkit` y documenta `LpWrapper` como wrapper tokenizado de una posicion administrada. Los wrappers vistos en la wallet estan verificados en BaseScan como `LpWrapper`.
- Mellow documenta direcciones de Aerodrome CL strategies y componentes Core/DeployFactory/WrapperAdmin; las direcciones concretas de esta wallet se validaron por ABI verificada de BaseScan porque no todas aparecen en la pagina publica de estrategias.

Tambien se genero `docs/api-research/abis/selector-matches-address-transactions-decoded.md`, que matchea todos los function selectors vistos contra ABIs verificadas.

## Topicos / Selectors Resueltos Por ABI

### Selectors

| Selector | Contratos vistos | Hipotesis | Estado |
|---|---|---|---|
| `0xfed9fbb0` | Mellow wrappers `0xcd975...`, `0x55f54...`, `0xb9db...`, `0x0df5...` | strategy deposit / provide liquidity through wrapper | Resuelto: `LpWrapper.mint((uint256,uint256,uint256,address,uint256))` |
| `0x79ee54f7` | Mellow wrappers | reward claim / harvest | Resuelto: `LpWrapper.getRewards(address)` |
| `0x7ac09bf7` | Aerodrome `Voter` `0x166135...` | vote | Resuelto: `Voter.vote(uint256,address[],uint256[])` |
| `0x32145f90` | Aerodrome `Voter` `0x166135...` | refresh vote state | Resuelto: `Voter.poke(uint256)` |
| `0x7715ee75` | Aerodrome `Voter` `0x166135...` | bribe claim | Resuelto: `Voter.claimBribes(address[],address[][],uint256)` |
| `0xe0c11f9a` | Aerodrome `Voter` / `VotingEscrow` | managed lock deposit | Resuelto: `depositManaged(uint256,uint256)` |
| `0x3593564c` | router `0x6df1...` | router execute with deadline | Resuelto: `UniversalRouter.execute(bytes,bytes[],uint256)` |
| `0x24856bc3` | router `0x01d400...` | router execute | Resuelto: `UniversalRouter.execute(bytes,bytes[])` |
| `0xb52c05fe` | `VotingEscrow` | governance lock create | Resuelto: `VotingEscrow.createLock(uint256,uint256)` |
| `0x379607f5` | `RewardsDistributor` | rebase claim | Resuelto: `RewardsDistributor.claim(uint256)` |

### Event Topics

| Topic | Donde aparece | Hipotesis / accion |
|---|---|---|
| `0xaa2dd386...` | Routers `0x01d400...`, `0x6df1...` | Resuelto: `UniversalRouterSwap(address,address)`. |
| `0xee58b7a4...` | Mellow wrappers | Resuelto: `LpWrapper.Deposit(address,address,address,uint256,uint256,uint256,uint256)`. |
| `0x452d440e...` | Aerodrome `Voter` | Resuelto: `Voter.Voted(address,address,uint256,uint256,uint256,uint256)`. |
| `0xadab6309...` | Aerodrome `Voter` | Resuelto: `Voter.Abstained(address,address,uint256,uint256,uint256,uint256)`. |
| `0xcae2990a...` | `RewardsDistributor` | Resuelto: `RewardsDistributor.Claimed(uint256,uint256,uint256,uint256)`. |
| `0x8835c22a...` | `VotingEscrow` | Resuelto: `VotingEscrow.Deposit(address,uint256,uint8,uint256,uint256,uint256)`. |
| `0x5e2aa66e...` | `VotingEscrow` | Resuelto: `VotingEscrow.Supply(uint256,uint256)`. |
| `0xf7757ce3...` | `VotingEscrow` | Resuelto: `VotingEscrow.DepositManaged(address,uint256,uint256,uint256,uint256)`. |
| `0x1f89f963...` | Mellow wrappers / internal strategy contracts | Pendiente: no esta en los ABIs descargados; probablemente evento de modulo/core interno emitido por otro contrato del flow. |
| `0x9aa05b3d...` | Aerodrome claim/bribe path | Pendiente: no matchea con ABIs cargadas; requiere agregar ABI del voting reward/bribe contract especifico emitente. |

## Clasificacion Que NO Debe Hacerse Todavia

- No convertir logs internos `Deposit` / `Withdraw` emitidos durante `Voter.vote`, `Voter.poke` o `Voter.depositManaged` en depositos de usuario. Son efectos internos del protocolo.
- No atribuir los transfers AERO de `LpWrapper.getRewards(address)` a depositos manuales. Son strategy wrapper claims y deben resolver contra `StrategyExposure`.
- No tomar Moralis `decoded_call.label` como autoridad cuando viene incompleto (`spender`, `to`, null).
- No usar Wallet History summary para resolver owners o rewards.
- No sumar events/topics sin ABI emitente a totals con confianza alta. Mantenerlos como evidencia secundaria o unresolved hasta agregar el contrato correspondiente.
- No tratar `RewardsDistributor.claim(uint256)` como reward cash-in liquido: aumenta/reclama rebase hacia el lock/escrow y su efecto pertenece a governance lock exposure.

## Politica De Confianza Para Claims

Con los ABIs actuales se pueden convertir varios `*_candidate` en claims con confianza alta de **accion**:

- `LpWrapper.getRewards(address)` -> `strategy_reward_claim`.
- `Voter.claimBribes(address[],address[][],uint256)` -> `governance_bribe_claim`.
- `RewardsDistributor.claim(uint256)` -> `governance_rebase_claim`.

Pero la confianza alta de accion no implica automaticamente confianza alta de **valuacion/atribucion**:

- Para `strategy_reward_claim`, el owner es `StrategyExposure` si el `to_address` es wrapper registrado y los reward transfers salen de la ejecucion del wrapper.
- Para `governance_bribe_claim`, el evento es governance reward claim confirmado, pero el desglose por bribe contract/pool/token requiere decodificar args y/o agregar ABI del voting reward/bribe contract emitente.
- Para `governance_rebase_claim`, el valor no debe entrar como recompensa liquida si el efecto es AERO depositado/rebasado en `VotingEscrow`.

## Proximo Paso De Analisis

1. Agregar al registry los contratos emitentes de los topics todavia sin match, especialmente voting rewards/bribes y modulos internos de Mellow.
2. Definir `TransactionEvidence` y `DomainEvent` desde firmas ABI, logs y token movements, no desde labels de Moralis.
3. Mantener como `unresolved` cualquier evento/log cuyo ABI emitente no este en registry.
4. Modelar `depositManaged` con la semantica oficial de Aerodrome managed locks antes de convertirlo en metrica de exposicion.

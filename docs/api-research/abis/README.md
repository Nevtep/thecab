# Protocol ABI Registry Research

Generated at: 2026-06-01T00:26:10.984Z

This registry is a research artifact for the historical transaction-classification engine. It keeps the classifier grounded in verified deployed contracts instead of undocumented selector guesses.

## Source Anchors

- Aerodrome official repository: `https://github.com/aerodrome-finance/contracts`
- Mellow official organization: `https://github.com/mellow-finance`
- Mellow ALM source repository: `https://github.com/mellow-finance/mellow-alm-toolkit`
- Deployed ABI authority: BaseScan verified source/ABI for the exact Base address seen in transaction history.

## Update Method

Run:

```sh
pnpm --dir ./apps/web exec tsx ../../scripts/research/fetch-protocol-abis.ts
```

The script reads `BASESCAN_API_KEY` from `apps/web/.env.local`, calls Etherscan v2 `contract/getsourcecode` for Base `chainid=8453`, and writes one JSON artifact per tracked Base contract under `docs/api-research/abis/base-8453/`.

For engine usage, the same ABI fetcher can be backed by a DB implementation of `AbiRegistryRepository`: read ABI by `(chainId,address)`, fetch from explorer only on cache miss, then persist the returned `ContractAbiRecord`.

## Registry Entries

| Protocol | Label | Address | Contract name | ABI status | Proxy |
| --- | --- | --- | --- | --- | --- |
| aerodrome | AERO | `0x940181a94a35a4569e4529a3cdfb74e38fd98631` | Aero | verified ABI | direct |
| aerodrome | Router | `0xcf77a3ba9a5ca399b7c97c74d54e5b1beb874e43` | Router | verified ABI | direct |
| aerodrome | Voter | `0x16613524e02ad97edfef371bc883f2f5d6c480a5` | Voter | verified ABI | direct |
| aerodrome | VotingEscrow | `0xebf418fe2512e7e6bd9b87a8f0f294acdc67e6b4` | VotingEscrow | verified ABI | direct |
| aerodrome | RewardsDistributor | `0x227f65131a261548b057215bb1d5ab2997964c7d` | RewardsDistributor | verified ABI | direct |
| aerodrome | LpSugar | `0x69dd9db6d8f8e7d83887a704f447b1a584b599a1` | LpSugar | verified ABI | direct |
| aerodrome | Aerodrome Slipstream Router | `0x01d40099fcd87c018969b0e8d4ab1633fb34763c` | UniversalRouter | verified ABI | direct |
| aerodrome | Aerodrome Router Candidate | `0x6df1c91424f79e40e33b1a48f0687b666be71075` | UniversalRouter | verified ABI | direct |
| mellow | Mellow WETH-USDC Strategy Wrapper | `0xcd975e6a5f55137755487f0918b8ca74acce7925` | LpWrapper | verified ABI | direct |
| mellow | Mellow Strategy Wrapper | `0x55f54b1f63125fce3c90f30856ce9d928ff47c26` | LpWrapper | verified ABI | direct |
| mellow | Mellow Strategy Wrapper | `0xb9db6804e84d960e139a2bdc33bfc30f8fb689fe` | LpWrapper | verified ABI | direct |
| mellow | Mellow Strategy Wrapper | `0x0df5f2662e4a8c801c04d83df717476509816250` | LpWrapper | verified ABI | direct |
| aerodrome | Slipstream Nonfungible Position Manager | `0x827922686190790b37229fd06084350e74485b72` | NonfungiblePositionManager | verified ABI | proxy -> 0x827922686190790b37229fd06084350e74485b72 |
| aerodrome | Observed Router | `0xc5b6786d7b64767d775877b0b6a319ad946b11b5` | UniversalRouter | verified ABI | direct |
| aerodrome | Observed Router | `0xcaf22ce31298cf2bf1d152862f80216478ad7c67` | UniversalRouter | verified ABI | direct |
| aerodrome | Observed CLGauge | `0x6399ed6725cc163d019aa64ff55b22149d7179a8` | CLGauge | verified ABI | direct |
| aerodrome | Observed CLGauge | `0x41b2126661c673c2bedd208cc72e85dc51a5320a` | CLGauge | verified ABI | direct |
| aerodrome | Observed CLGauge | `0xf33a96b5932d9e9b9a0eda447abd8c9d48d2e0c8` | CLGauge | verified ABI | direct |
| aerodrome | Observed Gauge | `0x519bbd1dd8c6a94c46080e24f316c14ee758c025` | Gauge | verified ABI | direct |
| aerodrome | Observed Pool | `0xcdac0d6c6c59727a65f871236188350531885c43` | Pool | verified ABI | direct |
| mellow | Observed Mellow Strategy Wrapper | `0x765cca7f70e6f02619a6b0a339b01845d1a5fd72` | LpWrapper | verified ABI | direct |

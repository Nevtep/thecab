# ABI Selector Matches For Moralis Decoded Sample

Generated at: 2026-06-01T00:25:47.136Z

This file matches observed transaction input selectors and log topics from `docs/api-research/moralis/address-transactions-decoded-response.json` against the verified ABI registry under `docs/api-research/abis/base-8453/`.

## Function Selectors

| Selector | Tx indexes | Verified ABI matches |
| --- | --- | --- |
| `0x095ea7b3` | 3, 6, 7, 8, 9, 10, 12, 14, 15, 20, 21, 24, 25, 26, 27, 28, 31, 46, 57, 59, 60, 61, 62, 63, 64, 65, 67, 68, 70, 71, 73, 74, 76, 78, 84, 86, 88, 90, 92, 93, 95, 96, 97, 98, 99, 100 | AERO: `approve(address,uint256)`<br>VotingEscrow: `approve(address,uint256)`<br>Mellow WETH-USDC Strategy Wrapper: `approve(address,uint256)`<br>Mellow Strategy Wrapper: `approve(address,uint256)`<br>Mellow Strategy Wrapper: `approve(address,uint256)`<br>Mellow Strategy Wrapper: `approve(address,uint256)`<br>Slipstream Nonfungible Position Manager: `approve(address,uint256)`<br>Observed Pool: `approve(address,uint256)`<br>Observed Mellow Strategy Wrapper: `approve(address,uint256)` |
| `0x24856bc3` | 4, 5, 13 | Aerodrome Slipstream Router: `execute(bytes,bytes[])`<br>Aerodrome Router Candidate: `execute(bytes,bytes[])`<br>Observed Router: `execute(bytes,bytes[])`<br>Observed Router: `execute(bytes,bytes[])` |
| `0xfed9fbb0` | 11, 16, 22, 23, 29, 30, 32, 69, 72, 75, 77, 94 | Mellow WETH-USDC Strategy Wrapper: `mint((uint256,uint256,uint256,address,uint256))`<br>Mellow Strategy Wrapper: `mint((uint256,uint256,uint256,address,uint256))`<br>Mellow Strategy Wrapper: `mint((uint256,uint256,uint256,address,uint256))`<br>Mellow Strategy Wrapper: `mint((uint256,uint256,uint256,address,uint256))`<br>Observed Mellow Strategy Wrapper: `mint((uint256,uint256,uint256,address,uint256))` |
| `0x79ee54f7` | 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 52, 53, 55, 56 | Mellow WETH-USDC Strategy Wrapper: `getRewards(address)`<br>Mellow Strategy Wrapper: `getRewards(address)`<br>Mellow Strategy Wrapper: `getRewards(address)`<br>Mellow Strategy Wrapper: `getRewards(address)`<br>Observed Mellow Strategy Wrapper: `getRewards(address)` |
| `0xb52c05fe` | 47 | VotingEscrow: `createLock(uint256,uint256)` |
| `0x7ac09bf7` | 48, 49, 51, 82 | Voter: `vote(uint256,address[],uint256[])` |
| `0x379607f5` | 50 | RewardsDistributor: `claim(uint256)` |
| `0x7715ee75` | 54 | Voter: `claimBribes(address[],address[][],uint256)` |
| `0x3593564c` | 58, 66, 79, 85, 87, 89, 91 | Aerodrome Slipstream Router: `execute(bytes,bytes[],uint256)`<br>Aerodrome Router Candidate: `execute(bytes,bytes[],uint256)`<br>Observed Router: `execute(bytes,bytes[],uint256)`<br>Observed Router: `execute(bytes,bytes[],uint256)` |
| `0xa9059cbb` | 80 | AERO: `transfer(address,uint256)`<br>Mellow WETH-USDC Strategy Wrapper: `transfer(address,uint256)`<br>Mellow Strategy Wrapper: `transfer(address,uint256)`<br>Mellow Strategy Wrapper: `transfer(address,uint256)`<br>Mellow Strategy Wrapper: `transfer(address,uint256)`<br>Observed Pool: `transfer(address,uint256)`<br>Observed Mellow Strategy Wrapper: `transfer(address,uint256)` |
| `0xe0c11f9a` | 81 | Voter: `depositManaged(uint256,uint256)`<br>VotingEscrow: `depositManaged(uint256,uint256)` |
| `0x32145f90` | 83 | Voter: `poke(uint256)` |

## Event Topics

| Topic | Tx indexes | Verified ABI matches |
| --- | --- | --- |
| `0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925` | 3, 6, 7, 8, 9, 10, 11, 12, 14, 15, 16, 20, 21, 24, 25, 26, 27, 28, 29, 30, 31, 32, 46, 47, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 84, 86, 88, 90, 92, 93, 94, 95, 96, 97, 98, 99, 100 | AERO: `Approval(address,address,uint256)`<br>VotingEscrow: `Approval(address,address,uint256)`<br>Mellow WETH-USDC Strategy Wrapper: `Approval(address,address,uint256)`<br>Mellow Strategy Wrapper: `Approval(address,address,uint256)`<br>Mellow Strategy Wrapper: `Approval(address,address,uint256)`<br>Mellow Strategy Wrapper: `Approval(address,address,uint256)`<br>Slipstream Nonfungible Position Manager: `Approval(address,address,uint256)`<br>Observed Pool: `Approval(address,address,uint256)`<br>Observed Mellow Strategy Wrapper: `Approval(address,address,uint256)` |
| `0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef` | 5, 11, 13, 16, 29, 30, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 47, 50, 52, 53, 54, 55, 56, 58, 66, 69, 72, 75, 77, 79, 80, 85, 87, 89, 91, 94 | AERO: `Transfer(address,address,uint256)`<br>VotingEscrow: `Transfer(address,address,uint256)`<br>Mellow WETH-USDC Strategy Wrapper: `Transfer(address,address,uint256)`<br>Mellow Strategy Wrapper: `Transfer(address,address,uint256)`<br>Mellow Strategy Wrapper: `Transfer(address,address,uint256)`<br>Mellow Strategy Wrapper: `Transfer(address,address,uint256)`<br>Slipstream Nonfungible Position Manager: `Transfer(address,address,uint256)`<br>Observed Pool: `Transfer(address,address,uint256)`<br>Observed Mellow Strategy Wrapper: `Transfer(address,address,uint256)` |
| `0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67` | 5, 13, 58, 85, 87, 89, 91 | unmatched |
| `0xaa2dd386ed08047486db39ea1a9e5461b6a95c8bb3ca845cce27a537799a4672` | 5, 13, 58, 66, 79, 85, 87, 89, 91 | Aerodrome Slipstream Router: `UniversalRouterSwap(address,address)`<br>Aerodrome Router Candidate: `UniversalRouterSwap(address,address)`<br>Observed Router: `UniversalRouterSwap(address,address)`<br>Observed Router: `UniversalRouterSwap(address,address)` |
| `0x1f89f96333d3133000ee447473151fa9606543368f02271c9d95ae14f13bcc67` | 11, 16, 29, 30, 32, 33, 34, 35, 36, 37, 38, 40, 41, 42, 43, 44, 45, 52, 53, 55, 56, 69, 72, 75, 77, 94 | Observed CLGauge: `ClaimRewards(address,uint256)`<br>Observed CLGauge: `ClaimRewards(address,uint256)`<br>Observed CLGauge: `ClaimRewards(address,uint256)`<br>Observed Gauge: `ClaimRewards(address,uint256)` |
| `0x0c396cd989a39f4459b5fa1aed6a9a8dcdbc45908acfd67e028cd568da98982c` | 11, 16, 29, 30, 32, 69, 72, 75, 77, 94 | unmatched |
| `0x70935338e69775456a85ddef226c395fb668b63fa0115f5f20610b388e6ca9c0` | 11, 16, 29, 30, 32, 69, 72, 75, 77, 94 | unmatched |
| `0xf8e1a15aba9398e019f0b49df1a4fde98ee17ae345cb5f6b5e2c27f5033e8ce7` | 11, 16, 29, 30, 32, 50, 69, 72, 75, 77, 81, 94 | VotingEscrow: `MetadataUpdate(uint256)`<br>Slipstream Nonfungible Position Manager: `MetadataUpdate(uint256)` |
| `0x40d0efd1a53d60ecbf40971b9daf7dc90178c3aadc7aab1765632738fa8b8f01` | 11, 16, 29, 30, 32, 69, 72, 75, 77, 94 | Slipstream Nonfungible Position Manager: `Collect(uint256,address,uint256,uint256)` |
| `0x8903a5b5d08a841e7f68438387f1da20c84dea756379ed37e633ff3854b99b84` | 11, 16, 29, 30, 32, 69, 72, 75, 77, 94 | Observed CLGauge: `Withdraw(address,uint256,uint128)`<br>Observed CLGauge: `Withdraw(address,uint256,uint128)`<br>Observed CLGauge: `Withdraw(address,uint256,uint128)` |
| `0x7a53080ba414158be7ec69b987b5fb7d07dee101fe85488f0853ae16239d0bde` | 11, 16, 29, 30, 32, 69, 72, 75, 77, 94 | unmatched |
| `0x3067048beee31b25b2f1681f88dac838c8bba36af25bfb2b7cf7473a5847e35f` | 11, 16, 29, 30, 32, 69, 72, 75, 77, 94 | Slipstream Nonfungible Position Manager: `IncreaseLiquidity(uint256,uint128,uint256,uint256)` |
| `0x1c8ab8c7f45390d58f58f1d655213a82cca5d12179761a87c16f098813b8f211` | 11, 16, 29, 30, 32, 69, 72, 75, 77, 94 | Observed CLGauge: `Deposit(address,uint256,uint128)`<br>Observed CLGauge: `Deposit(address,uint256,uint128)`<br>Observed CLGauge: `Deposit(address,uint256,uint128)` |
| `0xee58b7a4a41f919b43841b7643761b258297cdd1aa967230d35bc23caf2b4f51` | 11, 16, 29, 30, 32, 69, 72, 75, 77, 94 | Mellow WETH-USDC Strategy Wrapper: `Deposit(address,address,address,uint256,uint256,uint256,uint256)`<br>Mellow Strategy Wrapper: `Deposit(address,address,address,uint256,uint256,uint256,uint256)`<br>Mellow Strategy Wrapper: `Deposit(address,address,address,uint256,uint256,uint256,uint256)`<br>Mellow Strategy Wrapper: `Deposit(address,address,address,uint256,uint256,uint256,uint256)`<br>Observed Mellow Strategy Wrapper: `Deposit(address,address,address,uint256,uint256,uint256,uint256)` |
| `0x8835c22a0c751188de86681e15904223c054bedd5c68ec8858945b7831290273` | 47, 50 | VotingEscrow: `Deposit(address,uint256,uint8,uint256,uint256,uint256)` |
| `0x5e2aa66efd74cce82b21852e317e5490d9ecc9e6bb953ae24d90851258cc2f5c` | 47, 50 | VotingEscrow: `Supply(uint256,uint256)` |
| `0x90890809c654f11d6e72a28fa60149770a0d11ec6c92319d6ceb2bb0a4ea1a15` | 48, 49, 51, 81, 82, 83 | unmatched |
| `0x452d440efc30dfa14a0ef803ccb55936af860ec6a6960ed27f129bef913f296a` | 48, 49, 51, 81, 82, 83 | Voter: `Voted(address,address,uint256,uint256,uint256,uint256)` |
| `0xf279e6a1f5e320cca91135676d9cb6e44ca8a08c0b88342bcdb1144f6511b568` | 49, 51, 81, 82, 83 | unmatched |
| `0xadab630928b1d46214641293704a312ee7ad87e03ae14a7fd95e7308b93998df` | 49, 51, 81, 82, 83 | Voter: `Abstained(address,address,uint256,uint256,uint256,uint256)` |
| `0xcae2990aa9af8eb1c64713b7eddb3a80bf18e49a94a13fe0d0002b5d61d58f00` | 50 | RewardsDistributor: `Claimed(uint256,uint256,uint256,uint256)` |
| `0x9aa05b3d70a9e3e2f004f039648839560576334fb45c81f91b6db03ad9e2efc9` | 54 | unmatched |
| `0x112c256902bf554b6ed882d2936687aaeb4225e8cd5b51303c90ca6cf43a8602` | 66, 79 | Observed Pool: `Fees(address,uint256,uint256)` |
| `0xcf2aa50876cdfbb541206f89af0ee78d44a2abf8d328e37fa4917f982149848a` | 66, 79 | Observed Pool: `Sync(uint256,uint256)` |
| `0xb3e2773606abfd36b5bd91394b3a54d1398336c65005baf7bf7a05efeffaf75b` | 66, 79 | Observed Pool: `Swap(address,address,uint256,uint256,uint256,uint256)` |
| `0xf7757ce35992f4ee014dee2e0c97ed6245758960a6ecc9e124897a5fb7b01423` | 81 | VotingEscrow: `DepositManaged(address,uint256,uint256,uint256,uint256)` |

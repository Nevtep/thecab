# Historical Decoded Transaction Classification Report

Generated at: 2026-06-01T00:26:45.078Z

Dataset:

- Files: `address-transactions-decoded-page0-response.json`, `address-transactions-decoded-page1-response.json`, `address-transactions-decoded-page2-response.json`, `address-transactions-decoded-page3-response.json`, `address-transactions-decoded-page4-response.json`, `address-transactions-decoded-page5-response.json`
- Raw rows: 534
- Unique tx hashes: 534
- Chronological range: 2025-09-27T03:41:21.000Z -> 2026-05-29T21:08:17.000Z
- Wallet: `0x0ecd939b7fca4dc4a0675d8d28bad12cefae0954`
- ABI registry: `docs/api-research/abis/protocol-abi-registry.json`

Note: the supplied page files contain 534 unique transactions. The product discussion expected 533; the extra row is a zero-value external no-op to the wallet with no logs and no value effect. Economically relevant rows are therefore 533.

## Classification Summary

| Classification | Count |
| --- | ---: |
| approval_strategy_wrapper | 55 |
| approval_position_manager | 52 |
| failed_transaction | 49 |
| approval_router | 48 |
| strategy_reward_claim | 42 |
| swap | 39 |
| manual_position_fee_claim | 32 |
| manual_position_approval | 29 |
| manual_gauge_reward_claim | 28 |
| manual_gauge_stake | 27 |
| manual_position_created | 26 |
| manual_gauge_unstake | 25 |
| governance_vote | 15 |
| cash_in_native | 14 |
| strategy_deposit | 13 |
| governance_rebase_claim | 11 |
| governance_bribe_claim | 8 |
| governance_poke | 7 |
| cash_out_token_transfer | 4 |
| approval_governance_lock | 1 |
| governance_lock_created | 1 |
| governance_deposit_managed | 1 |
| manual_pool_deposit_router | 1 |
| approval_protocol_contract | 1 |
| manual_pool_withdraw_router | 1 |
| manual_pool_fee_claim | 1 |
| strategy_withdraw | 1 |
| cash_out_native | 1 |
| zero_value_external_noop | 1 |

## Confidence Summary

| Confidence | Count |
| --- | ---: |
| high | 317 |
| high_action_partial_accounting | 94 |
| high_action_partial_breakdown | 69 |
| high_action | 42 |
| high_action_partial_value_effect | 11 |
| high_action_partial_semantics | 1 |

## Main Findings

- Governance classification is now structurally viable from ABI-decoded calls: votes, pokes, bribe claims, rebase claims, lock creation, and managed-lock deposit all have concrete ABI signatures. No `Voter.claimFees(...)` call was observed in these six pages.
- Mellow strategy deposits and reward claims are also structurally viable: observed wrappers are verified `LpWrapper` contracts, with `mint(...)`, `withdraw(...)`, and `getRewards(address)`.
- Manual Aerodrome positions need `NonfungiblePositionManager` decoding, including nested `multicall(bytes[])`; this report decodes the nested method names and separates create/increase/collect/withdraw actions.
- Gauge actions are distinct from wallet deposits: `CLGauge.deposit/withdraw/getReward` and `Gauge.deposit/withdraw/getReward` should produce gauge stake, unstake, and reward-claim domain events.
- Some rows remain partial by design: the action is known, but valuation, pool linkage, or reward-source breakdown needs secondary enrichment.

## Governance Rows

| # | Timestamp | Tx | Classification | Confidence | Function | Reason |
| ---: | --- | --- | --- | --- | --- | --- |
| 47 | 2026-01-17T22:12:13.000Z | `0xe1132344...4a7e63` | governance_lock_created | high | createLock | VotingEscrow.createLock |
| 48 | 2026-01-17T22:18:25.000Z | `0xa6fcbc9d...b96c0c` | governance_vote | high | vote | Voter.vote tokenId=110971 |
| 49 | 2026-01-28T19:59:11.000Z | `0x7d72704b...3b894c` | governance_vote | high | vote | Voter.vote tokenId=110971 |
| 50 | 2026-02-18T15:11:39.000Z | `0x17198d3f...87f79e` | governance_rebase_claim | high_action_partial_value_effect | claim | RewardsDistributor.claim |
| 51 | 2026-02-18T15:13:29.000Z | `0x8aa467e2...68dd63` | governance_vote | high | vote | Voter.vote tokenId=110971 |
| 54 | 2026-02-18T15:17:45.000Z | `0x58490d8b...cb324f` | governance_bribe_claim | high_action_partial_breakdown | claimBribes | Voter.claimBribes |
| 81 | 2026-02-22T18:07:41.000Z | `0xc220cbbd...36dba4` | governance_deposit_managed | high_action_partial_semantics | depositManaged | Voter.depositManaged tokenId=113464 mTokenId=10298 |
| 82 | 2026-02-22T18:11:33.000Z | `0x0190dd5e...49c907` | governance_vote | high | vote | Voter.vote tokenId=110971 |
| 83 | 2026-02-22T18:22:51.000Z | `0x50d02e75...20ebc4` | governance_poke | high | poke | Voter.poke tokenId=110971 |
| 132 | 2026-03-05T16:44:47.000Z | `0x2b29e51e...308e08` | governance_rebase_claim | high_action_partial_value_effect | claim | RewardsDistributor.claim |
| 133 | 2026-03-05T16:45:31.000Z | `0x863c6983...7de7e1` | governance_rebase_claim | high_action_partial_value_effect | claim | RewardsDistributor.claim |
| 134 | 2026-03-05T16:46:21.000Z | `0x177ccca6...a646ad` | governance_poke | high | poke | Voter.poke tokenId=110971 |
| 135 | 2026-03-05T16:47:23.000Z | `0xe243903a...aeab73` | governance_vote | high | vote | Voter.vote tokenId=110971 |
| 142 | 2026-03-05T16:53:29.000Z | `0x1dc8e266...80156e` | governance_bribe_claim | high_action_partial_breakdown | claimBribes | Voter.claimBribes |
| 169 | 2026-03-12T23:17:29.000Z | `0xbad0c8e9...29e846` | governance_rebase_claim | high_action_partial_value_effect | claim | RewardsDistributor.claim |
| 170 | 2026-03-12T23:18:41.000Z | `0x3633e51f...19f451` | governance_bribe_claim | high_action_partial_breakdown | claimBribes | Voter.claimBribes |
| 177 | 2026-03-12T23:26:33.000Z | `0x93b18566...e01f48` | governance_poke | high | poke | Voter.poke tokenId=110971 |
| 178 | 2026-03-12T23:30:43.000Z | `0x65da9f96...0d1977` | governance_vote | high | vote | Voter.vote tokenId=110971 |
| 263 | 2026-03-20T15:39:35.000Z | `0x81563246...41d034` | governance_vote | high | vote | Voter.vote tokenId=110971 |
| 271 | 2026-03-20T15:51:45.000Z | `0x751e1e3c...35794f` | governance_rebase_claim | high_action_partial_value_effect | claim | RewardsDistributor.claim |
| 290 | 2026-03-27T00:03:29.000Z | `0x96838ad6...ee4014` | governance_rebase_claim | high_action_partial_value_effect | claim | RewardsDistributor.claim |
| 291 | 2026-03-27T00:04:11.000Z | `0xcfa822bf...9922f4` | governance_bribe_claim | high_action_partial_breakdown | claimBribes | Voter.claimBribes |
| 294 | 2026-03-27T00:06:57.000Z | `0xf2fac55d...020654` | governance_vote | high | vote | Voter.vote tokenId=110971 |
| 308 | 2026-03-31T22:43:15.000Z | `0x986b2617...f20157` | governance_poke | high | poke | Voter.poke tokenId=110971 |
| 317 | 2026-04-03T14:30:39.000Z | `0x966e22e9...166772` | governance_bribe_claim | high_action_partial_breakdown | claimBribes | Voter.claimBribes |
| 318 | 2026-04-03T14:31:25.000Z | `0x87c5df15...2fbb66` | governance_rebase_claim | high_action_partial_value_effect | claim | RewardsDistributor.claim |
| 361 | 2026-04-13T21:26:27.000Z | `0x541f9f02...d73fd9` | governance_vote | high | vote | Voter.vote tokenId=110971 |
| 370 | 2026-04-17T15:21:59.000Z | `0xd0eada15...819a3e` | governance_rebase_claim | high_action_partial_value_effect | claim | RewardsDistributor.claim |
| 371 | 2026-04-17T15:22:45.000Z | `0xbef5db54...019797` | governance_bribe_claim | high_action_partial_breakdown | claimBribes | Voter.claimBribes |
| 395 | 2026-04-17T22:14:29.000Z | `0x291ba372...df2c81` | governance_poke | high | poke | Voter.poke tokenId=110971 |
| 396 | 2026-04-17T22:15:43.000Z | `0xf149b46c...16991e` | governance_vote | high | vote | Voter.vote tokenId=110971 |
| 399 | 2026-04-27T14:41:57.000Z | `0x6971fee8...36dc81` | governance_vote | high | vote | Voter.vote tokenId=110971 |
| 459 | 2026-05-07T15:37:57.000Z | `0x3afd6dcf...9c4943` | governance_rebase_claim | high_action_partial_value_effect | claim | RewardsDistributor.claim |
| 460 | 2026-05-07T15:38:51.000Z | `0x4e2e82ad...ef9e44` | governance_poke | high | poke | Voter.poke tokenId=110971 |
| 461 | 2026-05-07T15:40:21.000Z | `0x56113315...d6e795` | governance_vote | high | vote | Voter.vote tokenId=110971 |
| 472 | 2026-05-20T22:44:29.000Z | `0x326c89c5...83e4a6` | governance_vote | high | vote | Voter.vote tokenId=110971 |
| 482 | 2026-05-20T23:07:43.000Z | `0x810fe541...f027a2` | governance_rebase_claim | high_action_partial_value_effect | claim | RewardsDistributor.claim |
| 498 | 2026-05-23T21:28:31.000Z | `0x94f41cf5...06141f` | governance_bribe_claim | high_action_partial_breakdown | claimBribes | Voter.claimBribes |
| 506 | 2026-05-23T22:10:21.000Z | `0xc3dce6ed...a5f1e3` | governance_poke | high | poke | Voter.poke tokenId=110971 |
| 507 | 2026-05-23T22:18:13.000Z | `0xc5f037a5...dd748e` | governance_vote | high | vote | Voter.vote tokenId=110971 |
| 532 | 2026-05-29T21:06:33.000Z | `0xa71dd98b...b85a8e` | governance_vote | high | vote | Voter.vote tokenId=110971 |
| 533 | 2026-05-29T21:07:47.000Z | `0x23f1f251...bc44a7` | governance_bribe_claim | high_action_partial_breakdown | claimBribes | Voter.claimBribes |
| 534 | 2026-05-29T21:08:17.000Z | `0x22b57490...bbf80e` | governance_rebase_claim | high_action_partial_value_effect | claim | RewardsDistributor.claim |

## Rows Needing More Resolution

This table is capped to the first 160 rows needing follow-up. The full per-transaction output is in `docs/api-research/moralis/address-transactions-decoded-full-classification.json`.

| # | Timestamp | Tx | Classification | Confidence | Reason |
| ---: | --- | --- | --- | --- | --- |
| 11 | 2025-09-27T04:29:55.000Z | `0xca8e9a62...a36c83` | strategy_deposit | high_action_partial_accounting | Mellow WETH-USDC Strategy Wrapper mint |
| 16 | 2025-09-27T05:19:09.000Z | `0xa3077ce9...1ff673` | strategy_deposit | high_action_partial_accounting | Mellow WETH-USDC Strategy Wrapper mint |
| 29 | 2025-10-08T17:47:01.000Z | `0x0ae194b5...a2a04a` | strategy_deposit | high_action_partial_accounting | Mellow Strategy Wrapper mint |
| 30 | 2025-10-08T17:50:21.000Z | `0xcb5ea774...a6fee4` | strategy_deposit | high_action_partial_accounting | Mellow Strategy Wrapper mint |
| 32 | 2025-10-08T17:53:25.000Z | `0x1ebcbb22...91e449` | strategy_deposit | high_action_partial_accounting | Mellow Strategy Wrapper mint |
| 50 | 2026-02-18T15:11:39.000Z | `0x17198d3f...87f79e` | governance_rebase_claim | high_action_partial_value_effect | RewardsDistributor.claim |
| 54 | 2026-02-18T15:17:45.000Z | `0x58490d8b...cb324f` | governance_bribe_claim | high_action_partial_breakdown | Voter.claimBribes |
| 69 | 2026-02-18T15:54:53.000Z | `0x87cc39d3...298778` | strategy_deposit | high_action_partial_accounting | Mellow Strategy Wrapper mint |
| 72 | 2026-02-18T15:58:07.000Z | `0xfa8cf0e9...dbc265` | strategy_deposit | high_action_partial_accounting | Mellow Strategy Wrapper mint |
| 75 | 2026-02-18T16:01:53.000Z | `0x803a174a...48a02d` | strategy_deposit | high_action_partial_accounting | Mellow WETH-USDC Strategy Wrapper mint |
| 77 | 2026-02-19T03:06:29.000Z | `0x34f52929...4feae7` | strategy_deposit | high_action_partial_accounting | Mellow Strategy Wrapper mint |
| 81 | 2026-02-22T18:07:41.000Z | `0xc220cbbd...36dba4` | governance_deposit_managed | high_action_partial_semantics | Voter.depositManaged tokenId=113464 mTokenId=10298 |
| 94 | 2026-02-22T19:09:07.000Z | `0x4bb8bf02...fb3b24` | strategy_deposit | high_action_partial_accounting | Mellow Strategy Wrapper mint |
| 106 | 2026-02-22T21:12:53.000Z | `0x89799beb...e129e8` | manual_pool_deposit_router | high_action_partial_accounting | Router.addLiquidity |
| 121 | 2026-03-05T15:55:39.000Z | `0x5d6dfb11...9274e9` | manual_gauge_stake | high_action_partial_accounting | Gauge.deposit |
| 132 | 2026-03-05T16:44:47.000Z | `0x2b29e51e...308e08` | governance_rebase_claim | high_action_partial_value_effect | RewardsDistributor.claim |
| 133 | 2026-03-05T16:45:31.000Z | `0x863c6983...7de7e1` | governance_rebase_claim | high_action_partial_value_effect | RewardsDistributor.claim |
| 136 | 2026-03-05T16:48:53.000Z | `0x5668e821...418e8e` | manual_gauge_reward_claim | high_action_partial_breakdown | Gauge.getReward |
| 137 | 2026-03-05T16:49:37.000Z | `0xd58ceb9f...221c8d` | manual_gauge_unstake | high_action_partial_accounting | Gauge.withdraw |
| 139 | 2026-03-05T16:51:01.000Z | `0xdcc4c21c...11ceb4` | manual_pool_withdraw_router | high_action_partial_accounting | Router.removeLiquidity |
| 140 | 2026-03-05T16:51:49.000Z | `0xd1e9dd39...799792` | manual_pool_fee_claim | high_action_partial_breakdown | Pool.claimFees |
| 141 | 2026-03-05T16:52:35.000Z | `0xbf112957...7b9a3a` | manual_gauge_reward_claim | high_action_partial_breakdown | Gauge.getReward |
| 142 | 2026-03-05T16:53:29.000Z | `0x1dc8e266...80156e` | governance_bribe_claim | high_action_partial_breakdown | Voter.claimBribes |
| 143 | 2026-03-05T16:55:37.000Z | `0x142cfc67...8b0e51` | manual_position_created | high_action_partial_accounting | NonfungiblePositionManager mint |
| 144 | 2026-03-05T17:43:47.000Z | `0x8bb147ba...19a763` | manual_position_fee_claim | high_action_partial_breakdown | NonfungiblePositionManager multicall [decreaseLiquidity, collect, burn] |
| 146 | 2026-03-05T17:45:39.000Z | `0x77a9a087...e8f9c5` | manual_position_created | high_action_partial_accounting | NonfungiblePositionManager mint |
| 147 | 2026-03-05T17:47:23.000Z | `0x08507e23...6b4ddc` | strategy_withdraw | high_action_partial_accounting | Mellow Strategy Wrapper withdraw |
| 154 | 2026-03-05T17:56:05.000Z | `0x9b2e6a6e...e42f81` | manual_position_created | high_action_partial_accounting | NonfungiblePositionManager mint |
| 158 | 2026-03-05T17:59:13.000Z | `0x4645d2c1...b68c72` | manual_gauge_stake | high_action_partial_accounting | CLGauge.deposit |
| 160 | 2026-03-05T18:01:43.000Z | `0x36da80d8...96d651` | manual_position_fee_claim | high_action_partial_breakdown | NonfungiblePositionManager multicall [collect] |
| 162 | 2026-03-05T18:03:03.000Z | `0x3b6b0d69...bcecac` | manual_gauge_stake | high_action_partial_accounting | CLGauge.deposit |
| 164 | 2026-03-05T18:06:09.000Z | `0x17b98c1e...fa096a` | manual_position_created | high_action_partial_accounting | NonfungiblePositionManager mint |
| 166 | 2026-03-05T18:07:45.000Z | `0x8e027a5c...4a2dc8` | manual_position_fee_claim | high_action_partial_breakdown | NonfungiblePositionManager multicall [collect] |
| 168 | 2026-03-05T18:09:03.000Z | `0x6309ee75...f636e9` | manual_gauge_stake | high_action_partial_accounting | CLGauge.deposit |
| 169 | 2026-03-12T23:17:29.000Z | `0xbad0c8e9...29e846` | governance_rebase_claim | high_action_partial_value_effect | RewardsDistributor.claim |
| 170 | 2026-03-12T23:18:41.000Z | `0x3633e51f...19f451` | governance_bribe_claim | high_action_partial_breakdown | Voter.claimBribes |
| 172 | 2026-03-12T23:22:09.000Z | `0xe84f9395...234094` | manual_gauge_reward_claim | high_action_partial_breakdown | CLGauge.getReward |
| 173 | 2026-03-12T23:22:59.000Z | `0xf2f643e8...6ea2ce` | manual_gauge_reward_claim | high_action_partial_breakdown | CLGauge.getReward |
| 174 | 2026-03-12T23:23:49.000Z | `0x0b9e0ea0...f6cb0f` | manual_gauge_reward_claim | high_action_partial_breakdown | CLGauge.getReward |
| 183 | 2026-03-16T17:44:35.000Z | `0x93151121...76bf14` | manual_gauge_unstake | high_action_partial_accounting | CLGauge.withdraw |
| 185 | 2026-03-16T17:46:47.000Z | `0x28870624...3569fd` | manual_gauge_stake | high_action_partial_accounting | CLGauge.deposit |
| 186 | 2026-03-16T17:47:37.000Z | `0x7dc09743...f69326` | manual_gauge_reward_claim | high_action_partial_breakdown | CLGauge.getReward |
| 187 | 2026-03-16T17:48:37.000Z | `0xff2947a4...628fc4` | manual_gauge_reward_claim | high_action_partial_breakdown | CLGauge.getReward |
| 190 | 2026-03-16T17:52:05.000Z | `0xb0b8405f...1fa190` | manual_gauge_unstake | high_action_partial_accounting | CLGauge.withdraw |
| 191 | 2026-03-16T17:53:23.000Z | `0x4f7b9c81...c81cbb` | manual_position_fee_claim | high_action_partial_breakdown | NonfungiblePositionManager multicall [decreaseLiquidity, collect, burn] |
| 192 | 2026-03-16T17:54:27.000Z | `0x5b7df061...00258d` | manual_gauge_unstake | high_action_partial_accounting | CLGauge.withdraw |
| 193 | 2026-03-16T17:55:31.000Z | `0x4b8ffec8...f4c065` | manual_position_fee_claim | high_action_partial_breakdown | NonfungiblePositionManager multicall [decreaseLiquidity, collect, burn] |
| 194 | 2026-03-16T17:56:29.000Z | `0x2623d583...865472` | manual_gauge_unstake | high_action_partial_accounting | CLGauge.withdraw |
| 195 | 2026-03-16T17:57:19.000Z | `0x1bbd04ec...5cadca` | manual_position_fee_claim | high_action_partial_breakdown | NonfungiblePositionManager multicall [decreaseLiquidity, collect, burn] |
| 206 | 2026-03-16T20:55:15.000Z | `0xe930f450...c0103c` | manual_position_created | high_action_partial_accounting | NonfungiblePositionManager mint |
| 208 | 2026-03-16T20:56:55.000Z | `0x345e0241...b9dba1` | manual_gauge_stake | high_action_partial_accounting | CLGauge.deposit |
| 214 | 2026-03-16T21:05:17.000Z | `0xcd68d0e8...345476` | manual_position_created | high_action_partial_accounting | NonfungiblePositionManager mint |
| 216 | 2026-03-16T21:07:33.000Z | `0x02467976...1fab5f` | manual_gauge_stake | high_action_partial_accounting | CLGauge.deposit |
| 228 | 2026-03-17T04:19:11.000Z | `0x364a2bf3...ed32ae` | manual_position_created | high_action_partial_accounting | NonfungiblePositionManager mint |
| 231 | 2026-03-17T04:22:01.000Z | `0xe6bb58cc...f744d4` | manual_position_fee_claim | high_action_partial_breakdown | NonfungiblePositionManager multicall [collect] |
| 233 | 2026-03-17T04:23:47.000Z | `0xaff8242f...65488b` | manual_gauge_stake | high_action_partial_accounting | CLGauge.deposit |
| 240 | 2026-03-17T04:32:55.000Z | `0x0e6a63ab...13ed7a` | manual_position_created | high_action_partial_accounting | NonfungiblePositionManager mint |
| 242 | 2026-03-20T15:14:55.000Z | `0x8565b7f8...342a90` | manual_gauge_reward_claim | high_action_partial_breakdown | CLGauge.getReward |
| 243 | 2026-03-20T15:16:21.000Z | `0x8fb7a692...3241f0` | manual_gauge_unstake | high_action_partial_accounting | CLGauge.withdraw |
| 244 | 2026-03-20T15:17:11.000Z | `0x8afcaca2...28a5a1` | manual_position_fee_claim | high_action_partial_breakdown | NonfungiblePositionManager multicall [decreaseLiquidity, collect, burn] |
| 245 | 2026-03-20T15:19:35.000Z | `0xdc7a51a5...cc2236` | manual_position_fee_claim | high_action_partial_breakdown | NonfungiblePositionManager multicall [collect] |
| 247 | 2026-03-20T15:21:05.000Z | `0xe3a70304...921cf6` | manual_gauge_stake | high_action_partial_accounting | CLGauge.deposit |
| 258 | 2026-03-20T15:34:55.000Z | `0x606a739e...6ef2c1` | manual_position_created | high_action_partial_accounting | NonfungiblePositionManager mint |
| 261 | 2026-03-20T15:37:55.000Z | `0xf727f33c...b03369` | manual_gauge_stake | high_action_partial_accounting | CLGauge.deposit |
| 262 | 2026-03-20T15:38:39.000Z | `0x5582e26c...e2d018` | manual_gauge_reward_claim | high_action_partial_breakdown | CLGauge.getReward |
| 264 | 2026-03-20T15:40:29.000Z | `0x5da16c92...83c663` | manual_gauge_unstake | high_action_partial_accounting | CLGauge.withdraw |
| 265 | 2026-03-20T15:42:59.000Z | `0xf280d564...228b96` | manual_position_fee_claim | high_action_partial_breakdown | NonfungiblePositionManager multicall [decreaseLiquidity, collect, burn] |
| 269 | 2026-03-20T15:49:43.000Z | `0xaac69f37...521fbc` | strategy_deposit | high_action_partial_accounting | Mellow WETH-USDC Strategy Wrapper mint |
| 270 | 2026-03-20T15:50:45.000Z | `0x358ef3ac...56354a` | manual_gauge_reward_claim | high_action_partial_breakdown | CLGauge.getReward |
| 271 | 2026-03-20T15:51:45.000Z | `0x751e1e3c...35794f` | governance_rebase_claim | high_action_partial_value_effect | RewardsDistributor.claim |
| 272 | 2026-03-20T15:52:35.000Z | `0x5db1b586...4e8c36` | manual_gauge_unstake | high_action_partial_accounting | CLGauge.withdraw |
| 273 | 2026-03-20T15:53:21.000Z | `0x5e6f82bb...41a498` | manual_position_fee_claim | high_action_partial_breakdown | NonfungiblePositionManager multicall [decreaseLiquidity, collect, burn] |
| 280 | 2026-03-20T16:01:43.000Z | `0x1ca95e00...1076c5` | manual_position_created | high_action_partial_accounting | NonfungiblePositionManager mint |
| 282 | 2026-03-20T16:03:21.000Z | `0xbf171b1f...7317db` | manual_position_fee_claim | high_action_partial_breakdown | NonfungiblePositionManager multicall [collect] |
| 283 | 2026-03-20T16:03:51.000Z | `0x770771d9...25639b` | manual_gauge_stake | high_action_partial_accounting | CLGauge.deposit |
| 284 | 2026-03-26T23:54:51.000Z | `0xdf6cb95e...317fd0` | manual_gauge_reward_claim | high_action_partial_breakdown | CLGauge.getReward |
| 285 | 2026-03-26T23:59:39.000Z | `0x088a12c4...e8d7c7` | manual_gauge_reward_claim | high_action_partial_breakdown | CLGauge.getReward |
| 288 | 2026-03-27T00:02:01.000Z | `0xbd33a60d...a2b217` | manual_gauge_reward_claim | high_action_partial_breakdown | CLGauge.getReward |
| 290 | 2026-03-27T00:03:29.000Z | `0x96838ad6...ee4014` | governance_rebase_claim | high_action_partial_value_effect | RewardsDistributor.claim |
| 291 | 2026-03-27T00:04:11.000Z | `0xcfa822bf...9922f4` | governance_bribe_claim | high_action_partial_breakdown | Voter.claimBribes |
| 292 | 2026-03-27T00:04:57.000Z | `0xc3afe025...36f0c6` | manual_gauge_unstake | high_action_partial_accounting | CLGauge.withdraw |
| 293 | 2026-03-27T00:05:53.000Z | `0x0f62c7d1...964ab9` | manual_position_fee_claim | high_action_partial_breakdown | NonfungiblePositionManager multicall [decreaseLiquidity, collect, burn] |
| 303 | 2026-03-27T00:17:19.000Z | `0x157b8340...fb9e8a` | manual_position_created | high_action_partial_accounting | NonfungiblePositionManager mint |
| 306 | 2026-03-27T00:19:39.000Z | `0x6a337583...ecdc05` | manual_position_fee_claim | high_action_partial_breakdown | NonfungiblePositionManager multicall [collect] |
| 307 | 2026-03-27T00:20:23.000Z | `0x1b5cc2e8...f8e1b0` | manual_gauge_stake | high_action_partial_accounting | CLGauge.deposit |
| 309 | 2026-04-03T14:23:01.000Z | `0xdd1d5c89...336a34` | manual_gauge_reward_claim | high_action_partial_breakdown | CLGauge.getReward |
| 310 | 2026-04-03T14:23:57.000Z | `0x9bd299f7...9d9f38` | manual_gauge_unstake | high_action_partial_accounting | CLGauge.withdraw |
| 311 | 2026-04-03T14:25:13.000Z | `0xa607df7f...c40b10` | manual_position_fee_claim | high_action_partial_breakdown | NonfungiblePositionManager multicall [decreaseLiquidity, collect, burn] |
| 312 | 2026-04-03T14:26:39.000Z | `0x8b3d7cb5...cc389c` | manual_gauge_reward_claim | high_action_partial_breakdown | CLGauge.getReward |
| 313 | 2026-04-03T14:27:19.000Z | `0xcdc5324f...79077a` | manual_gauge_reward_claim | high_action_partial_breakdown | CLGauge.getReward |
| 317 | 2026-04-03T14:30:39.000Z | `0x966e22e9...166772` | governance_bribe_claim | high_action_partial_breakdown | Voter.claimBribes |
| 318 | 2026-04-03T14:31:25.000Z | `0x87c5df15...2fbb66` | governance_rebase_claim | high_action_partial_value_effect | RewardsDistributor.claim |
| 326 | 2026-04-03T14:42:37.000Z | `0x1f2f0795...342709` | manual_position_created | high_action_partial_accounting | NonfungiblePositionManager mint |
| 328 | 2026-04-03T14:44:27.000Z | `0x3056e027...892e60` | manual_gauge_stake | high_action_partial_accounting | CLGauge.deposit |
| 333 | 2026-04-10T00:02:35.000Z | `0x28fde304...299a3d` | manual_gauge_reward_claim | high_action_partial_breakdown | CLGauge.getReward |
| 334 | 2026-04-10T00:03:29.000Z | `0xb56120bf...9355c8` | manual_gauge_unstake | high_action_partial_accounting | CLGauge.withdraw |
| 335 | 2026-04-10T00:04:33.000Z | `0x3740ee82...b9bfbc` | manual_position_fee_claim | high_action_partial_breakdown | NonfungiblePositionManager multicall [decreaseLiquidity, collect, burn] |
| 342 | 2026-04-10T00:20:09.000Z | `0x39a9488b...06a1f1` | manual_position_created | high_action_partial_accounting | NonfungiblePositionManager mint |
| 344 | 2026-04-10T00:22:09.000Z | `0xe2e1c00e...64b7f8` | manual_gauge_stake | high_action_partial_accounting | CLGauge.deposit |
| 345 | 2026-04-13T21:04:23.000Z | `0xf78df87d...524bbe` | manual_gauge_reward_claim | high_action_partial_breakdown | CLGauge.getReward |
| 347 | 2026-04-13T21:06:05.000Z | `0x59f886f2...35faa5` | manual_gauge_unstake | high_action_partial_accounting | CLGauge.withdraw |
| 348 | 2026-04-13T21:06:55.000Z | `0x16929911...2f3d4b` | manual_position_fee_claim | high_action_partial_breakdown | NonfungiblePositionManager multicall [decreaseLiquidity, collect, burn] |
| 354 | 2026-04-13T21:15:39.000Z | `0x7ba13344...382670` | manual_position_created | high_action_partial_accounting | NonfungiblePositionManager mint |
| 357 | 2026-04-13T21:18:11.000Z | `0x0d6727c1...13cb6b` | manual_position_fee_claim | high_action_partial_breakdown | NonfungiblePositionManager multicall [collect] |
| 360 | 2026-04-13T21:20:37.000Z | `0xfdc7ba2e...035438` | manual_gauge_stake | high_action_partial_accounting | CLGauge.deposit |
| 362 | 2026-04-17T15:13:23.000Z | `0xffde03a3...fedb3a` | manual_gauge_reward_claim | high_action_partial_breakdown | CLGauge.getReward |
| 363 | 2026-04-17T15:14:17.000Z | `0x0864fa24...fc4e66` | manual_gauge_reward_claim | high_action_partial_breakdown | CLGauge.getReward |
| 368 | 2026-04-17T15:20:07.000Z | `0x8dcb8324...ec0d9e` | manual_gauge_reward_claim | high_action_partial_breakdown | CLGauge.getReward |
| 370 | 2026-04-17T15:21:59.000Z | `0xd0eada15...819a3e` | governance_rebase_claim | high_action_partial_value_effect | RewardsDistributor.claim |
| 371 | 2026-04-17T15:22:45.000Z | `0xbef5db54...019797` | governance_bribe_claim | high_action_partial_breakdown | Voter.claimBribes |
| 372 | 2026-04-17T15:24:33.000Z | `0xe277a4b3...2864b0` | manual_gauge_unstake | high_action_partial_accounting | CLGauge.withdraw |
| 373 | 2026-04-17T15:25:31.000Z | `0x50f8bdd6...555de7` | manual_gauge_unstake | high_action_partial_accounting | CLGauge.withdraw |
| 374 | 2026-04-17T15:26:29.000Z | `0x99147d8e...943428` | manual_position_fee_claim | high_action_partial_breakdown | NonfungiblePositionManager multicall [decreaseLiquidity, collect, burn] |
| 375 | 2026-04-17T15:27:27.000Z | `0xcb197474...1891e0` | manual_position_fee_claim | high_action_partial_breakdown | NonfungiblePositionManager multicall [decreaseLiquidity, collect, burn] |
| 381 | 2026-04-17T15:36:45.000Z | `0xd3e8f139...856417` | manual_position_created | high_action_partial_accounting | NonfungiblePositionManager mint |
| 383 | 2026-04-17T15:45:07.000Z | `0xa93c8f64...184481` | manual_position_fee_claim | high_action_partial_breakdown | NonfungiblePositionManager multicall [collect] |
| 385 | 2026-04-17T15:46:41.000Z | `0xcccf5a88...c857d7` | manual_gauge_stake | high_action_partial_accounting | CLGauge.deposit |
| 392 | 2026-04-17T17:45:57.000Z | `0x8da4dd8e...1e37b4` | manual_position_created | high_action_partial_accounting | NonfungiblePositionManager mint |
| 394 | 2026-04-17T17:47:23.000Z | `0xf18c6965...f99110` | manual_gauge_stake | high_action_partial_accounting | CLGauge.deposit |
| 400 | 2026-04-27T14:45:53.000Z | `0x2ed87ea1...fa2fe8` | manual_gauge_unstake | high_action_partial_accounting | CLGauge.withdraw |
| 401 | 2026-04-27T14:46:49.000Z | `0x490b95c1...8b5ffc` | manual_position_fee_claim | high_action_partial_breakdown | NonfungiblePositionManager multicall [decreaseLiquidity, collect, burn] |
| 408 | 2026-04-27T14:56:13.000Z | `0x12c85c17...19cb76` | manual_position_created | high_action_partial_accounting | NonfungiblePositionManager mint |
| 410 | 2026-04-27T14:57:27.000Z | `0xdd705693...488127` | manual_gauge_stake | high_action_partial_accounting | CLGauge.deposit |
| 413 | 2026-04-27T15:04:17.000Z | `0xd6b99092...b86777` | strategy_deposit | high_action_partial_accounting | Observed Mellow Strategy Wrapper mint |
| 416 | 2026-04-27T15:44:17.000Z | `0x78636ad1...a074b0` | manual_gauge_reward_claim | high_action_partial_breakdown | CLGauge.getReward |
| 417 | 2026-04-27T15:44:41.000Z | `0x2fa30d05...770527` | manual_gauge_reward_claim | high_action_partial_breakdown | CLGauge.getReward |
| 427 | 2026-05-02T05:01:07.000Z | `0xdcdbebf1...5bdbfd` | manual_gauge_unstake | high_action_partial_accounting | CLGauge.withdraw |
| 428 | 2026-05-02T05:01:47.000Z | `0xe8df47e5...214488` | manual_position_fee_claim | high_action_partial_breakdown | NonfungiblePositionManager multicall [decreaseLiquidity, collect, burn] |
| 433 | 2026-05-02T05:08:23.000Z | `0xe0186889...895784` | manual_position_created | high_action_partial_accounting | NonfungiblePositionManager mint |
| 435 | 2026-05-02T05:09:29.000Z | `0xc2f4a43a...0cf033` | manual_gauge_stake | high_action_partial_accounting | CLGauge.deposit |
| 436 | 2026-05-07T15:14:11.000Z | `0xc479d7b0...71bd93` | manual_gauge_reward_claim | high_action_partial_breakdown | CLGauge.getReward |
| 437 | 2026-05-07T15:14:43.000Z | `0xa33e299e...c398d0` | manual_gauge_reward_claim | high_action_partial_breakdown | CLGauge.getReward |
| 438 | 2026-05-07T15:15:21.000Z | `0x750908cb...a3ab33` | manual_gauge_unstake | high_action_partial_accounting | CLGauge.withdraw |
| 439 | 2026-05-07T15:16:11.000Z | `0xabe477d0...940224` | manual_gauge_unstake | high_action_partial_accounting | CLGauge.withdraw |
| 440 | 2026-05-07T15:16:43.000Z | `0xdcc59067...02f1ad` | manual_position_fee_claim | high_action_partial_breakdown | NonfungiblePositionManager multicall [decreaseLiquidity, collect, burn] |
| 441 | 2026-05-07T15:17:15.000Z | `0x0804ed84...3df6c3` | manual_position_fee_claim | high_action_partial_breakdown | NonfungiblePositionManager multicall [decreaseLiquidity, collect, burn] |
| 448 | 2026-05-07T15:25:03.000Z | `0xd405a82d...664911` | manual_position_created | high_action_partial_accounting | NonfungiblePositionManager mint |
| 450 | 2026-05-07T15:26:09.000Z | `0x7e67e445...8a3b00` | manual_gauge_stake | high_action_partial_accounting | CLGauge.deposit |
| 451 | 2026-05-07T15:27:33.000Z | `0x4b4f6a8f...e8d8f7` | manual_gauge_reward_claim | high_action_partial_breakdown | CLGauge.getReward |
| 452 | 2026-05-07T15:28:13.000Z | `0x7aecd213...02a9b1` | manual_gauge_unstake | high_action_partial_accounting | CLGauge.withdraw |
| 453 | 2026-05-07T15:28:57.000Z | `0x38f2a88c...747a2a` | manual_position_fee_claim | high_action_partial_breakdown | NonfungiblePositionManager multicall [decreaseLiquidity, collect, burn] |
| 456 | 2026-05-07T15:35:51.000Z | `0x695362a5...683293` | manual_position_created | high_action_partial_accounting | NonfungiblePositionManager mint |
| 458 | 2026-05-07T15:36:41.000Z | `0x01a2d166...45be4f` | manual_gauge_stake | high_action_partial_accounting | CLGauge.deposit |
| 459 | 2026-05-07T15:37:57.000Z | `0x3afd6dcf...9c4943` | governance_rebase_claim | high_action_partial_value_effect | RewardsDistributor.claim |
| 462 | 2026-05-12T22:46:21.000Z | `0xe95eff3f...089a47` | manual_gauge_unstake | high_action_partial_accounting | CLGauge.withdraw |
| 463 | 2026-05-12T22:47:21.000Z | `0x122a5684...450c0a` | manual_position_fee_claim | high_action_partial_breakdown | NonfungiblePositionManager multicall [decreaseLiquidity, collect, burn] |
| 468 | 2026-05-12T23:00:43.000Z | `0xd07b29e9...0d2ee8` | manual_position_created | high_action_partial_accounting | NonfungiblePositionManager mint |
| 470 | 2026-05-12T23:05:21.000Z | `0x2f33b218...cbf12e` | manual_gauge_stake | high_action_partial_accounting | CLGauge.deposit |
| 473 | 2026-05-20T22:45:21.000Z | `0x9a6d34ba...1aba30` | manual_gauge_unstake | high_action_partial_accounting | CLGauge.withdraw |
| 474 | 2026-05-20T22:45:55.000Z | `0x4b48f0f7...e395d3` | manual_position_fee_claim | high_action_partial_breakdown | NonfungiblePositionManager multicall [decreaseLiquidity, collect, burn] |
| 479 | 2026-05-20T23:05:37.000Z | `0x5e938cf0...5dd018` | manual_position_created | high_action_partial_accounting | NonfungiblePositionManager mint |
| 481 | 2026-05-20T23:06:43.000Z | `0x4236b180...c68c66` | manual_gauge_stake | high_action_partial_accounting | CLGauge.deposit |
| 482 | 2026-05-20T23:07:43.000Z | `0x810fe541...f027a2` | governance_rebase_claim | high_action_partial_value_effect | RewardsDistributor.claim |
| 484 | 2026-05-20T23:17:41.000Z | `0x891d0544...d7b205` | manual_gauge_reward_claim | high_action_partial_breakdown | CLGauge.getReward |
| 488 | 2026-05-23T01:37:11.000Z | `0x7ee7a3d3...bd113f` | manual_gauge_unstake | high_action_partial_accounting | CLGauge.withdraw |
| 489 | 2026-05-23T01:37:45.000Z | `0x657473ce...ce9509` | manual_position_fee_claim | high_action_partial_breakdown | NonfungiblePositionManager multicall [decreaseLiquidity, collect, burn] |
| 495 | 2026-05-23T01:47:17.000Z | `0xd96875e0...23d39b` | manual_position_created | high_action_partial_accounting | NonfungiblePositionManager mint |
| 497 | 2026-05-23T01:48:21.000Z | `0x9c40b0f2...3922bc` | manual_gauge_stake | high_action_partial_accounting | CLGauge.deposit |
| 498 | 2026-05-23T21:28:31.000Z | `0x94f41cf5...06141f` | governance_bribe_claim | high_action_partial_breakdown | Voter.claimBribes |
| 503 | 2026-05-23T21:32:37.000Z | `0xb921a290...b73dd2` | manual_position_created | high_action_partial_accounting | NonfungiblePositionManager mint |

## Remaining Missing Selector/ABI Cases

| Count | To address | Selector | Example | Reason |
| ---: | --- | --- | --- | --- |
| 0 | - | - | - | All non-token selectors matched the registry |

No function selector remains unresolved after adding the observed Aerodrome position manager, routers, gauges, pool, and extra Mellow wrapper to the ABI registry. Remaining partial rows are accounting/enrichment problems, not action-classification problems.

## Engine Rules Validated

1. Collect historical decoded transactions first, in ascending order, until Moralis has no cursor left.
2. Persist raw transaction, logs, internal transactions, decoded_call, and page cursor before any domain materialization.
3. Classify only from canonical DB rows using ABI registry + generic token standards + protocol registry.
4. Process transactions oldest to newest so deposits, locks, strategy exposures, token approvals, and gauge stakes exist before later claims/rewards need attribution.
5. Split confidence into at least two dimensions:
   - action confidence: selector and contract prove what happened.
   - accounting confidence: balances, valuation, owner, pool, and reward-source attribution are complete.
6. Never convert internal protocol `Deposit`/`Withdraw` logs from `Voter.vote`, `poke`, or `depositManaged` into user deposits/cash flows.
7. Treat unsolicited inbound token transfers as unresolved cash-in/airdrop/spam candidates until token metadata, counterparty label, and wallet initiation are known.

## Open Work Before Engine Rewrite

- Add token metadata and spam/scam token registry for all inbound token transfers.
- Decode universal router command bytes to classify exact swap path, not just router-level `execute`.
- Add ABI artifacts for reward/bribe contracts emitted inside `Voter.claimBribes` and `claimFees` for pool-level breakdown.
- Define product semantics for `depositManaged(tokenId,mTokenId)` so the Governance DataView explains managed/relay lock exposure correctly.
- Build price enrichment after classification, using Alchemy pricing by token/time and special handling for wrapped assets.
- Add LP enrichment for manual positions and Mellow exposures after position events are known.

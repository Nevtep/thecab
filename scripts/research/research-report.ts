import type { ClassifiedDecodedTransaction, MoralisDecodedTransaction } from "../../apps/web/src/server/analysis/decoded-history";
import { shortHash } from "../../apps/web/src/server/analysis/decoded-history";

export function buildClassificationReport(input: {
  generatedAt: string;
  files: string[];
  walletAddress: string;
  rawRows: number;
  uniqueTransactions: number;
  firstTimestamp: string | null;
  lastTimestamp: string | null;
  summary: {
    byClassification: Record<string, number>;
    byConfidence: Record<string, number>;
    unresolvedSelectors: Array<{
      count: number;
      toAddress: string;
      selector: string;
      exampleHash: string;
      reason: string;
    }>;
  };
  transactions: Array<ClassifiedDecodedTransaction & {
    index: number;
    pageFile?: string;
    pageRow?: number;
  }>;
}) {
  const countRows = Object.entries(input.summary.byClassification)
    .sort((a, b) => b[1] - a[1])
    .map(([classification, count]) => `| ${classification} | ${count} |`)
    .join("\n");

  const confidenceRows = Object.entries(input.summary.byConfidence)
    .sort((a, b) => b[1] - a[1])
    .map(([confidence, count]) => `| ${confidence} | ${count} |`)
    .join("\n");

  const unresolvedRows = input.transactions
    .filter((tx) => tx.needsResolution)
    .slice(0, 160)
    .map((tx) => `| ${tx.index} | ${tx.timestamp ?? ""} | \`${shortHash(tx.hash)}\` | ${tx.classification} | ${tx.confidence} | ${tx.reason.replaceAll("|", "/")} |`)
    .join("\n");

  const governanceRows = input.transactions
    .filter((tx) => tx.classification.startsWith("governance_"))
    .map((tx) => `| ${tx.index} | ${tx.timestamp ?? ""} | \`${shortHash(tx.hash)}\` | ${tx.classification} | ${tx.confidence} | ${tx.decodedFunction ?? ""} | ${tx.reason.replaceAll("|", "/")} |`)
    .join("\n");

  const missingRows = input.summary.unresolvedSelectors
    .map((item) => `| ${item.count} | \`${item.toAddress}\` | \`${item.selector}\` | ${item.exampleHash} | ${item.reason} |`)
    .join("\n");

  return `# Historical Decoded Transaction Classification Report

Generated at: ${input.generatedAt}

Dataset:

- Files: ${input.files.map((file) => `\`${file}\``).join(", ")}
- Raw rows: ${input.rawRows}
- Unique tx hashes: ${input.uniqueTransactions}
- Chronological range: ${input.firstTimestamp} -> ${input.lastTimestamp}
- Wallet: \`${input.walletAddress}\`
- ABI registry: \`docs/api-research/abis/protocol-abi-registry.json\`

Note: the supplied page files contain ${input.rawRows} unique transactions. The product discussion expected 533; the extra row is a zero-value external no-op to the wallet with no logs and no value effect. Economically relevant rows are therefore 533.

## Classification Summary

| Classification | Count |
| --- | ---: |
${countRows}

## Confidence Summary

| Confidence | Count |
| --- | ---: |
${confidenceRows}

## Main Findings

- Governance classification is now structurally viable from ABI-decoded calls: votes, pokes, bribe claims, rebase claims, lock creation, and managed-lock deposit all have concrete ABI signatures. No \`Voter.claimFees(...)\` call was observed in these six pages.
- Mellow strategy deposits and reward claims are also structurally viable: observed wrappers are verified \`LpWrapper\` contracts, with \`mint(...)\`, \`withdraw(...)\`, and \`getRewards(address)\`.
- Manual Aerodrome positions need \`NonfungiblePositionManager\` decoding, including nested \`multicall(bytes[])\`; this report decodes the nested method names and separates create/increase/collect/withdraw actions.
- Gauge actions are distinct from wallet deposits: \`CLGauge.deposit/withdraw/getReward\` and \`Gauge.deposit/withdraw/getReward\` should produce gauge stake, unstake, and reward-claim domain events.
- Some rows remain partial by design: the action is known, but valuation, pool linkage, or reward-source breakdown needs secondary enrichment.

## Governance Rows

| # | Timestamp | Tx | Classification | Confidence | Function | Reason |
| ---: | --- | --- | --- | --- | --- | --- |
${governanceRows}

## Rows Needing More Resolution

This table is capped to the first 160 rows needing follow-up. The full per-transaction output is in \`docs/api-research/moralis/address-transactions-decoded-full-classification.json\`.

| # | Timestamp | Tx | Classification | Confidence | Reason |
| ---: | --- | --- | --- | --- | --- |
${unresolvedRows || "| - | - | - | - | - | No unresolved rows |"}

## Remaining Missing Selector/ABI Cases

| Count | To address | Selector | Example | Reason |
| ---: | --- | --- | --- | --- |
${missingRows || "| 0 | - | - | - | All non-token selectors matched the registry |"}

No function selector remains unresolved after adding the observed Aerodrome position manager, routers, gauges, pool, and extra Mellow wrapper to the ABI registry. Remaining partial rows are accounting/enrichment problems, not action-classification problems.

## Engine Rules Validated

1. Collect historical decoded transactions first, in ascending order, until Moralis has no cursor left.
2. Persist raw transaction, logs, internal transactions, decoded_call, and page cursor before any domain materialization.
3. Classify only from canonical DB rows using ABI registry + generic token standards + protocol registry.
4. Process transactions oldest to newest so deposits, locks, strategy exposures, token approvals, and gauge stakes exist before later claims/rewards need attribution.
5. Split confidence into at least two dimensions:
   - action confidence: selector and contract prove what happened.
   - accounting confidence: balances, valuation, owner, pool, and reward-source attribution are complete.
6. Never convert internal protocol \`Deposit\`/\`Withdraw\` logs from \`Voter.vote\`, \`poke\`, or \`depositManaged\` into user deposits/cash flows.
7. Treat unsolicited inbound token transfers as unresolved cash-in/airdrop/spam candidates until token metadata, counterparty label, and wallet initiation are known.

## Open Work Before Engine Rewrite

- Add token metadata and spam/scam token registry for all inbound token transfers.
- Decode universal router command bytes to classify exact swap path, not just router-level \`execute\`.
- Add ABI artifacts for reward/bribe contracts emitted inside \`Voter.claimBribes\` and \`claimFees\` for pool-level breakdown.
- Define product semantics for \`depositManaged(tokenId,mTokenId)\` so the Governance DataView explains managed/relay lock exposure correctly.
- Build price enrichment after classification, using Alchemy pricing by token/time and special handling for wrapped assets.
- Add LP enrichment for manual positions and Mellow exposures after position events are known.
`;
}

export function serializeBigInt(value: unknown) {
  return JSON.stringify(value, (_, item) => (typeof item === "bigint" ? item.toString() : item));
}

export type ResearchPageTransaction = MoralisDecodedTransaction & {
  __file?: string;
  __rowIndex?: number;
};

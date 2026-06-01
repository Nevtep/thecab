import assert from "node:assert/strict";
import test from "node:test";

import { extractCanonicalMovements } from "@/server/analysis/engine-v2/canonicalization";

const walletAddress = "0x0000000000000000000000000000000000000001";

test("extractCanonicalMovements captures native inbound transfers", () => {
  const movements = extractCanonicalMovements({
    walletAddress,
    transaction: {
      hash: "0xabc",
      from_address: "0x0000000000000000000000000000000000000002",
      to_address: walletAddress,
      value: "100",
    },
  });

  assert.equal(movements[0]?.assetType, "native");
  assert.equal(movements[0]?.direction, "in");
});

test("extractCanonicalMovements captures ERC20 transfer logs", () => {
  const movements = extractCanonicalMovements({
    walletAddress,
    transaction: {
      hash: "0xabc",
      value: "0",
      logs: [{
        address: "0x0000000000000000000000000000000000000003",
        log_index: "1",
        decoded_event: {
          label: "Transfer",
          params: [
            { name: "from", value: walletAddress },
            { name: "to", value: "0x0000000000000000000000000000000000000002" },
            { name: "amount", value: "50" },
          ],
        },
      }],
    },
  });

  assert.equal(movements[0]?.assetType, "erc20");
  assert.equal(movements[0]?.direction, "out");
  assert.equal(movements[0]?.amountRaw, "50");
});

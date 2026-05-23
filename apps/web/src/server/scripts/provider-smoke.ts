import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { SUPPORTED_CHAIN_ID } from "@/server/chains";
import { getCurrentTokenPricesByAddress } from "@/server/providers/alchemy";
import { getWalletDefiPositions, getWalletHistory } from "@/server/providers/moralis";

function loadLocalEnvFile() {
  const envFilePath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envFilePath)) {
    return;
  }

  for (const line of readFileSync(envFilePath, "utf8").split(/\r?\n/)) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmedLine.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmedLine.slice(0, separatorIndex).trim();
    const value = trimmedLine.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!process.env[key] || key === "TEST_ADDRESS") {
      process.env[key] = value;
    }
  }
}

loadLocalEnvFile();

function getTestWalletAddress() {
  const walletAddress = process.env.TEST_ADDRESS?.trim() ?? "";

  if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
    throw new Error("TEST_ADDRESS_MISSING_OR_INVALID");
  }

  return walletAddress.toLowerCase();
}

async function main() {
  const sampleWallet = getTestWalletAddress();

  const [history, defiPositions, prices] = await Promise.all([
    getWalletHistory(sampleWallet, SUPPORTED_CHAIN_ID, 5),
    getWalletDefiPositions(sampleWallet, SUPPORTED_CHAIN_ID),
    getCurrentTokenPricesByAddress(SUPPORTED_CHAIN_ID, [
      "0x4200000000000000000000000000000000000006",
    ]),
  ]);

  console.log(
    JSON.stringify(
      {
        ok: true,
        walletAddress: sampleWallet,
        historyCount: history.result?.length ?? 0,
        defiPositionsCount: defiPositions.length,
        priceCount: prices.data?.length ?? 0,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});

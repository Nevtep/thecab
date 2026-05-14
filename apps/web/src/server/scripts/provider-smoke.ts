import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { SUPPORTED_CHAIN_ID } from "@/server/chains";
import { getCurrentTokenPricesByAddress } from "@/server/providers/alchemy";
import { getWalletHistory } from "@/server/providers/moralis";

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
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadLocalEnvFile();

async function main() {
  const sampleWallet = "0x1111111111111111111111111111111111111111";

  const history = await getWalletHistory(sampleWallet, SUPPORTED_CHAIN_ID, 1);
  const prices = await getCurrentTokenPricesByAddress(SUPPORTED_CHAIN_ID, [
    "0x4200000000000000000000000000000000000006",
  ]);

  console.log(
    JSON.stringify(
      {
        ok: true,
        historyCount: history.result?.length ?? 0,
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

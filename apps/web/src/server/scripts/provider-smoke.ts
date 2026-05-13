import { SUPPORTED_CHAIN_ID } from "@/server/chains";
import { getCurrentTokenPricesByAddress } from "@/server/providers/alchemy";
import { getWalletHistory } from "@/server/providers/moralis";

async function main() {
  const sampleWallet = "0x0000000000000000000000000000000000000000";

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

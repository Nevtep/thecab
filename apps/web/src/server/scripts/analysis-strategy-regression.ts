import { closeDb } from "@/server/db/client";

async function main() {
  const walletAddress = process.env.WALLET_ADDRESS ?? process.argv[2] ?? null;
  const chainId = Number(process.env.CHAIN_ID ?? "8453");

  console.log(
    JSON.stringify(
      {
        status: "not_implemented",
        walletAddress,
        chainId,
        checks: [],
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await closeDb();
  });

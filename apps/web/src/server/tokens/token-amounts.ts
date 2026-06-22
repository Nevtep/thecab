export type TokenAssetType = "erc20" | "erc721" | "native" | "unknown";

function isUnsignedInteger(value: string) {
  return /^\d+$/.test(value);
}

export function formatRawTokenAmount(input: {
  amountRaw: string | null | undefined;
  tokenDecimals: number | null | undefined;
  assetType?: TokenAssetType | string | null;
}) {
  const amountRaw = input.amountRaw?.trim();
  if (!amountRaw || !isUnsignedInteger(amountRaw)) return null;

  const assetType = input.assetType ?? "erc20";
  if (assetType === "erc721") return amountRaw;

  const decimals = input.tokenDecimals;
  if (typeof decimals !== "number" || !Number.isInteger(decimals) || decimals < 0) return null;
  if (decimals === 0) return amountRaw;

  const raw = BigInt(amountRaw);
  const base = 10n ** BigInt(decimals);
  const whole = raw / base;
  const fraction = raw % base;
  if (fraction === 0n) return whole.toString();

  const padded = fraction.toString().padStart(decimals, "0").replace(/0+$/, "");
  return padded.length > 0 ? `${whole.toString()}.${padded}` : whole.toString();
}


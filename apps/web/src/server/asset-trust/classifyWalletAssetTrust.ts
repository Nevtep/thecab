import { dedupeTrustReasonCodes } from "@/server/asset-trust/assetTrust.reasonCodes";
import type {
  AssetTrustClassifierInput,
  KnownProtocolTrustReasonCode,
  TokenTrustClassification,
  TokenTrustReasonCode,
  TokenTrustStatus,
} from "@/server/asset-trust/assetTrust.types";

type ClassifyWalletAssetTrustOptions = {
  knownProtocolReasonCode?: KnownProtocolTrustReasonCode | null;
  isBlockedByPolicy?: boolean;
};

const SUSPICIOUS_NAME_PATTERN = /(fake|scam|spam|airdrop|claim|visit|www\.|http|https|bonus)/i;

function hasSuspiciousMetadata(input: AssetTrustClassifierInput) {
  const values = [input.symbol, input.name].filter((value): value is string => Boolean(value));
  return values.some((value) => SUSPICIOUS_NAME_PATTERN.test(value));
}

function buildReasonCodes(
  input: AssetTrustClassifierInput,
  options: ClassifyWalletAssetTrustOptions,
) {
  const reasonCodes: TokenTrustReasonCode[] = [];

  if (options.isBlockedByPolicy) {
    reasonCodes.push("unrecognizedContract");
  }

  if (input.moralisPossibleSpam === true) {
    reasonCodes.push("moralisPossibleSpam");
  }

  if (input.moralisVerifiedContract === true) {
    reasonCodes.push("moralisVerifiedContract");
  }

  if (!input.hasReliableAlchemyPrice) {
    reasonCodes.push("alchemyMissingPrice");
  }

  if (!input.hasLogo) {
    reasonCodes.push("missingLogo");
  }

  if (!input.hasMetadata) {
    reasonCodes.push("missingMetadata");
  }

  if (hasSuspiciousMetadata(input)) {
    reasonCodes.push("suspiciousSymbol");
  }

  if (input.isDustValue) {
    reasonCodes.push("zeroOrDustValue");
  }

  if (input.isKnownProtocolAsset) {
    reasonCodes.push(options.knownProtocolReasonCode ?? "knownProtocolContract");
  }

  if (input.hasReliableAlchemyPrice) {
    reasonCodes.push("hasReliablePrice");
  }

  if (
    !input.isKnownProtocolAsset &&
    input.moralisVerifiedContract !== true &&
    input.hasReliableAlchemyPrice !== true
  ) {
    reasonCodes.push("unrecognizedContract");
  }

  return dedupeTrustReasonCodes(reasonCodes);
}

function getStatusAndVisibility(
  input: AssetTrustClassifierInput,
  options: ClassifyWalletAssetTrustOptions,
): Pick<TokenTrustClassification, "trustStatus" | "isHiddenByDefault"> {
  const suspiciousMetadata = hasSuspiciousMetadata(input);
  const metadataWeak = !input.hasMetadata || suspiciousMetadata;
  const noProviderTrustSignal =
    input.moralisPossibleSpam === null && input.moralisVerifiedContract === null;

  if (options.isBlockedByPolicy) {
    return {
      trustStatus: "blocked",
      isHiddenByDefault: true,
    };
  }

  if (input.moralisPossibleSpam === true) {
    return {
      trustStatus: "possible_spam",
      isHiddenByDefault: true,
    };
  }

  if (input.isKnownProtocolAsset) {
    return {
      trustStatus: "known_protocol",
      isHiddenByDefault: false,
    };
  }

  if (input.moralisVerifiedContract === true && input.hasReliableAlchemyPrice) {
    return {
      trustStatus: "verified",
      isHiddenByDefault: false,
    };
  }

  if (input.hasReliableAlchemyPrice && !metadataWeak) {
    return {
      trustStatus: "priced",
      isHiddenByDefault: false,
    };
  }

  if (input.isDustValue && !input.hasMetadata && !input.hasReliableAlchemyPrice) {
    return {
      trustStatus: "low_confidence",
      isHiddenByDefault: true,
    };
  }

  if (metadataWeak && !input.hasReliableAlchemyPrice) {
    return {
      trustStatus: "low_confidence",
      isHiddenByDefault: true,
    };
  }

  if (noProviderTrustSignal && !input.hasReliableAlchemyPrice) {
    return {
      trustStatus: "unknown",
      isHiddenByDefault: false,
    };
  }

  return {
    trustStatus: input.moralisVerifiedContract === true ? "verified" : "trusted",
    isHiddenByDefault: false,
  };
}

export function classifyWalletAssetTrust(
  input: AssetTrustClassifierInput,
  options: ClassifyWalletAssetTrustOptions = {},
): TokenTrustClassification {
  const { trustStatus, isHiddenByDefault } = getStatusAndVisibility(input, options);
  const trustReasonCodes = buildReasonCodes(input, options);

  return {
    trustStatus: trustStatus as TokenTrustStatus,
    trustReasonCodes,
    isHiddenByDefault,
    classifierVersion: input.classifierVersion,
  };
}
import { type FixtureSemantic } from "@/lib/fixture-loader";

export type SupportedMellowStrategyConfig = {
  wrapperAddress: string;
  stakingRewardsAddress: string | null;
};

function parseAddresses(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

export function getSupportedMellowStrategies(): SupportedMellowStrategyConfig[] {
  const wrappers = parseAddresses(process.env.MELLOW_WRAPPER_ADDRESSES);
  const stakingRewards = parseAddresses(process.env.MELLOW_STAKING_REWARDS_ADDRESSES);

  return wrappers.map((wrapperAddress, index) => ({
    wrapperAddress,
    stakingRewardsAddress: stakingRewards[index] ?? null
  }));
}

export function isSupportedMellowAddress(address: string | null | undefined) {
  if (!address) {
    return false;
  }

  const normalized = address.toLowerCase();
  return getSupportedMellowStrategies().some(
    (strategy) =>
      strategy.wrapperAddress === normalized || strategy.stakingRewardsAddress === normalized
  );
}

export function findSupportedMellowStrategy(addresses: Array<string | null | undefined>) {
  const normalized = addresses
    .filter((value): value is string => Boolean(value))
    .map((value) => value.toLowerCase());

  return (
    getSupportedMellowStrategies().find(
      (strategy) =>
        normalized.includes(strategy.wrapperAddress) ||
        (strategy.stakingRewardsAddress != null && normalized.includes(strategy.stakingRewardsAddress))
    ) ?? null
  );
}

export function isMellowSemantic(semantic: FixtureSemantic | null) {
  return semantic?.protocol === "mellow";
}

export function getMellowAction(semantic: FixtureSemantic | null) {
  if (!semantic || semantic.protocol !== "mellow") {
    return null;
  }

  return semantic.action;
}
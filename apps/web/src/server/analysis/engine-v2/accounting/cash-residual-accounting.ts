import type { EngineV2DomainEventLike } from "./chronological-accounting";

export type EngineV2CashFlowProjection = {
  eventId: string | null;
  flowKind: "cash_in" | "cash_out" | "swap_in" | "swap_out" | "gas_fee" | "unresolved";
  tokenAddress: string | null;
  amountRaw: string | null;
  valueUsdAtEvent: string | null;
  txHash: string;
  occurredAt: Date;
  coverageStatus: string;
  reasonCodes: string[];
};

export type EngineV2ResidualInventoryProjection = {
  tokenAddress: string;
  amountRaw: string;
  coverageStatus: string;
  reasonCodes: string[];
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asSignedBigInt(value: string | null, direction: "in" | "out") {
  if (!value) return 0n;
  try {
    const parsed = BigInt(value);
    return direction === "in" ? parsed : -parsed;
  } catch {
    return 0n;
  }
}

function movementEntries(event: EngineV2DomainEventLike): Array<{
  direction: "in" | "out";
  tokenAddress: string | null;
  amountRaw: string | null;
  valueUsdAtEvent: string | null;
}> {
  const evidence = asRecord(event.evidenceJson);
  const metadata = asRecord(event.metadataJson);
  const movements = Array.isArray(evidence.movements) ? evidence.movements : Array.isArray(metadata.movements) ? metadata.movements : [];
  return movements
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item))
    .map((item) => ({
      direction: item.direction === "out" || item.directionIn === false ? "out" : "in",
      tokenAddress: asString(item.tokenAddress),
      amountRaw: asString(item.amountRaw) ?? asString(item.amount),
      valueUsdAtEvent: asString(item.valueUsdAtEvent) ?? asString(item.amountUsd),
    }));
}

export function accountCashAndResidualInventory(input: { events: EngineV2DomainEventLike[] }) {
  const cashFlows: EngineV2CashFlowProjection[] = [];
  const residualByToken = new Map<string, { amount: bigint; reasonCodes: Set<string> }>();

  const addResidual = (tokenAddress: string | null, amountRaw: string | null, direction: "in" | "out", reasonCodes: string[]) => {
    if (!tokenAddress) return;
    const key = tokenAddress.toLowerCase();
    const current = residualByToken.get(key) ?? { amount: 0n, reasonCodes: new Set<string>() };
    current.amount += asSignedBigInt(amountRaw, direction);
    for (const code of reasonCodes) current.reasonCodes.add(code);
    residualByToken.set(key, current);
  };

  for (const event of input.events) {
    const movements = movementEntries(event);
    if (event.eventType.startsWith("cash_in") || event.eventType === "native_transfer_in") {
      for (const movement of movements.length ? movements : [{ direction: "in" as const, tokenAddress: null, amountRaw: null, valueUsdAtEvent: null }]) {
        cashFlows.push({
          eventId: event.id ?? null,
          flowKind: "cash_in",
          tokenAddress: movement.tokenAddress,
          amountRaw: movement.amountRaw,
          valueUsdAtEvent: movement.valueUsdAtEvent,
          txHash: event.txHash,
          occurredAt: event.occurredAt,
          coverageStatus: event.coverageStatus,
          reasonCodes: event.reasonCodes,
        });
        addResidual(movement.tokenAddress, movement.amountRaw, "in", event.reasonCodes);
      }
      continue;
    }
    if (event.eventType.startsWith("cash_out") || event.eventType === "native_transfer_out") {
      for (const movement of movements.length ? movements : [{ direction: "out" as const, tokenAddress: null, amountRaw: null, valueUsdAtEvent: null }]) {
        cashFlows.push({
          eventId: event.id ?? null,
          flowKind: "cash_out",
          tokenAddress: movement.tokenAddress,
          amountRaw: movement.amountRaw,
          valueUsdAtEvent: movement.valueUsdAtEvent,
          txHash: event.txHash,
          occurredAt: event.occurredAt,
          coverageStatus: event.coverageStatus,
          reasonCodes: event.reasonCodes,
        });
        addResidual(movement.tokenAddress, movement.amountRaw, "out", event.reasonCodes);
      }
      continue;
    }
    if (event.eventFamily === "swap" || event.eventType.startsWith("swap")) {
      for (const movement of movements) {
        const flowKind = movement.direction === "in" ? "swap_in" : "swap_out";
        cashFlows.push({
          eventId: event.id ?? null,
          flowKind,
          tokenAddress: movement.tokenAddress,
          amountRaw: movement.amountRaw,
          valueUsdAtEvent: movement.valueUsdAtEvent,
          txHash: event.txHash,
          occurredAt: event.occurredAt,
          coverageStatus: event.coverageStatus,
          reasonCodes: event.reasonCodes,
        });
        addResidual(movement.tokenAddress, movement.amountRaw, movement.direction, event.reasonCodes);
      }
      if (movements.length === 0) {
        cashFlows.push({
          eventId: event.id ?? null,
          flowKind: "unresolved",
          tokenAddress: null,
          amountRaw: null,
          valueUsdAtEvent: null,
          txHash: event.txHash,
          occurredAt: event.occurredAt,
          coverageStatus: "unresolved",
          reasonCodes: [...new Set([...event.reasonCodes, "missing_asset_movements"])],
        });
      }
    }
  }

  const residualInventory = [...residualByToken.entries()]
    .filter(([, item]) => item.amount !== 0n)
    .map(([tokenAddress, item]): EngineV2ResidualInventoryProjection => ({
      tokenAddress,
      amountRaw: item.amount.toString(),
      coverageStatus: item.reasonCodes.size > 0 ? "partial" : "full",
      reasonCodes: [...item.reasonCodes],
    }));

  return { cashFlows, residualInventory };
}

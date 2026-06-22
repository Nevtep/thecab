import type { EngineV2DomainEventLike, EngineV2EntityLinkLike } from "./chronological-accounting";

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
  poolId: string | null;
  sourceWithdrawalId: string | null;
  sourceEventId: string | null;
  status: "open";
  consumedByEventIds: string[];
  valueUsdAtEvent: string | null;
  coverageStatus: string;
  reasonCodes: string[];
};

export type EngineV2ResidualLotProjection = {
  residualId: string;
  poolId: string | null;
  sourceWithdrawalId: string | null;
  sourceEventId: string | null;
  tokenAddress: string;
  originalAmountRaw: string;
  openAmountRaw: string;
  originalValueUsdAtEvent: string | null;
  openValueUsdAtEvent: string | null;
  status: "open" | "consumed";
  openedAt: Date;
  consumedAt: Date | null;
  consumedByEventIds: string[];
  coverageStatus: string;
  reasonCodes: string[];
};

export type EngineV2RebalanceProjection = {
  rebalanceId: string;
  poolId: string;
  sourceWithdrawalId: string;
  withdrawalEventId: string | null;
  swapEventIds: string[];
  depositEventId: string;
  withdrawnCapitalUsd: string | null;
  redeployedCapitalUsd: string | null;
  capitalDeltaUsd: string | null;
  occurredAt: Date;
  txHash: string;
  coverageStatus: string;
  confidence: string;
  reasonCodes: string[];
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.length > 0) : [];
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

function metadataPoolId(event: EngineV2DomainEventLike) {
  const metadata = asRecord(event.metadataJson);
  return asString(metadata.poolId) ?? asString(metadata.primaryPoolId) ?? asString(metadata.resolvedPoolId);
}

function poolIdsForEvent(links: EngineV2EntityLinkLike[], event: EngineV2DomainEventLike) {
  const ids = new Set<string>();
  const explicit = metadataPoolId(event);
  if (explicit) ids.add(explicit);
  if (event.id) {
    for (const link of links) {
      if (link.domainEventId === event.id && link.entityType === "pool") {
        ids.add(link.entityId);
      }
    }
  }
  return [...ids];
}

function isProtocolWithdrawal(event: EngineV2DomainEventLike) {
  const source = `${event.eventFamily} ${event.eventType}`.toLowerCase();
  return (source.includes("deposit") || source.includes("strategy"))
    && (source.includes("withdraw") || source.includes("decrease") || source.includes("close") || source.includes("burn") || source.includes("unstake"));
}

function isProtocolDeployment(event: EngineV2DomainEventLike) {
  const source = `${event.eventFamily} ${event.eventType}`.toLowerCase();
  return (source.includes("deposit") || source.includes("strategy"))
    && (source.includes("deposit") || source.includes("increase") || source.includes("open") || source.includes("mint") || source.includes("created") || source.includes("stake"));
}

function subtractStringNumbers(left: string | null, right: string | null) {
  if (!left || !right) return null;
  const result = Number(right) - Number(left);
  return Number.isFinite(result) ? String(result) : null;
}

type ResidualLotState = {
  residualId: string;
  poolId: string | null;
  sourceWithdrawalId: string | null;
  sourceEventId: string | null;
  tokenAddress: string;
  originalAmount: bigint;
  openAmount: bigint;
  originalValueUsdAtEvent: string | null;
  openValueUsdAtEvent: string | null;
  openedAt: Date;
  consumedAt: Date | null;
  consumedByEventIds: string[];
  consumedBySwapEventIds: string[];
  coverageStatus: string;
  reasonCodes: Set<string>;
};

export function accountCashAndResidualInventory(input: { events: EngineV2DomainEventLike[]; links?: EngineV2EntityLinkLike[] }) {
  const cashFlows: EngineV2CashFlowProjection[] = [];
  const residualByToken = new Map<string, { amount: bigint; reasonCodes: Set<string> }>();
  const residualLots: ResidualLotState[] = [];
  const rebalances = new Map<string, EngineV2RebalanceProjection>();

  const addResidual = (tokenAddress: string | null, amountRaw: string | null, direction: "in" | "out", reasonCodes: string[]) => {
    if (!tokenAddress) return;
    const key = tokenAddress.toLowerCase();
    const current = residualByToken.get(key) ?? { amount: 0n, reasonCodes: new Set<string>() };
    current.amount += asSignedBigInt(amountRaw, direction);
    for (const code of reasonCodes) current.reasonCodes.add(code);
    residualByToken.set(key, current);
  };

  const addResidualLot = (inputLot: {
    event: EngineV2DomainEventLike;
    movement: ReturnType<typeof movementEntries>[number];
    poolId: string | null;
    sourceWithdrawalId: string | null;
    inheritedConsumedByEventIds?: string[];
    inheritedSwapEventIds?: string[];
    inheritedReasonCodes?: string[];
    inheritedOriginalAmount?: bigint;
    inheritedOriginalValueUsdAtEvent?: string | null;
  }) => {
    if (!inputLot.movement.tokenAddress || !inputLot.movement.amountRaw) return;
    let amount: bigint;
    try {
      amount = BigInt(inputLot.movement.amountRaw);
    } catch {
      return;
    }
    if (amount <= 0n) return;
    const sourceWithdrawalId = inputLot.sourceWithdrawalId ?? inputLot.event.id ?? null;
    residualLots.push({
      residualId: [
        "residual",
        sourceWithdrawalId ?? inputLot.event.txHash,
        inputLot.poolId ?? "unresolved",
        inputLot.movement.tokenAddress.toLowerCase(),
        residualLots.length,
      ].join(":"),
      poolId: inputLot.poolId,
      sourceWithdrawalId,
      sourceEventId: inputLot.event.id ?? null,
      tokenAddress: inputLot.movement.tokenAddress.toLowerCase(),
      originalAmount: inputLot.inheritedOriginalAmount ?? amount,
      openAmount: amount,
      originalValueUsdAtEvent: inputLot.inheritedOriginalValueUsdAtEvent ?? inputLot.movement.valueUsdAtEvent,
      openValueUsdAtEvent: inputLot.movement.valueUsdAtEvent,
      openedAt: inputLot.event.occurredAt,
      consumedAt: null,
      consumedByEventIds: [...(inputLot.inheritedConsumedByEventIds ?? [])],
      consumedBySwapEventIds: [...(inputLot.inheritedSwapEventIds ?? [])],
      coverageStatus: inputLot.event.coverageStatus,
      reasonCodes: new Set([...(inputLot.inheritedReasonCodes ?? []), ...inputLot.event.reasonCodes]),
    });
  };

  const consumeResidualLots = (inputConsumption: {
    event: EngineV2DomainEventLike;
    movement: ReturnType<typeof movementEntries>[number];
    candidatePoolId?: string | null;
    markSwap: boolean;
  }) => {
    if (!inputConsumption.movement.tokenAddress || !inputConsumption.movement.amountRaw) return [];
    let remaining: bigint;
    try {
      remaining = BigInt(inputConsumption.movement.amountRaw);
    } catch {
      return [];
    }
    if (remaining <= 0n) return [];
    const tokenAddress = inputConsumption.movement.tokenAddress.toLowerCase();
    const consumed: Array<{ lot: ResidualLotState; amount: bigint; valueUsdAtEvent: string | null }> = [];
    for (const lot of residualLots) {
      if (remaining <= 0n) break;
      if (lot.openAmount <= 0n || lot.tokenAddress !== tokenAddress) continue;
      if (inputConsumption.candidatePoolId && lot.poolId && lot.poolId !== inputConsumption.candidatePoolId) continue;
      const amount = lot.openAmount < remaining ? lot.openAmount : remaining;
      lot.openAmount -= amount;
      remaining -= amount;
      if (inputConsumption.event.id && !lot.consumedByEventIds.includes(inputConsumption.event.id)) {
        lot.consumedByEventIds.push(inputConsumption.event.id);
      }
      if (inputConsumption.markSwap && inputConsumption.event.id && !lot.consumedBySwapEventIds.includes(inputConsumption.event.id)) {
        lot.consumedBySwapEventIds.push(inputConsumption.event.id);
      }
      if (lot.openAmount === 0n) {
        lot.consumedAt = inputConsumption.event.occurredAt;
      }
      consumed.push({ lot, amount, valueUsdAtEvent: inputConsumption.movement.valueUsdAtEvent });
    }
    return consumed;
  };

  for (const event of input.events) {
    const movements = movementEntries(event);
    const eventPoolIds = poolIdsForEvent(input.links ?? [], event);
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
        consumeResidualLots({ event, movement, candidatePoolId: null, markSwap: false });
      }
      continue;
    }
    if (event.eventFamily === "swap" || event.eventType.startsWith("swap")) {
      const consumedBySwap = movements
        .filter((movement) => movement.direction === "out")
        .flatMap((movement) => consumeResidualLots({ event, movement, candidatePoolId: null, markSwap: true }));
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
      const sourceLotsByKey = new Map<string, ResidualLotState>();
      for (const consumed of consumedBySwap) {
        const key = `${consumed.lot.sourceWithdrawalId ?? ""}:${consumed.lot.poolId ?? ""}`;
        if (consumed.lot.sourceWithdrawalId && consumed.lot.poolId && !sourceLotsByKey.has(key)) {
          sourceLotsByKey.set(key, consumed.lot);
        }
      }
      if (sourceLotsByKey.size === 1) {
        const sourceLot = [...sourceLotsByKey.values()][0]!;
        for (const movement of movements.filter((item) => item.direction === "in")) {
          addResidualLot({
            event,
            movement,
            poolId: sourceLot.poolId,
            sourceWithdrawalId: sourceLot.sourceWithdrawalId,
            inheritedConsumedByEventIds: sourceLot.consumedByEventIds,
            inheritedSwapEventIds: sourceLot.consumedBySwapEventIds,
            inheritedReasonCodes: [...sourceLot.reasonCodes],
            inheritedOriginalAmount: sourceLot.originalAmount,
            inheritedOriginalValueUsdAtEvent: sourceLot.originalValueUsdAtEvent,
          });
        }
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
      continue;
    }

    if (isProtocolWithdrawal(event)) {
      const poolId = eventPoolIds.length === 1 ? eventPoolIds[0]! : null;
      for (const movement of movements.filter((item) => item.direction === "in")) {
        addResidualLot({
          event,
          movement,
          poolId,
          sourceWithdrawalId: event.id ?? null,
        });
      }
      continue;
    }

    if (isProtocolDeployment(event)) {
      const poolId = eventPoolIds.length === 1 ? eventPoolIds[0]! : null;
      for (const movement of movements.filter((item) => item.direction === "out")) {
        const consumed = consumeResidualLots({ event, movement, candidatePoolId: poolId, markSwap: false });
        for (const entry of consumed) {
          if (!entry.lot.poolId || !poolId || entry.lot.poolId !== poolId || !entry.lot.sourceWithdrawalId || !event.id) {
            continue;
          }
          const rebalanceId = `rebalance:${entry.lot.sourceWithdrawalId}:${event.id}`;
          const current = rebalances.get(rebalanceId);
          const redeployedCapitalUsd = entry.valueUsdAtEvent ?? current?.redeployedCapitalUsd ?? null;
          rebalances.set(rebalanceId, {
            rebalanceId,
            poolId,
            sourceWithdrawalId: entry.lot.sourceWithdrawalId,
            withdrawalEventId: entry.lot.sourceEventId,
            swapEventIds: entry.lot.consumedBySwapEventIds,
            depositEventId: event.id,
            withdrawnCapitalUsd: entry.lot.originalValueUsdAtEvent,
            redeployedCapitalUsd,
            capitalDeltaUsd: subtractStringNumbers(entry.lot.originalValueUsdAtEvent, redeployedCapitalUsd),
            occurredAt: event.occurredAt,
            txHash: event.txHash,
            coverageStatus: event.coverageStatus === "full" && entry.lot.coverageStatus === "full" ? "full" : "partial",
            confidence: event.confidence,
            reasonCodes: [...new Set([...entry.lot.reasonCodes, ...event.reasonCodes])],
          });
        }
      }
    }
  }

  const residualLotProjections = residualLots
    .map((lot): EngineV2ResidualLotProjection => ({
      residualId: lot.residualId,
      poolId: lot.poolId,
      sourceWithdrawalId: lot.sourceWithdrawalId,
      sourceEventId: lot.sourceEventId,
      tokenAddress: lot.tokenAddress,
      originalAmountRaw: lot.originalAmount.toString(),
      openAmountRaw: lot.openAmount.toString(),
      originalValueUsdAtEvent: lot.originalValueUsdAtEvent,
      openValueUsdAtEvent: lot.openAmount === lot.originalAmount ? lot.openValueUsdAtEvent : null,
      status: lot.openAmount === 0n ? "consumed" : "open",
      openedAt: lot.openedAt,
      consumedAt: lot.consumedAt,
      consumedByEventIds: asStringArray(lot.consumedByEventIds),
      coverageStatus: lot.coverageStatus,
      reasonCodes: [...lot.reasonCodes],
    }));

  const residualInventory = residualLotProjections
    .filter((lot) => lot.status === "open" && lot.openAmountRaw !== "0")
    .map((lot): EngineV2ResidualInventoryProjection => ({
      tokenAddress: lot.tokenAddress,
      amountRaw: lot.openAmountRaw,
      poolId: lot.poolId,
      sourceWithdrawalId: lot.sourceWithdrawalId,
      sourceEventId: lot.sourceEventId,
      status: "open",
      consumedByEventIds: lot.consumedByEventIds,
      valueUsdAtEvent: lot.openValueUsdAtEvent,
      coverageStatus: lot.coverageStatus,
      reasonCodes: lot.reasonCodes,
    }));

  if (residualInventory.length === 0) {
    for (const [tokenAddress, item] of residualByToken.entries()) {
      if (item.amount === 0n) continue;
      residualInventory.push({
        tokenAddress,
        amountRaw: item.amount.toString(),
        poolId: null,
        sourceWithdrawalId: null,
        sourceEventId: null,
        status: "open",
        consumedByEventIds: [],
        valueUsdAtEvent: null,
        coverageStatus: item.reasonCodes.size > 0 ? "partial" : "full",
        reasonCodes: [...item.reasonCodes, "missing_explicit_pool_evidence"],
      });
    }
  }

  return { cashFlows, residualInventory, residualLots: residualLotProjections, rebalances: [...rebalances.values()] };
}

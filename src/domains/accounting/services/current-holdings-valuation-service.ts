import Decimal from "decimal.js";

import { type CurrentHoldingValuation, type ValuedMovement } from "@/domains/accounting/model/valued-movement";
import { PriceSelectionService } from "@/domains/pricing/services/price-selection-service";
import { PriceNormalizationService } from "@/domains/pricing/services/price-normalization-service";
import { type PriceProvider } from "@/domains/pricing/contracts/price-provider";
import { PricePointRepository } from "@/domains/pricing/repositories/price-point-repository";

type InventoryState = {
  amount: Decimal;
  costBasisUsd: Decimal;
  tokenAddress: string;
  symbol: string | null;
  traceLedgerRecordIds: Set<string>;
};

type ScopeInventories = Map<string, Map<string, InventoryState>>;

function getOrCreateInventory(container: Map<string, InventoryState>, tokenAddress: string, symbol: string | null) {
  const current = container.get(tokenAddress);
  if (current) {
    return current;
  }

  const created: InventoryState = {
    amount: new Decimal(0),
    costBasisUsd: new Decimal(0),
    tokenAddress,
    symbol,
    traceLedgerRecordIds: new Set<string>()
  };
  container.set(tokenAddress, created);
  return created;
}

function getOrCreateScopeInventory(container: ScopeInventories, scopeKey: string) {
  const current = container.get(scopeKey);
  if (current) {
    return current;
  }

  const created = new Map<string, InventoryState>();
  container.set(scopeKey, created);
  return created;
}

function debitInventory(state: InventoryState, quantity: Decimal) {
  if (state.amount.lte(0) || quantity.lte(0)) {
    state.amount = Decimal.max(new Decimal(0), state.amount.minus(quantity));
    if (state.amount.eq(0)) {
      state.costBasisUsd = new Decimal(0);
    }
    return new Decimal(0);
  }

  const removable = Decimal.min(quantity, state.amount);
  const averageCost = state.amount.gt(0) ? state.costBasisUsd.div(state.amount) : new Decimal(0);
  const removedCost = averageCost.mul(removable);
  state.amount = state.amount.minus(removable);
  state.costBasisUsd = Decimal.max(new Decimal(0), state.costBasisUsd.minus(removedCost));
  return removedCost;
}

function isStrategyMovement(movement: ValuedMovement) {
  return Boolean(movement.poolId && movement.strategyId && movement.positionInstanceId);
}

function isExternalCapitalEvent(eventType: string) {
  return eventType === "external_deposit" || eventType === "external_withdrawal";
}

export class CurrentHoldingsValuationService {
  private readonly selectionService = new PriceSelectionService();
  private readonly normalizationService = new PriceNormalizationService();

  constructor(
    private readonly pricePointRepository: PricePointRepository,
    private readonly priceProvider: PriceProvider
  ) {}

  async valueCurrentHoldings(input: {
    chainId: number;
    asOf: Date;
    movements: ValuedMovement[];
    residuals: Array<{
      residualHoldingId: string;
      tokenAddress: string;
      symbol: string | null;
      amountRaw: string;
      decimals: number;
      candidatePoolIds: string[];
      latestSourceLedgerRecordId: string | null;
      reasonCode: string;
    }>;
  }) {
    const scopeInventories: ScopeInventories = new Map();
    const idleInventories = new Map<string, InventoryState>();
    const residualHoldings = new Map<string, InventoryState>();

    const movements = [...input.movements].sort(
      (left, right) => left.timestamp.getTime() - right.timestamp.getTime()
    );

    for (const movement of movements) {
      const amount = new Decimal(movement.amount);
      const eventValueUsd = movement.eventValueUsd ? new Decimal(movement.eventValueUsd) : new Decimal(0);
      const idleInventory = getOrCreateInventory(idleInventories, movement.tokenAddress, movement.symbol);
      idleInventory.traceLedgerRecordIds.add(movement.ledgerRecordId);

      if (isExternalCapitalEvent(movement.eventType)) {
        if (movement.direction === "in") {
          idleInventory.amount = idleInventory.amount.plus(amount);
          idleInventory.costBasisUsd = idleInventory.costBasisUsd.plus(eventValueUsd);
        } else {
          debitInventory(idleInventory, amount);
        }
        continue;
      }

      if (isStrategyMovement(movement) && movement.movementRole === "principal") {
        const scopeKeys = [
          `pool:${movement.poolId}`,
          `strategy:${movement.strategyId}`,
          `position:${movement.positionInstanceId}`
        ];

        if (movement.direction === "out") {
          for (const scopeKey of scopeKeys) {
            const scopeInventory = getOrCreateScopeInventory(scopeInventories, scopeKey);
            const inventory = getOrCreateInventory(scopeInventory, movement.tokenAddress, movement.symbol);
            inventory.amount = inventory.amount.plus(amount);
            inventory.costBasisUsd = inventory.costBasisUsd.plus(eventValueUsd);
            inventory.traceLedgerRecordIds.add(movement.ledgerRecordId);
          }

          debitInventory(idleInventory, amount);
          continue;
        }

        let transferredCostBasis = new Decimal(0);
        for (const scopeKey of scopeKeys) {
          const scopeInventory = getOrCreateScopeInventory(scopeInventories, scopeKey);
          const inventory = getOrCreateInventory(scopeInventory, movement.tokenAddress, movement.symbol);
          const removedCost = debitInventory(inventory, amount);
          inventory.traceLedgerRecordIds.add(movement.ledgerRecordId);
          if (scopeKey.startsWith("position:")) {
            transferredCostBasis = removedCost;
          }
        }

        idleInventory.amount = idleInventory.amount.plus(amount);
        idleInventory.costBasisUsd = idleInventory.costBasisUsd.plus(transferredCostBasis);
        continue;
      }

      if (movement.direction === "in") {
        idleInventory.amount = idleInventory.amount.plus(amount);
        idleInventory.costBasisUsd = idleInventory.costBasisUsd.plus(eventValueUsd);
      } else {
        debitInventory(idleInventory, amount);
      }
    }

    for (const residual of input.residuals) {
      const tokenAddress = residual.tokenAddress.toLowerCase();
      const amount = new Decimal(residual.amountRaw).div(new Decimal(10).pow(residual.decimals));
      const state = getOrCreateInventory(residualHoldings, residual.residualHoldingId, residual.symbol);
      state.amount = state.amount.plus(amount);

      if (residual.latestSourceLedgerRecordId) {
        for (const [scopeKey, scopeInventory] of scopeInventories.entries()) {
          if (!scopeKey.startsWith("position:")) {
            continue;
          }

          const inventory = scopeInventory.get(tokenAddress);
          if (!inventory || !inventory.traceLedgerRecordIds.has(residual.latestSourceLedgerRecordId)) {
            continue;
          }

          const removedCost = debitInventory(inventory, amount);
          state.costBasisUsd = state.costBasisUsd.plus(removedCost);
          state.traceLedgerRecordIds.add(residual.latestSourceLedgerRecordId);
          break;
        }
      }
    }

    const currentPricePoints = new Map<
      string,
      {
        pricePointId: string | null;
        priceUsd: Decimal | null;
        coverage: ReturnType<PriceSelectionService["selectCurrentPricePoint"]>["coverage"];
      }
    >();

    const resolveCurrentPrice = async (tokenAddress: string, symbol: string | null) => {
      const existing = currentPricePoints.get(tokenAddress);
      if (existing) {
        return existing;
      }

      const normalizedAsset = this.normalizationService.normalizeAsset({
        chainId: input.chainId,
        tokenAddress,
        symbol,
        decimals: null
      });
      const asset = await this.pricePointRepository.upsertPriceAsset(normalizedAsset);
      let point = await this.pricePointRepository.findFreshCurrentPricePoint({
        priceAssetId: asset.priceAssetId,
        minFetchedAt: new Date(input.asOf.getTime() - 30 * 60_000)
      });

      if (!point) {
        const providerQuote = await this.priceProvider.getCurrentPrice({
          asset: this.normalizationService.buildProviderAssetRef({
            chainId: input.chainId,
            tokenAddress: normalizedAsset.tokenAddress,
            symbol: normalizedAsset.symbol,
            providerAssetKey: normalizedAsset.providerAssetKey
          }),
          asOf: input.asOf
        });

        if (providerQuote) {
          point = await this.pricePointRepository.upsertPricePoint(
            this.normalizationService.normalizeProviderQuote({
              priceAssetId: asset.priceAssetId,
              quote: providerQuote,
              pricingMethod: this.normalizationService.determinePricingMethod({
                symbol: normalizedAsset.symbol,
                providerAssetKey: normalizedAsset.providerAssetKey
              })
            })
          );
        }
      }

      const selection = this.selectionService.selectCurrentPricePoint({
        subjectId: tokenAddress,
        point: point
          ? {
              pricePointId: point.pricePointId,
              fetchedAt: point.fetchedAt
            }
          : null,
        asOf: input.asOf
      });

      const resolved = {
        pricePointId: point?.pricePointId ?? null,
        priceUsd: point ? new Decimal(point.priceValue) : null,
        coverage: selection.coverage
      };
      currentPricePoints.set(tokenAddress, resolved);
      return resolved;
    };

    const valuations: CurrentHoldingValuation[] = [];

    for (const [scopeKey, scopeInventory] of scopeInventories.entries()) {
      for (const inventory of scopeInventory.values()) {
        if (inventory.amount.lte(0)) {
          continue;
        }

        const resolved = await resolveCurrentPrice(inventory.tokenAddress, inventory.symbol);
        valuations.push({
          holdingType: "position",
          subjectId: scopeKey,
          poolId: scopeKey.startsWith("pool:") ? scopeKey.slice(5) : null,
          strategyId: scopeKey.startsWith("strategy:") ? scopeKey.slice(9) : null,
          positionInstanceId: scopeKey.startsWith("position:") ? scopeKey.slice(9) : null,
          tokenAddress: inventory.tokenAddress,
          symbol: inventory.symbol,
          amount: inventory.amount.toString(),
          costBasisUsd: inventory.costBasisUsd.toString(),
          currentValueUsd: resolved.priceUsd ? inventory.amount.mul(resolved.priceUsd).toString() : null,
          pricePointId: resolved.pricePointId,
          coverage: {
            ...resolved.coverage,
            subjectType: "holding_balance",
            subjectId: scopeKey
          },
          traceLedgerRecordIds: [...inventory.traceLedgerRecordIds]
        });
      }
    }

    for (const inventory of idleInventories.values()) {
      if (inventory.amount.lte(0)) {
        continue;
      }

      const resolved = await resolveCurrentPrice(inventory.tokenAddress, inventory.symbol);
      valuations.push({
        holdingType: "idle_balance",
        subjectId: `idle:${inventory.tokenAddress}`,
        poolId: null,
        strategyId: null,
        positionInstanceId: null,
        tokenAddress: inventory.tokenAddress,
        symbol: inventory.symbol,
        amount: inventory.amount.toString(),
        costBasisUsd: inventory.costBasisUsd.toString(),
        currentValueUsd: resolved.priceUsd ? inventory.amount.mul(resolved.priceUsd).toString() : null,
        pricePointId: resolved.pricePointId,
        coverage: {
          ...resolved.coverage,
          subjectType: "holding_balance",
          subjectId: `idle:${inventory.tokenAddress}`
        },
        traceLedgerRecordIds: [...inventory.traceLedgerRecordIds]
      });
    }

    for (const [residualHoldingId, inventory] of residualHoldings.entries()) {
      if (inventory.amount.lte(0)) {
        continue;
      }

      const resolved = await resolveCurrentPrice(inventory.tokenAddress, inventory.symbol);
      valuations.push({
        holdingType: "residual_holding",
        subjectId: residualHoldingId,
        poolId: null,
        strategyId: null,
        positionInstanceId: null,
        tokenAddress: inventory.tokenAddress,
        symbol: inventory.symbol,
        amount: inventory.amount.toString(),
        costBasisUsd: inventory.costBasisUsd.toString(),
        currentValueUsd: resolved.priceUsd ? inventory.amount.mul(resolved.priceUsd).toString() : null,
        pricePointId: resolved.pricePointId,
        coverage: {
          ...resolved.coverage,
          subjectType: "holding_balance",
          subjectId: residualHoldingId
        },
        traceLedgerRecordIds: [...inventory.traceLedgerRecordIds]
      });
    }

    return {
      valuations,
      currentPricePoints
    };
  }
}
import { getCurrentRulesetMetadata } from "@/domains/ledger/heuristics/registry";
import { type ResidualHoldingSnapshot } from "@/domains/ledger/model/analysis-session-state";
import { AnalysisSessionStateRepository } from "@/domains/ledger/repositories/analysis-session-state-repository";
import { LedgerProjectionService } from "@/domains/ledger/projections/ledger-projection-service";
import { LedgerOutputRepository } from "@/domains/ledger/repositories/ledger-output-repository";
import { ReconstructionRunRepository } from "@/domains/ledger/repositories/reconstruction-run-repository";
import { RawObservationRepository } from "@/domains/ledger/repositories/raw-observation-repository";
import { resolveAcceptedRunChain } from "@/domains/ledger/services/accepted-run-chain";
import { AccountingExclusionService } from "@/domains/accounting/services/accounting-exclusion-service";
import { CurrentHoldingsValuationService } from "@/domains/accounting/services/current-holdings-valuation-service";
import { PortfolioAccountingService } from "@/domains/accounting/services/portfolio-accounting-service";
import { ScopeAccountingService } from "@/domains/accounting/services/scope-accounting-service";
import { ValuedMovementService } from "@/domains/accounting/services/valued-movement-service";
import { PricePointRepository } from "@/domains/pricing/repositories/price-point-repository";
import { HttpPriceProvider } from "@/domains/pricing/services/http-price-provider";
import { SessionRepository } from "@/domains/wallet-session/repositories/session-repository";

const ACCOUNTING_CONTRACT_VERSION = "1.0.0";

function usd(amount: string) {
  return {
    currency: "usd" as const,
    amount
  };
}

export class AccountingSnapshotService {
  private readonly exclusionService = new AccountingExclusionService();
  private readonly priceProvider = new HttpPriceProvider();
  private readonly portfolioAccountingService = new PortfolioAccountingService();
  private readonly scopeAccountingService = new ScopeAccountingService();

  constructor(
    private readonly sessionRepository: SessionRepository,
    private readonly reconstructionRunRepository: ReconstructionRunRepository,
    private readonly ledgerOutputRepository: LedgerOutputRepository,
    private readonly pricePointRepository: PricePointRepository,
    private readonly rawObservationRepository: RawObservationRepository,
    private readonly analysisSessionStateRepository: AnalysisSessionStateRepository
  ) {}

  async getSnapshotInputs(analysisSessionId: string) {
    const session = await this.sessionRepository.findById(analysisSessionId);
    const acceptedRuns = resolveAcceptedRunChain(
      await this.reconstructionRunRepository.listAcceptedBySession(analysisSessionId)
    );
    const acceptedRun = acceptedRuns.at(-1) ?? null;

    if (!session || !acceptedRun || acceptedRun.status !== "accepted") {
      return null;
    }

    const acceptedRunIds = acceptedRuns.map((run) => run.reconstructionRunId);

    const [records, sessionState, discarded] = await Promise.all([
      this.ledgerOutputRepository.listCanonicalLedgerRecordsByRuns(acceptedRunIds),
      this.analysisSessionStateRepository.findBySession(analysisSessionId),
      this.ledgerOutputRepository.listDiscardedActivityByRuns(acceptedRunIds)
    ]);
    const movements = await this.ledgerOutputRepository.listAssetMovementsByLedgerRecordIds(
      records.map((record) => record.ledgerRecordId)
    );

    return {
      session,
      acceptedRun,
      records,
      movements,
      residuals: (sessionState?.residualHoldings ?? []) as ResidualHoldingSnapshot[],
      discarded
    };
  }

  async getEmptySnapshot(analysisSessionId: string) {
    const metadata = getCurrentRulesetMetadata();
    return {
      contractVersion: ACCOUNTING_CONTRACT_VERSION,
      sessionId: analysisSessionId,
      acceptedRunId: "",
      asOf: new Date().toISOString(),
      quoteCurrency: "usd" as const,
      totalValue: usd("0"),
      capitalEntered: usd("0"),
      capitalWithdrawn: usd("0"),
      realizedPnl: usd("0"),
      unrealizedPnl: usd("0"),
      idleBalanceValue: usd("0"),
      coverageSummary: this.exclusionService.buildCoverageSummary({
        pricedValueUsd: "0",
        excludedValueUsd: null,
        reasonCodes: [],
        unpricedComponentsCount: 0
      }),
      pools: [],
      idleBalances: [],
      traceRefs: {
        ledgerRecordIds: [],
        pricePointIds: []
      },
      classifierVersion: metadata.classifierVersion,
      heuristicsVersion: metadata.heuristicsVersion
    };
  }

  async getLatestSnapshot(analysisSessionId: string) {
    const inputs = await this.getSnapshotInputs(analysisSessionId);
    if (!inputs) {
      return this.getEmptySnapshot(analysisSessionId);
    }

    const movementsByRecordId = new Map(
      inputs.records.map((record) => [record.ledgerRecordId, inputs.movements.filter((movement) => movement.ledgerRecordId === record.ledgerRecordId)])
    );
    const valuedMovements = await new ValuedMovementService(this.pricePointRepository, this.priceProvider).valueMovements({
      records: inputs.records.map((record) => ({
        ledgerRecordId: record.ledgerRecordId,
        poolId: record.poolId,
        strategyId: record.strategyId,
        positionInstanceId: record.positionInstanceId,
        txHash: record.txHash,
        timestamp: record.timestamp,
        eventType: record.eventType
      })),
      movementsByRecordId,
      chainId: inputs.session.chainId
    });

    const currentHoldingsResult = await new CurrentHoldingsValuationService(
      this.pricePointRepository,
      this.priceProvider
    ).valueCurrentHoldings({
      chainId: inputs.session.chainId,
      asOf: new Date(),
      movements: valuedMovements,
      residuals: inputs.residuals.map((residual) => ({
        residualHoldingId: residual.residualHoldingId,
        tokenAddress: residual.tokenAddress,
        symbol: residual.symbol,
        amountRaw: residual.amountRaw,
        decimals: residual.decimals,
        candidatePoolIds: residual.candidatePoolIds,
        latestSourceLedgerRecordId: residual.latestSourceLedgerRecordId,
        reasonCode: residual.reasonCode
      }))
    });

    const projection = await new LedgerProjectionService(
      this.sessionRepository,
      this.reconstructionRunRepository,
      this.ledgerOutputRepository,
      this.rawObservationRepository,
      this.analysisSessionStateRepository
    ).getLatestProjection(analysisSessionId);

    const poolSummaries = this.scopeAccountingService.buildScopeSummaries({
      projection: {
        pools: projection.pools.map((pool) => ({
          poolId: pool.poolId,
          displayName: pool.displayName,
          strategies: pool.strategies.map((strategy) => ({
            strategyId: strategy.strategyId,
            strategyType: strategy.strategyType,
            positions: strategy.positions.map((position) => ({
              positionInstanceId: position.positionInstanceId,
              positionType: position.positionType
            }))
          }))
        }))
      },
      records: inputs.records,
      movements: valuedMovements,
      currentHoldings: currentHoldingsResult.valuations,
      residuals: inputs.residuals.map((residual) => ({
        latestSourceLedgerRecordId: residual.latestSourceLedgerRecordId,
        candidatePoolIds: residual.candidatePoolIds
      }))
    });

    const snapshot = this.portfolioAccountingService.buildPortfolioSnapshot({
      contractVersion: ACCOUNTING_CONTRACT_VERSION,
      sessionId: analysisSessionId,
      acceptedRunId: inputs.acceptedRun.reconstructionRunId,
      asOf: new Date(),
      movements: valuedMovements,
      currentHoldings: currentHoldingsResult.valuations,
      discarded: inputs.discarded,
      poolSummaries
    });

    return {
      ...snapshot,
      classifierVersion: inputs.acceptedRun.classifierVersion,
      heuristicsVersion: inputs.acceptedRun.heuristicsVersion
    };
  }

  async primePriceAsset(input: {
    chainId: number;
    tokenAddress: string;
    symbol: string | null;
    decimals: number | null;
    providerAssetKey: string | null;
    aliasTargetAssetId: string | null;
    pricingStatus: "direct" | "alias" | "unsupported";
  }) {
    return this.pricePointRepository.upsertPriceAsset(input);
  }
}
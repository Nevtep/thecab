import { buildResidualHoldingId } from "@/domains/ledger/model/ids";
import { type ResidualHolding } from "@/domains/residual-holdings/model/residual-holding";
import { type FixtureSemantic } from "@/lib/fixture-loader";

export class ResidualHoldingService {
  build(input: {
    reconstructionRunId: string;
    semantic: FixtureSemantic;
    poolAddressToId: Map<string, string>;
    latestSourceLedgerRecordId: string | null;
  }): ResidualHolding[] {
    return (input.semantic.residuals ?? []).map((residual) => ({
      residualHoldingId: buildResidualHoldingId(
        input.reconstructionRunId,
        residual.tokenAddress,
        `${input.semantic.action}:${residual.reasonCode}:${residual.amountRaw}`
      ),
      reconstructionRunId: input.reconstructionRunId,
      tokenAddress: residual.tokenAddress,
      symbol: residual.symbol ?? null,
      amountRaw: residual.amountRaw,
      decimals: residual.decimals,
      attributionConfidence: residual.attributionConfidence.toFixed(4),
      candidatePoolIds: (residual.candidatePoolAddresses ?? []).map(
        (poolAddress) => input.poolAddressToId.get(poolAddress.toLowerCase()) ?? poolAddress.toLowerCase()
      ),
      latestSourceLedgerRecordId: input.latestSourceLedgerRecordId,
      reasonCode: residual.reasonCode
    }));
  }
}
import { buildPositionInstanceId } from "@/domains/ledger/model/ids";
import { type PositionStatus } from "@/domains/ledger/model/position-instance";
import { type FixtureSemantic } from "@/lib/fixture-loader";

export type ManualPositionState = {
  positionInstanceId: string;
  tokenId: string;
  status: PositionStatus;
  identityReference: string;
};

export class ManualPositionLifecycleService {
  resolve(input: {
    semantic: FixtureSemantic;
    strategyId: string;
    state: Map<string, ManualPositionState>;
  }) {
    const tokenId = input.semantic.tokenId;
    if (!tokenId) {
      return null;
    }

    const existing = input.state.get(tokenId);
    if (input.semantic.action === "mint" || !existing) {
      const created: ManualPositionState = {
        positionInstanceId: buildPositionInstanceId(input.strategyId, tokenId),
        tokenId,
        status: "open",
        identityReference: tokenId
      };
      input.state.set(tokenId, created);
      return created;
    }

    if (input.semantic.action === "decreaseLiquidity") {
      existing.status = "partially_reduced";
    }

    if (input.semantic.action === "closePosition") {
      existing.status = "closed";
    }

    return existing;
  }
}
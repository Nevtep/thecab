import { buildAssetMovementId } from "@/domains/ledger/model/ids";
import { type FixtureSemantic } from "@/lib/fixture-loader";

export class AssetMovementService {
  build(input: { ledgerRecordId: string; semantic: FixtureSemantic }) {
    return (input.semantic.assetMovements ?? []).map((movement, index) => ({
      assetMovementId: buildAssetMovementId(input.ledgerRecordId, movement.tokenAddress, index),
      ledgerRecordId: input.ledgerRecordId,
      tokenAddress: movement.tokenAddress,
      symbol: movement.symbol ?? null,
      amountRaw: movement.amountRaw,
      decimals: movement.decimals,
      direction: movement.direction,
      movementRole: movement.movementRole
    }));
  }
}
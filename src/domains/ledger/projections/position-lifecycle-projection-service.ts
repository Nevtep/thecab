type PositionRecord = {
  positionInstanceId: string | null;
  eventType: string;
  txHash: string;
  timestamp: Date;
};

export class PositionLifecycleProjectionService {
  buildPositionStatus(records: PositionRecord[]) {
    const latest = records.at(-1);
    if (!latest) {
      return "archived" as const;
    }

    if (latest.eventType === "manual_position_closed") {
      return "closed" as const;
    }

    if (
      latest.eventType === "manual_liquidity_removed" ||
      latest.eventType === "mellow_exposure_decreased"
    ) {
      return "partially_reduced" as const;
    }

    return "open" as const;
  }
}
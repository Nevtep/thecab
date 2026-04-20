import { type PriceCoverageDecision } from "@/domains/pricing/model/price-point";

const MINUTE_MS = 60_000;

export class PriceSelectionService {
  selectHistoricalPricePoint(input: {
    subjectId: string;
    eventTimestamp: Date;
    point:
      | {
          pricePointId: string;
          effectiveAt: Date;
          confidence: string;
        }
      | null;
    maxLookbackMinutes?: number;
  }) {
    const maxLookbackMinutes = input.maxLookbackMinutes ?? 120;
    if (!input.point) {
      return {
        pricePoint: null,
        coverage: this.buildCoverage(input.subjectId, "unpriced", "missing_historical_price", false, null)
      };
    }

    const ageMs = input.eventTimestamp.getTime() - input.point.effectiveAt.getTime();
    const fallbackUsed = ageMs > 15 * MINUTE_MS;
    if (ageMs > maxLookbackMinutes * MINUTE_MS) {
      return {
        pricePoint: null,
        coverage: this.buildCoverage(input.subjectId, "unpriced", "historical_price_out_of_window", true, null)
      };
    }

    return {
      pricePoint: input.point,
      coverage: this.buildCoverage(
        input.subjectId,
        "priced",
        fallbackUsed ? "historical_price_fallback_window" : "historical_price_direct",
        fallbackUsed,
        input.point.pricePointId
      )
    };
  }

  selectCurrentPricePoint(input: {
    subjectId: string;
    point:
      | {
          pricePointId: string;
          fetchedAt: Date;
        }
      | null;
    asOf: Date;
    maxAgeMinutes?: number;
  }) {
    const maxAgeMinutes = input.maxAgeMinutes ?? 30;
    if (!input.point) {
      return {
        pricePoint: null,
        coverage: this.buildCoverage(input.subjectId, "unpriced", "missing_current_price", false, null)
      };
    }

    const ageMs = input.asOf.getTime() - input.point.fetchedAt.getTime();
    if (ageMs > maxAgeMinutes * MINUTE_MS) {
      return {
        pricePoint: null,
        coverage: this.buildCoverage(input.subjectId, "partial", "stale_current_price", true, input.point.pricePointId)
      };
    }

    return {
      pricePoint: input.point,
      coverage: this.buildCoverage(input.subjectId, "priced", "current_price_direct", false, input.point.pricePointId)
    };
  }

  private buildCoverage(
    subjectId: string,
    coverageStatus: PriceCoverageDecision["coverageStatus"],
    reasonCode: string,
    fallbackUsed: boolean,
    pricePointId: string | null
  ): PriceCoverageDecision {
    return {
      subjectType: "asset_movement",
      subjectId,
      coverageStatus,
      reasonCode,
      reasonMessage: reasonCode.replaceAll("_", " "),
      pricePointId,
      fallbackUsed
    };
  }
}
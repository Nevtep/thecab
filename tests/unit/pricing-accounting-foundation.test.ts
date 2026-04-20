import { PriceNormalizationService } from "@/domains/pricing/services/price-normalization-service";
import { PriceSelectionService } from "@/domains/pricing/services/price-selection-service";

describe("pricing and accounting foundation", () => {
  it("normalizes wrapped and stable aliases deterministically", () => {
    const service = new PriceNormalizationService();

    expect(
      service.normalizeAsset({
        chainId: 8453,
        tokenAddress: "0xWETH",
        symbol: "WETH",
        decimals: 18
      })
    ).toMatchObject({
      tokenAddress: "0xweth",
      providerAssetKey: "eth",
      pricingStatus: "alias"
    });

    expect(
      service.normalizeAsset({
        chainId: 8453,
        tokenAddress: "0xUSDC",
        symbol: "USDC",
        decimals: 6
      })
    ).toMatchObject({
      tokenAddress: "0xusdc",
      providerAssetKey: "usd-coin",
      pricingStatus: "alias"
    });
  });

  it("marks stale current prices as partial coverage", () => {
    const service = new PriceSelectionService();
    const asOf = new Date("2026-04-19T12:00:00.000Z");
    const result = service.selectCurrentPricePoint({
      subjectId: "0xweth",
      asOf,
      point: {
        pricePointId: "price_point_1",
        fetchedAt: new Date("2026-04-19T11:00:00.000Z")
      }
    });

    expect(result.pricePoint).toBeNull();
    expect(result.coverage.coverageStatus).toBe("partial");
    expect(result.coverage.reasonCode).toBe("stale_current_price");
  });
});
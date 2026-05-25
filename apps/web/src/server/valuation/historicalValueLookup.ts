export type HistoricalValuationComponent = {
  token0Address: string;
  token1Address: string;
  token0Amount: number | null;
  token1Amount: number | null;
};

export function buildHistoricalComponentValueLookup(input: {
  bucketKeys: string[];
  seriesByToken: Map<string, Map<string, number>>;
  components: HistoricalValuationComponent[];
}) {
  const valueByBucket = new Map<string, number | null>();
  let hasPartialHistory = false;

  for (const bucketKey of input.bucketKeys) {
    let valueUsd = 0;
    let hasAnyValue = false;

    for (const component of input.components) {
      if (component.token0Amount !== null) {
        const price0 = input.seriesByToken.get(component.token0Address)?.get(bucketKey);
        if (price0 === undefined) {
          hasPartialHistory = true;
        } else {
          valueUsd += component.token0Amount * price0;
          hasAnyValue = true;
        }
      } else {
        hasPartialHistory = true;
      }

      if (component.token1Amount !== null) {
        const price1 = input.seriesByToken.get(component.token1Address)?.get(bucketKey);
        if (price1 === undefined) {
          hasPartialHistory = true;
        } else {
          valueUsd += component.token1Amount * price1;
          hasAnyValue = true;
        }
      } else {
        hasPartialHistory = true;
      }
    }

    valueByBucket.set(bucketKey, hasAnyValue ? valueUsd : null);
  }

  return {
    valueByBucket,
    hasPartialHistory,
  };
}
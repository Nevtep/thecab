import { AccountingExclusionService } from "@/domains/accounting/services/accounting-exclusion-service";

export class AccountingCoverageService {
  private readonly exclusionService = new AccountingExclusionService();

  buildSummary(input: {
    pricedValueUsd: string;
    excludedValueUsd?: string | null;
    reasonCodes?: string[];
    unpricedComponentsCount?: number;
  }) {
    return this.exclusionService.buildCoverageSummary(input);
  }
}
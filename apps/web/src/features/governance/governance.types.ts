import type { GovernanceFilters, GovernanceResponse } from "@/server/governance/governance.types";

export type GovernanceUrlState = Omit<GovernanceFilters, "activeChips">;

export type GovernanceViewModel = GovernanceResponse;

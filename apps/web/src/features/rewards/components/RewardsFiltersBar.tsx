"use client";

import { CabButton, CabDataPanel, CabInput, CabStack, CabText } from "@/design-system";
import {
  REWARDS_COVERAGE_OPTIONS,
  REWARDS_DATE_PRESET_OPTIONS,
  REWARDS_SOURCE_OPTIONS,
} from "@/features/rewards/rewards.filters";
import type { RewardsUrlState, RewardsViewModel } from "@/features/rewards/rewards.types";

import styles from "@/features/rewards/RewardsWorkspace.module.css";

type Props = {
  state: RewardsUrlState;
  viewModel: RewardsViewModel | null;
  labels: {
    searchPlaceholder: string;
    source: string;
    token: string;
    pool: string;
    rewardType: string;
    coverage: string;
    all: string;
    clearAll: string;
    getDatePreset: (value: string) => string;
    getSource: (value: string) => string;
    getCoverage: (value: string) => string;
  };
  onStateChange: (state: RewardsUrlState) => void;
  onClearFilter: (target: string) => void;
  onClearAll: () => void;
};

export function RewardsFiltersBar({ state, viewModel, labels, onStateChange, onClearFilter, onClearAll }: Props) {
  return (
    <CabDataPanel>
      <CabStack row className={styles.filtersBar}>
        <CabInput
          className={styles.searchInput}
          aria-label={labels.searchPlaceholder}
          placeholder={labels.searchPlaceholder}
          value={state.search}
          controlSize="sm"
          onChangeText={(search) => onStateChange({ ...state, search, page: 1 })}
        />
        <CabStack row className={styles.segment}>
          {REWARDS_DATE_PRESET_OPTIONS.filter((preset) => preset !== "custom").map((preset) => (
            <CabButton
              key={preset}
              tone={state.datePreset === preset ? "technical" : "ghost"}
              controlSize="sm"
              onPress={() => onStateChange({ ...state, datePreset: preset, page: 1 })}
            >
              {labels.getDatePreset(preset)}
            </CabButton>
          ))}
        </CabStack>
        <select
          className={styles.select}
          aria-label={labels.source}
          value={state.source}
          onChange={(event) => onStateChange({ ...state, source: event.target.value as RewardsUrlState["source"], page: 1 })}
        >
          {REWARDS_SOURCE_OPTIONS.map((source) => (
            <option key={source} value={source}>{labels.getSource(source)}</option>
          ))}
        </select>
        <select
          className={styles.select}
          aria-label={labels.token}
          value={state.tokenAddress ?? "all"}
          onChange={(event) => onStateChange({ ...state, tokenAddress: event.target.value === "all" ? null : event.target.value, page: 1 })}
        >
          <option value="all">{labels.all}</option>
          {(viewModel?.availableFilters.tokens ?? []).map((token) => (
            <option key={token.tokenAddress} value={token.tokenAddress}>{token.symbol ?? token.tokenAddress}</option>
          ))}
        </select>
        <select
          className={styles.select}
          aria-label={labels.pool}
          value={state.poolId ?? "all"}
          onChange={(event) => onStateChange({ ...state, poolId: event.target.value === "all" ? null : event.target.value, page: 1 })}
        >
          <option value="all">{labels.all}</option>
          {(viewModel?.availableFilters.pools ?? []).map((pool) => (
            <option key={pool.poolId} value={pool.poolId}>{pool.label}</option>
          ))}
        </select>
        <select
          className={styles.select}
          aria-label={labels.rewardType}
          value={state.rewardType ?? "all"}
          onChange={(event) => onStateChange({ ...state, rewardType: event.target.value === "all" ? null : event.target.value, page: 1 })}
        >
          <option value="all">{labels.all}</option>
          {(viewModel?.availableFilters.rewardTypes ?? []).map((rewardType) => (
            <option key={rewardType} value={rewardType}>{rewardType}</option>
          ))}
        </select>
        <select
          className={styles.select}
          aria-label={labels.coverage}
          value={state.coverage ?? "all"}
          onChange={(event) => onStateChange({
            ...state,
            coverage: event.target.value === "all" ? null : event.target.value as NonNullable<RewardsUrlState["coverage"]>,
            page: 1,
          })}
        >
          {REWARDS_COVERAGE_OPTIONS.map((coverage) => (
            <option key={coverage} value={coverage}>{coverage === "all" ? labels.all : labels.getCoverage(coverage)}</option>
          ))}
        </select>
        <CabButton tone="ghost" controlSize="sm" onPress={onClearAll}>{labels.clearAll}</CabButton>
        {viewModel?.filters.activeChips.length ? (
          <CabStack row className={styles.chips}>
            {viewModel.filters.activeChips.map((chip) => (
              <button key={chip.id} className={styles.chip} type="button" onClick={() => onClearFilter(chip.removeTarget)}>
                <CabText fontSize={12}>{chip.value}</CabText>
              </button>
            ))}
          </CabStack>
        ) : null}
      </CabStack>
    </CabDataPanel>
  );
}

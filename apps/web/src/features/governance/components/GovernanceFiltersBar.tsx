"use client";

import { CabButton, CabDataPanel, CabInput, CabStack, CabText } from "@/design-system";
import type { GovernanceUrlState, GovernanceViewModel } from "@/features/governance/governance.types";

import styles from "@/features/governance/GovernanceWorkspace.module.css";

type FilterOption = {
  value: string;
  label: string;
};

type AvailableFilters = {
  eventTypes?: string[];
  rewardTypes?: string[];
  protocolSurfaces?: string[];
  epochs?: Array<{ epochId: string; label: string }>;
  tokens?: Array<{ address: string | null; symbol: string }>;
};

type Props = {
  state: GovernanceUrlState;
  viewModel: GovernanceViewModel | null;
  labels: {
    searchPlaceholder: string;
    datePreset: string;
    eventType: string;
    rewardType: string;
    protocolSurface: string;
    epoch: string;
    token: string;
    coverage: string;
    confidence: string;
    all: string;
    clearAll: string;
    getDatePreset: (value: string) => string;
    getEvent: (value: string) => string;
    getRewardType: (value: string) => string;
    getSurface: (value: string) => string;
    getCoverage: (value: string) => string;
    getConfidence: (value: string) => string;
  };
  onStateChange: (state: GovernanceUrlState) => void;
  onClearFilter: (target: string) => void;
  onClearAll: () => void;
};

const datePresetOptions: Array<GovernanceUrlState["datePreset"]> = ["all", "7d", "30d", "90d", "1y"];
const coverageOptions: Array<NonNullable<GovernanceUrlState["coverage"]> | "all"> = ["all", "full", "partial", "unresolved", "unsupported", "excluded", "unavailable"];
const confidenceOptions: Array<NonNullable<GovernanceUrlState["confidence"]> | "all"> = ["all", "high", "medium", "low", "none"];

function asAvailableFilters(viewModel: GovernanceViewModel | null): AvailableFilters {
  return (viewModel?.availableFilters ?? {}) as AvailableFilters;
}

function uniqueOptions(values: string[] | undefined, getLabel: (value: string) => string): FilterOption[] {
  return Array.from(new Set(values ?? []))
    .filter((value) => value.trim().length > 0)
    .sort((left, right) => getLabel(left).localeCompare(getLabel(right)))
    .map((value) => ({ value, label: getLabel(value) }));
}

function clearSelection(state: GovernanceUrlState): GovernanceUrlState {
  return {
    ...state,
    selectedKind: null,
    selectedGovernanceId: null,
  };
}

export function GovernanceFiltersBar({ state, viewModel, labels, onStateChange, onClearFilter, onClearAll }: Props) {
  const available = asAvailableFilters(viewModel);
  const eventOptions = uniqueOptions(available.eventTypes, labels.getEvent);
  const rewardOptions = uniqueOptions(available.rewardTypes, labels.getRewardType);
  const surfaceOptions = uniqueOptions(available.protocolSurfaces, labels.getSurface);
  const epochOptions = (available.epochs ?? []).map((epoch) => ({ value: epoch.epochId, label: epoch.label }));
  const tokenOptions = (available.tokens ?? [])
    .filter((token) => token.address)
    .map((token) => ({ value: token.address!, label: token.symbol }));

  return (
    <CabDataPanel>
      <CabStack row className={styles.filtersBar}>
        <CabInput
          className={styles.searchInput}
          aria-label={labels.searchPlaceholder}
          placeholder={labels.searchPlaceholder}
          value={state.search}
          controlSize="sm"
          onChangeText={(search) => onStateChange({ ...clearSelection(state), search, page: 1 })}
        />
        <select
          className={styles.select}
          aria-label={labels.datePreset}
          value={state.datePreset}
          onChange={(event) => onStateChange({ ...clearSelection(state), datePreset: event.target.value as GovernanceUrlState["datePreset"], page: 1 })}
        >
          {datePresetOptions.map((preset) => (
            <option key={preset} value={preset}>{preset === "all" ? labels.all : labels.getDatePreset(preset)}</option>
          ))}
        </select>
        <select
          className={styles.select}
          aria-label={labels.eventType}
          value={state.eventType}
          onChange={(event) => onStateChange({ ...clearSelection(state), eventType: event.target.value as GovernanceUrlState["eventType"], page: 1 })}
        >
          <option value="all">{labels.all}</option>
          {eventOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <select
          className={styles.select}
          aria-label={labels.rewardType}
          value={state.rewardType}
          onChange={(event) => onStateChange({ ...clearSelection(state), rewardType: event.target.value as GovernanceUrlState["rewardType"], page: 1 })}
        >
          <option value="all">{labels.all}</option>
          {rewardOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <select
          className={styles.select}
          aria-label={labels.protocolSurface}
          value={state.protocolSurface}
          onChange={(event) => onStateChange({ ...clearSelection(state), protocolSurface: event.target.value as GovernanceUrlState["protocolSurface"], page: 1 })}
        >
          <option value="all">{labels.all}</option>
          {surfaceOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <select
          className={styles.select}
          aria-label={labels.epoch}
          value={state.epochId ?? "all"}
          onChange={(event) => onStateChange({ ...clearSelection(state), epochId: event.target.value === "all" ? null : event.target.value, page: 1 })}
        >
          <option value="all">{labels.all}</option>
          {epochOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <select
          className={styles.select}
          aria-label={labels.token}
          value={state.tokenAddress ?? "all"}
          onChange={(event) => onStateChange({
            ...clearSelection(state),
            tokenAddress: event.target.value === "all" ? null : event.target.value,
            page: 1,
          })}
        >
          <option value="all">{labels.all}</option>
          {tokenOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <select
          className={styles.select}
          aria-label={labels.coverage}
          value={state.coverage ?? "all"}
          onChange={(event) => onStateChange({
            ...clearSelection(state),
            coverage: event.target.value === "all" ? null : event.target.value as NonNullable<GovernanceUrlState["coverage"]>,
            page: 1,
          })}
        >
          {coverageOptions.map((coverage) => (
            <option key={coverage} value={coverage}>{coverage === "all" ? labels.all : labels.getCoverage(coverage)}</option>
          ))}
        </select>
        <select
          className={styles.select}
          aria-label={labels.confidence}
          value={state.confidence ?? "all"}
          onChange={(event) => onStateChange({
            ...clearSelection(state),
            confidence: event.target.value === "all" ? null : event.target.value as NonNullable<GovernanceUrlState["confidence"]>,
            page: 1,
          })}
        >
          {confidenceOptions.map((confidence) => (
            <option key={confidence} value={confidence}>{confidence === "all" ? labels.all : labels.getConfidence(confidence)}</option>
          ))}
        </select>
        <CabButton tone="ghost" controlSize="sm" onPress={onClearAll}>{labels.clearAll}</CabButton>
        {viewModel?.filters.activeChips.length ? (
          <CabStack row className={styles.chips}>
            {viewModel.filters.activeChips.map((chip) => (
              <button key={chip.id} className={styles.chip} type="button" onClick={() => onClearFilter(chip.removeTarget)}>
                <CabText variant="caption" fontSize={12}>{chip.value}</CabText>
              </button>
            ))}
          </CabStack>
        ) : null}
      </CabStack>
    </CabDataPanel>
  );
}

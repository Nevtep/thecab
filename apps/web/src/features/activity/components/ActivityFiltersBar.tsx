"use client";

import { CabButton, CabDataPanel, CabInput, CabStack, CabText } from "@/design-system";
import type { ActivityUrlState, ActivityViewModel } from "@/features/activity/activity.types";

import styles from "@/features/activity/ActivityWorkspace.module.css";

type Props = {
  state: ActivityUrlState;
  viewModel: ActivityViewModel | null;
  labels: {
    searchPlaceholder: string;
    surface: string;
    action: string;
    coverage: string;
    confidence: string;
    all: string;
    clearAll: string;
    getSurface: (value: string) => string;
    getAction: (value: string) => string;
    getCoverage: (value: string) => string;
    getConfidence: (value: string) => string;
  };
  onStateChange: (state: ActivityUrlState) => void;
  onClearFilter: (target: string) => void;
  onClearAll: () => void;
};

const coverageOptions: Array<NonNullable<ActivityUrlState["coverage"]> | "all"> = ["all", "full", "partial", "unresolved", "excluded", "unavailable"];
const confidenceOptions: Array<NonNullable<ActivityUrlState["confidence"]> | "all"> = ["all", "high", "medium", "low", "none"];

export function ActivityFiltersBar({ state, viewModel, labels, onStateChange, onClearFilter, onClearAll }: Props) {
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
        <select
          className={styles.select}
          aria-label={labels.surface}
          value={state.surface}
          onChange={(event) => onStateChange({ ...state, surface: event.target.value as ActivityUrlState["surface"], page: 1 })}
        >
          <option value="all">{labels.all}</option>
          {(viewModel?.availableFilters.surfaces ?? []).map((surface) => (
            <option key={surface} value={surface}>{labels.getSurface(surface)}</option>
          ))}
        </select>
        <select
          className={styles.select}
          aria-label={labels.action}
          value={state.action}
          onChange={(event) => onStateChange({ ...state, action: event.target.value as ActivityUrlState["action"], page: 1 })}
        >
          <option value="all">{labels.all}</option>
          {(viewModel?.availableFilters.actions ?? []).map((action) => (
            <option key={action} value={action}>{labels.getAction(action)}</option>
          ))}
        </select>
        <select
          className={styles.select}
          aria-label={labels.coverage}
          value={state.coverage ?? "all"}
          onChange={(event) => onStateChange({
            ...state,
            coverage: event.target.value === "all" ? null : event.target.value as NonNullable<ActivityUrlState["coverage"]>,
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
            ...state,
            confidence: event.target.value === "all" ? null : event.target.value as NonNullable<ActivityUrlState["confidence"]>,
            page: 1,
          })}
        >
          {confidenceOptions.map((confidence) => (
            <option key={confidence} value={confidence}>{confidence === "all" ? labels.all : labels.getConfidence(confidence)}</option>
          ))}
        </select>
        <CabButton tone="ghost" controlSize="sm" onPress={onClearAll}>{labels.clearAll}</CabButton>
        {viewModel?.activeChips.length ? (
          <CabStack row className={styles.chips}>
            {viewModel.activeChips.map((chip) => (
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

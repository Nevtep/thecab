"use client";

import { useTranslation } from "react-i18next";

import { CabBox, CabButton, CabErrorPanel, CabIcon, CabLoadingPanel, CabSectionHeader, CabStack, CabText } from "@/design-system";
import { ActivityEmptyState } from "@/features/activity/components/ActivityEmptyState";
import { ActivityEventsTable } from "@/features/activity/components/ActivityEventsTable";
import { ActivityFiltersBar } from "@/features/activity/components/ActivityFiltersBar";
import { ActivityInsightsPanel } from "@/features/activity/components/ActivityInsightsPanel";
import { ActivityKpiStrip } from "@/features/activity/components/ActivityKpiStrip";
import { SelectedActivityRail } from "@/features/activity/components/SelectedActivityRail";
import type { ActivityUrlState, ActivityViewModel } from "@/features/activity/activity.types";
import { formatCompactNumber, formatDateTime, formatTokenAmount, formatUsd } from "@/i18n/formatters";

import styles from "@/features/activity/ActivityWorkspace.module.css";

type Props = {
  screenState: "loading" | "locked" | "error" | "empty" | "ready";
  viewModel: ActivityViewModel | null;
  urlState: ActivityUrlState;
  errorCode: string | null;
  isRefreshing?: boolean;
  onRetry: () => void;
  onStateChange: (state: ActivityUrlState) => void;
  onClearFilter: (target: string) => void;
  onClearAll: () => void;
  onOpenHref: (href: string) => void;
};

function formatKpiValue(locale: string, kpi: ActivityViewModel["kpis"][number]) {
  const numeric = typeof kpi.value === "number" ? kpi.value : kpi.value === null ? null : Number(kpi.value);
  if (numeric === null || !Number.isFinite(numeric)) return "";
  if (kpi.valueKind === "currency") return formatUsd(numeric, locale);
  if (kpi.valueKind === "percent") return `${formatTokenAmount(numeric, locale, { maximumFractionDigits: 1 })}%`;
  return formatTokenAmount(numeric, locale, { maximumFractionDigits: 0 });
}

export function ActivityComponent(input: Props) {
  const { i18n, t } = useTranslation(["activity", "coverage", "common", "errors"]);

  if (input.screenState === "loading") {
    return <CabLoadingPanel label={t("activity:states.loadingTitle")} />;
  }

  if (input.screenState === "locked") {
    return (
      <ActivityEmptyState
        title={t("activity:locked.title")}
        description={t("activity:locked.description")}
      />
    );
  }

  if (input.screenState === "error") {
    return (
      <CabErrorPanel
        title={t("activity:states.errorTitle")}
        description={t(`errors:activity.${input.errorCode}`, { defaultValue: input.errorCode ?? "" })}
        retryLabel={t("activity:actions.refresh")}
        onRetry={input.onRetry}
      />
    );
  }

  if (!input.viewModel) {
    return (
      <CabStack className={styles.workspace}>
        <CabSectionHeader title={t("activity:title")} subtitle={t("activity:subtitle")} />
        <ActivityFiltersBar
          state={input.urlState}
          viewModel={input.viewModel}
          labels={{
            searchPlaceholder: t("activity:filters.searchPlaceholder"),
            surface: t("activity:filters.surface"),
            action: t("activity:filters.action"),
            coverage: t("activity:filters.coverage"),
            confidence: t("activity:filters.confidence"),
            all: t("common:all"),
            clearAll: t("common:clearAll"),
            getSurface: (value) => t(`activity:surfaces.${value}`, { defaultValue: value }),
            getAction: (value) => t(`activity:actions.${value}`, { defaultValue: value }),
            getCoverage: (value) => t(`coverage:level.${value}`, { defaultValue: value }),
            getConfidence: (value) => t(`activity:confidence.${value}`, { defaultValue: value }),
          }}
          onStateChange={input.onStateChange}
          onClearFilter={input.onClearFilter}
          onClearAll={input.onClearAll}
        />
        <ActivityEmptyState title={t("activity:empty.noEventsTitle")} description={t("activity:empty.noEventsDescription")} />
      </CabStack>
    );
  }

  const selectedActivityIsLoading = Boolean(
    input.isRefreshing &&
    input.urlState.selectedActivityId &&
    input.viewModel.selectedActivity?.activityId !== input.urlState.selectedActivityId,
  );

  return (
    <CabStack className={styles.workspace}>
      <CabSectionHeader
        title={t("activity:title")}
        subtitle={t("activity:subtitle")}
        actions={
          <CabStack row gap="$2" alignItems="center">
            <CabButton tone="ghost" controlSize="sm" onPress={input.onRetry}>
              <CabIcon name="refreshCcw" width={14} height={14} />
              <CabText variant="caption" fontSize={12}>{t("activity:actions.refresh")}</CabText>
            </CabButton>
          </CabStack>
        }
      />
      <ActivityKpiStrip
        kpis={input.viewModel.kpis}
        labels={{
          getLabel: (key) => t(key),
          formatValue: (kpi) => formatKpiValue(i18n.language, kpi),
          getMeta: (key) => key ? t(key) : null,
        }}
      />
      <ActivityFiltersBar
        state={input.urlState}
        viewModel={input.viewModel}
        labels={{
          searchPlaceholder: t("activity:filters.searchPlaceholder"),
          surface: t("activity:filters.surface"),
          action: t("activity:filters.action"),
          coverage: t("activity:filters.coverage"),
          confidence: t("activity:filters.confidence"),
          all: t("common:all"),
          clearAll: t("common:clearAll"),
          getSurface: (value) => t(`activity:surfaces.${value}`, { defaultValue: value }),
          getAction: (value) => t(`activity:actions.${value}`, { defaultValue: value }),
          getCoverage: (value) => t(`coverage:level.${value}`, { defaultValue: value }),
          getConfidence: (value) => t(`activity:confidence.${value}`, { defaultValue: value }),
        }}
        onStateChange={input.onStateChange}
        onClearFilter={input.onClearFilter}
        onClearAll={input.onClearAll}
      />
      <CabBox className={styles.dataView}>
        <CabStack className={styles.leftArea}>
          <ActivityInsightsPanel
            charts={input.viewModel.charts}
            labels={{
              timelineTitle: t("activity:charts.timelineTitle"),
              timelineSubtitle: t("activity:charts.timelineSubtitle"),
              coverageTitle: t("activity:charts.coverageTitle"),
              coverageSubtitle: t("activity:charts.coverageSubtitle"),
              totalEvents: t("activity:charts.totalEvents"),
              getCoverage: (value) => t(`coverage:level.${value}`, { defaultValue: value }),
              getSurface: (value) => t(`activity:surfaces.${value}`, { defaultValue: value }),
              formatCount: (value) => formatCompactNumber(value, i18n.language),
            }}
          />
          <ActivityEventsTable
            viewModel={input.viewModel}
            state={input.urlState}
            labels={{
              title: t("activity:panels.events"),
              date: t("activity:table.columns.dateTime"),
              action: t("activity:table.columns.action"),
              surface: t("activity:table.columns.surface"),
              movement: t("activity:table.columns.movement"),
              value: t("activity:table.columns.value"),
              coverage: t("activity:table.columns.coverage"),
              confidence: t("activity:table.columns.confidence"),
              tx: t("activity:table.columns.tx"),
              previous: t("common:previous"),
              next: t("common:next"),
              page: (page, totalPages) => t("common:pageIndicator", { page, totalPages }),
              rowsPerPage: t("common:rowsPerPage"),
              showing: (from, to, total) => t("common:showingRange", { from, to, total }),
              emptyTitle: t("activity:empty.filteredTitle"),
              emptyDescription: t("activity:empty.filteredDescription"),
              formatDateTime: (value) => formatDateTime(value, i18n.language),
              formatUsd: (value) => {
                const parsed = value === null ? null : Number(value);
                return parsed !== null && Number.isFinite(parsed) ? formatUsd(parsed, i18n.language) : "";
              },
              getAction: (value) => t(`activity:actions.${value}`, { defaultValue: value }),
              getSurface: (value) => t(`activity:surfaces.${value}`, { defaultValue: value }),
              getCoverage: (value) => t(`coverage:level.${value}`, { defaultValue: value }),
              getConfidence: (value) => t(`activity:confidence.${value}`, { defaultValue: value }),
              getReason: (value) => t(`activity:reasons.${value}`, { defaultValue: value }),
            }}
            loading={input.isRefreshing}
            onStateChange={input.onStateChange}
          />
        </CabStack>
        <SelectedActivityRail
          selectedActivity={input.viewModel.selectedActivity}
          loading={selectedActivityIsLoading}
          labels={{
            title: t("activity:panels.selectedActivity"),
            empty: t("activity:selected.empty"),
            loading: t("activity:selected.loading"),
            action: t("activity:selected.action"),
            surface: t("activity:selected.surface"),
            occurredAt: t("activity:selected.occurredAt"),
            txHash: t("activity:selected.txHash"),
            coverage: t("activity:selected.coverage"),
            confidence: t("activity:selected.confidence"),
            movements: t("activity:selected.movements"),
            linkedEntities: t("activity:selected.linkedEntities"),
            classificationEvidence: t("activity:selected.classificationEvidence"),
            coverageNotes: t("activity:selected.coverageNotes"),
            reasonCodes: t("activity:selected.reasonCodes"),
            noMovements: t("activity:selected.noMovements"),
            noLinkedEntities: t("activity:selected.noLinkedEntities"),
            classificationBasis: t("activity:selected.classificationBasis"),
            classificationMetadata: t("activity:selected.classificationMetadata"),
            noReasonCodes: t("activity:selected.noReasonCodes"),
            affectsTotals: t("activity:selected.affectsTotals"),
            yes: t("common:yes"),
            no: t("common:no"),
            open: t("common:viewDetails"),
            getAction: (value) => t(`activity:actions.${value}`, { defaultValue: value }),
            getSurface: (value) => t(`activity:surfaces.${value}`, { defaultValue: value }),
            getCoverage: (value) => t(`coverage:level.${value}`, { defaultValue: value }),
            getConfidence: (value) => t(`activity:confidence.${value}`, { defaultValue: value }),
            getReason: (value) => t(`activity:reasons.${value}`, { defaultValue: value }),
            getEntityKind: (value) => t(`activity:entityKinds.${value}`, { defaultValue: value }),
            formatDateTime: (value) => formatDateTime(value, i18n.language),
            formatAmount: (value) => {
              const parsed = value === null ? null : Number(value);
              return parsed !== null && Number.isFinite(parsed)
                ? formatTokenAmount(parsed, i18n.language, { maximumFractionDigits: 6 })
                : "";
            },
            formatUsd: (value) => {
              const parsed = value === null ? null : Number(value);
              return parsed !== null && Number.isFinite(parsed) ? formatUsd(parsed, i18n.language) : "";
            },
          }}
          onOpenHref={input.onOpenHref}
        />
      </CabBox>
    </CabStack>
  );
}

"use client";

import { CabBadge, CabCard, CabIcon, CabImpactMetricCard, CabStack, CabText } from "@/design-system";
import { cabColors } from "@/design-system/tokens";
import { StrategyCoverageNote } from "@/features/strategies/components/StrategyCoverageNote";
import { StrategyExposureSummary } from "@/features/strategies/components/StrategyExposureSummary";
import type { StrategyDetailView } from "@/features/strategies/strategies.types";
import { formatDateTime, formatUsd } from "@/i18n/formatters";

type StrategySelectedPanelProps = {
  chainId: number;
  locale: string;
  strategy: StrategyDetailView | null;
  labels: {
    exposureSummary: string;
    rewards: string;
    lifecycle: string;
    coverageNote: string;
    currentValue: string;
    shares: string;
    totalReturn: string;
    deposited: string;
    withdrawn: string;
    sharesReceived: string;
    sharesRedeemed: string;
    rewardsEmpty: string;
    rewardToken: string;
    rewardAmount: string;
    rewardValue: string;
    rewardClaimedAt: string;
    transaction: string;
    status: string;
    resolved: string;
    unresolved: string;
    lifecycleEmpty: string;
    openPool: string;
    openRewards?: string;
  };
  onOpenPool?: (poolId: string) => void;
  translate: (key: string, options?: { defaultValue?: string }) => string;
};

function formatNullableUsd(value: number | null, locale: string) {
  if (value === null) return "—";
  return formatUsd(value, locale);
}

function strategyActivityVisual(type: string) {
  if (type.includes("reward") || type.includes("claim")) {
    return { icon: "rewards" as const, color: cabColors.brand.cabGold };
  }
  if (type.includes("withdraw") || type.includes("unstake") || type.includes("redeem") || type.includes("close")) {
    return { icon: "arrowDownToLine" as const, color: cabColors.semantic.warning };
  }
  if (type.includes("deposit") || type.includes("stake") || type.includes("receive")) {
    return { icon: "arrowUpToLine" as const, color: cabColors.brand.signalTeal };
  }
  return { icon: "activity" as const, color: cabColors.brand.electricBlue };
}

function StrategyActivityGraph(input: {
  strategy: StrategyDetailView;
  locale: string;
  title: string;
  empty: string;
  translate: (key: string, options?: { defaultValue?: string }) => string;
}) {
  const events = [
    ...input.strategy.lifecycle.map((event) => ({
      id: `life:${event.id}`,
      type: event.eventType,
      occurredAt: event.occurredAt,
      valueUsd: event.usdValue,
      detail: event.txHash ? `${event.txHash.slice(0, 10)}...${event.txHash.slice(-6)}` : null,
      coverageReasonCodes: event.coverageReasonCodes,
    })),
    ...input.strategy.rewards.map((reward) => ({
      id: `reward:${reward.id}`,
      type: "strategy_claim",
      occurredAt: reward.claimedAt ?? "",
      valueUsd: reward.amountUsd,
      detail: [reward.amountFormatted, reward.tokenSymbol].filter(Boolean).join(" ") || reward.txHash,
      coverageReasonCodes: reward.coverageReasonCodes,
    })),
  ]
    .filter((event) => event.occurredAt)
    .sort((left, right) => left.occurredAt.localeCompare(right.occurredAt));

  return (
    <CabCard density="compact">
      <CabStack gap="$3">
        <CabText variant="label">{input.title}</CabText>
        {events.length === 0 ? (
          <CabText variant="caption" color={cabColors.text.muted}>{input.empty}</CabText>
        ) : (
          <CabStack gap="$2">
            {events.map((event, index) => {
              const visual = strategyActivityVisual(event.type);
              return (
                <CabStack
                  key={event.id}
                  row
                  gap="$3"
                  alignItems="center"
                  style={{
                    minHeight: 46,
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: `1px solid ${cabColors.surface.border}`,
                    background: `linear-gradient(90deg, ${visual.color}14, transparent 54%)`,
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      display: "grid",
                      placeItems: "center",
                      width: 30,
                      height: 30,
                      borderRadius: 999,
                      border: `1px solid ${visual.color}88`,
                      boxShadow: `0 0 18px ${visual.color}33`,
                      flex: "0 0 auto",
                    }}
                  >
                    <CabIcon name={visual.icon} size="sm" color={visual.color} />
                  </span>
                  <CabStack gap="$0.5" minWidth={0} flex={1}>
                    <CabText variant="label">
                      {input.translate(`strategies:lifecycle.eventTypes.${event.type}`, { defaultValue: event.type })}
                    </CabText>
                    <CabText variant="caption" color={cabColors.text.muted}>
                      {formatDateTime(event.occurredAt, input.locale)}
                    </CabText>
                  </CabStack>
                  <CabStack gap="$0.5" alignItems="flex-end">
                    <CabText variant="mono">{formatNullableUsd(event.valueUsd, input.locale)}</CabText>
                    <CabText variant="caption" color={cabColors.text.muted}>
                      {event.detail ?? `#${index + 1}`}
                    </CabText>
                  </CabStack>
                </CabStack>
              );
            })}
          </CabStack>
        )}
      </CabStack>
    </CabCard>
  );
}

export function StrategySelectedPanel({ chainId, locale, onOpenPool, strategy, labels, translate }: StrategySelectedPanelProps) {
  void chainId;
  void onOpenPool;
  if (!strategy) {
    return (
      <CabCard density="compact">
        <CabText variant="label">{translate("strategies:states.selectedMissingTitle")}</CabText>
      </CabCard>
    );
  }

  return (
    <CabStack gap="$3">
      <CabCard density="compact">
        <CabStack gap="$2">
          <CabText variant="heading">{strategy.strategyLabel}</CabText>
          <CabText variant="caption">{strategy.poolLabel ?? "—"}</CabText>
          <CabStack row gap="$2" flexWrap="wrap">
            <CabImpactMetricCard
              label={labels.currentValue}
              value={formatNullableUsd(strategy.displayValueUsd ?? strategy.currentEstimatedValueUsd, locale)}
              accentColor={cabColors.brand.signalTeal}
              iconName="coins"
              size="compact"
            />
            <CabImpactMetricCard
              label={labels.shares}
              value={`${strategy.currentSharesRaw} ${strategy.shareSymbol ?? ""}`.trim()}
              accentColor={cabColors.brand.electricBlue}
              iconName="pools"
              size="compact"
            />
            <CabImpactMetricCard
              label={labels.totalReturn}
              value={formatNullableUsd(strategy.totalReturnUsd, locale)}
              accentColor={cabColors.brand.cabGold}
              iconName="activity"
              size="compact"
            />
            <CabBadge size="sm" tone={strategy.coverageStatus === "full" ? "success" : "warning"}>
              {translate(`coverage:level.${strategy.coverageStatus}`)}
            </CabBadge>
            <CabBadge size="sm" tone={strategy.confidence === "high" ? "success" : "warning"}>
              {translate(`coverage:confidence.${strategy.confidence}`)}
            </CabBadge>
          </CabStack>
        </CabStack>
      </CabCard>
      <StrategyActivityGraph
        strategy={strategy}
        locale={locale}
        title={labels.lifecycle}
        empty={labels.lifecycleEmpty}
        translate={translate}
      />
      <StrategyExposureSummary
        strategy={strategy}
        locale={locale}
        labels={{
          title: labels.exposureSummary,
          deposited: labels.deposited,
          withdrawn: labels.withdrawn,
          sharesReceived: labels.sharesReceived,
          sharesRedeemed: labels.sharesRedeemed,
          currentShares: labels.shares,
          currentValue: labels.currentValue,
        }}
      />
      <StrategyCoverageNote
        note={strategy.coverageNote}
        label={labels.coverageNote}
        translate={translate}
      />
    </CabStack>
  );
}

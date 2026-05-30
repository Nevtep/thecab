"use client";

import type { PropsWithChildren, ReactNode } from "react";
import { Spinner } from "tamagui";

import { CabCard } from "@/design-system/primitives/CabCard";
import { CabStack } from "@/design-system/primitives/CabStack";
import { CabText } from "@/design-system/primitives/CabText";
import { cabColors } from "@/design-system/tokens";

export type CabChartFrameProps = PropsWithChildren<{
  title?: string;
  subtitle?: string;
  height?: number;
  actions?: ReactNode;
  notice?: string;
  footer?: ReactNode;
  loadingLabel?: string;
  /** Accessible name for the chart graphic */
  ariaLabel?: string;
  /** Screen-reader summary of the chart insight */
  summary?: string;
  /** Optional tabular data alternative */
  dataTable?: ReactNode;
}>;

export function CabChartFrame({
  title,
  subtitle,
  height = 280,
  actions, 
  notice,
  footer,
  loadingLabel,
  ariaLabel,
  summary,
  dataTable,
  children,
}: CabChartFrameProps) {
  const accessibleName = ariaLabel ?? title ?? "Chart";

  return (
    <CabCard density="default">
      <CabStack gap="$3">
        {title ? (
          <CabStack row justifyContent="space-between" alignItems="flex-start" gap="$3" flexWrap="wrap">
            <CabStack gap="$2" flex={1} minWidth={0}>
              <CabText variant="label" color={cabColors.text.primary} fontSize={15}>
                {title}
              </CabText>
              {subtitle ? (
                <CabText variant="caption" color={cabColors.text.muted} fontSize={12}>
                  {subtitle}
                </CabText>
              ) : null}
            </CabStack>
            {actions ? (
              <CabStack row justifyContent="flex-end" alignItems="center" flexShrink={0}>
                {actions}
              </CabStack>
            ) : null}
          </CabStack>
        ) : subtitle ? (
          <CabText variant="caption" color={cabColors.text.muted} fontSize={12}>
            {subtitle}
          </CabText>
        ) : null }
        {notice ? (
          <CabText variant="caption" color={cabColors.text.secondary} fontSize={12}>
            {notice}
          </CabText>
        ) : null}
        {summary ? (
          <p className="sr-only">{summary}</p>
        ) : null}
        <div
          role="img"
          aria-label={accessibleName}
          aria-busy={loadingLabel ? true : undefined}
          style={{
            width: "100%",
            height,
            position: "relative",
          }}
        >
          <div style={{ width: "100%", height: "100%", opacity: loadingLabel ? 0.42 : 1 }}>
            {children}
          </div>
          {loadingLabel ? (
            <div
              role="status"
              aria-live="polite"
              aria-busy="true"
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                pointerEvents: "none",
              }}
            >
              <CabCard density="default">
                <CabStack row alignItems="center" gap="$2">
                  <Spinner color={cabColors.brand.signalTeal} />
                  <CabText variant="caption" fontSize={12} color={cabColors.text.secondary}>
                    {loadingLabel}
                  </CabText>
                </CabStack>
              </CabCard>
            </div>
          ) : null}
        </div>
        {dataTable ? (
          <div className="sr-only" aria-hidden={false}>
            {dataTable}
          </div>
        ) : null}
        {footer ? footer : null}
      </CabStack>
    </CabCard>
  );
}

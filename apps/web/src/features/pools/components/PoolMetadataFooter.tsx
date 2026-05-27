"use client";

import { CabDataPanel, CabIcon, CabStack, CabText } from "@/design-system";
import { cabColors } from "@/design-system/tokens";

type MetadataRow = {
  key: string;
  label: string;
  value: string;
  href?: string | null;
  hrefLabel?: string;
};

export function PoolMetadataFooter(input: {
  title: string;
  rows: MetadataRow[];
  estimatedMessage?: string | null;
}) {
  return (
    <CabDataPanel>
      <CabStack gap="$2.5">
        <CabText variant="heading">{input.title}</CabText>
        <CabStack gap="$2">
          {input.rows.map((row) => (
            <CabStack key={row.key} row justifyContent="space-between" alignItems="center" gap="$3">
              <CabText variant="caption" color={cabColors.text.muted}>
                {row.label}
              </CabText>
              <CabStack row alignItems="center" gap="$2" justifyContent="flex-end">
                <CabText variant="mono" textAlign="right">
                  {row.value}
                </CabText>
                {row.href ? (
                  <a
                    href={row.href}
                    target="_blank"
                    rel="noreferrer noopener"
                    aria-label={row.hrefLabel}
                    title={row.hrefLabel}
                    style={{ display: "inline-flex", alignItems: "center" }}
                  >
                    <CabIcon name="externalLink" tone="muted" size="sm" />
                  </a>
                ) : null}
              </CabStack>
            </CabStack>
          ))}
        </CabStack>
        {input.estimatedMessage ? (
          <CabText variant="caption" color={cabColors.text.secondary}>
            {input.estimatedMessage}
          </CabText>
        ) : null}
      </CabStack>
    </CabDataPanel>
  );
}
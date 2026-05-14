export type LandingTelemetryPlacement = "hero" | "finalCta";

export type LandingTelemetryEvent = {
  event: "landing_wallet_cta_primary_click" | "landing_wallet_cta_secondary_click";
  placement: LandingTelemetryPlacement;
  state: "disconnected" | "connected" | "unsupported";
};

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
  }
}

export function trackLandingTelemetry(payload: LandingTelemetryEvent) {
  if (typeof window === "undefined") {
    return;
  }

  const detail = {
    ...payload,
    source: "landing",
    ts: Date.now(),
  };

  window.dispatchEvent(new CustomEvent("cab:landing-telemetry", { detail }));
  window.dataLayer?.push(detail);
}
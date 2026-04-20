type LogLevel = "info" | "warn" | "error";

function log(level: LogLevel, message: string, metadata?: Record<string, unknown>) {
  const payload = {
    level,
    message,
    metadata: metadata ?? {},
    timestamp: new Date().toISOString()
  };

  const writer = level === "error" ? console.error : level === "warn" ? console.warn : console.info;
  writer(JSON.stringify(payload));
}

export const logger = {
  info(message: string, metadata?: Record<string, unknown>) {
    log("info", message, metadata);
  },
  warn(message: string, metadata?: Record<string, unknown>) {
    log("warn", message, metadata);
  },
  error(message: string, metadata?: Record<string, unknown>) {
    log("error", message, metadata);
  },
  priceCacheMiss(tokenAddress: string, metadata?: Record<string, unknown>) {
    log("warn", "Pricing cache miss", {
      tokenAddress,
      ...(metadata ?? {})
    });
  },
  pricingCoveragePartial(metadata?: Record<string, unknown>) {
    log("warn", "Pricing coverage partial", metadata);
  }
};
type TaskLogLevel = "log" | "info" | "warn" | "error";

function summarizeForLog(value: unknown, depth = 0): unknown {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "string") {
    return value.length > 160 ? `${value.slice(0, 157)}...` : value;
  }

  if (
    value === null
    || value === undefined
    || typeof value === "number"
    || typeof value === "boolean"
    || typeof value === "bigint"
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return {
      count: value.length,
      sample: depth >= 2 ? undefined : value.slice(0, 3).map((item) => summarizeForLog(item, depth + 1)),
    };
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    const limitedEntries = entries.slice(0, 12).map(([key, item]) => [key, summarizeForLog(item, depth + 1)] as const);
    if (entries.length > 12) {
      limitedEntries.push(["truncatedKeyCount", entries.length - 12]);
    }
    return Object.fromEntries(limitedEntries);
  }

  return String(value);
}

function emitTaskLog(level: TaskLogLevel, taskName: string, message: string, details?: unknown) {
  const logger = console[level].bind(console) as (...args: unknown[]) => void;
  if (details === undefined) {
    logger(`[${taskName}] ${message}`);
    return;
  }
  logger(`[${taskName}] ${message}`, summarizeForLog(details));
}

function summarizeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack?.split("\n").slice(0, 5).join("\n") ?? null,
    };
  }

  return summarizeForLog(error);
}

export function taskLog(taskName: string, message: string, details?: unknown) {
  emitTaskLog("log", taskName, message, details);
}

export function taskInfo(taskName: string, message: string, details?: unknown) {
  emitTaskLog("info", taskName, message, details);
}

export function taskWarn(taskName: string, message: string, details?: unknown) {
  emitTaskLog("warn", taskName, message, details);
}

export function taskError(taskName: string, message: string, details?: unknown) {
  emitTaskLog("error", taskName, message, details);
}

export async function withTaskLogging<T>(taskName: string, payload: unknown, run: () => Promise<T>) {
  const startedAt = Date.now();
  taskInfo(taskName, "started", { payload });

  try {
    const result = await run();
    taskInfo(taskName, "completed", {
      durationMs: Date.now() - startedAt,
      result,
    });
    return result;
  } catch (error) {
    taskError(taskName, "failed", {
      durationMs: Date.now() - startedAt,
      error: summarizeError(error),
    });
    throw error;
  }
}
import { sanitizeLogText, sanitizeLogValue } from "./logSanitization";
import type { FastifyBaseLogger } from "fastify";

export type SafeLogFn = (message: string, context?: Record<string, unknown>) => void;

export function createSafeLoggers(logger: FastifyBaseLogger): {
  safeLogInfo: SafeLogFn;
  safeLogWarn: SafeLogFn;
  safeLogError: SafeLogFn;
} {
  function make(level: "info" | "warn" | "error"): SafeLogFn {
    return (message, context) => {
      const sm = sanitizeLogText(message, 600);
      if (context) {
        logger[level](sanitizeLogValue(context) as Record<string, unknown>, sm);
        return;
      }
      logger[level](sm);
    };
  }
  return { safeLogInfo: make("info"), safeLogWarn: make("warn"), safeLogError: make("error") };
}

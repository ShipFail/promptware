/**
 * os/kernel/bus/logger.ts
 *
 * Structured Logger for the Kernel.
 * Outputs NDJSON to stderr to avoid interfering with stdout IPC.
 */

import { OsMessage } from "../schema/message.ts";
import { BusStream } from "./stream-types.ts";

export type LogLevel = "debug" | "info" | "warn" | "error" | "fatal";

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
    cause?: unknown;
  };
}

class Logger {
  private minLevel: number;
  private levels: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
    fatal: 4,
  };

  constructor() {
    // Default to info, can be overridden by env var
    const envLevel = Deno.env.get("LOG_LEVEL") as LogLevel;
    this.minLevel = this.levels[envLevel] ?? 1;
  }

  private log(level: LogLevel, message: string, context?: Record<string, unknown>, error?: Error) {
    if (this.levels[level] < this.minLevel) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
    };

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
        cause: error.cause,
      };
    }

    // Write to stderr to keep stdout clean for IPC
    const line = JSON.stringify(entry);
    const encoder = new TextEncoder();
    Deno.stderr.writeSync(encoder.encode(line + "\n"));
  }

  debug(message: string, context?: Record<string, unknown>) {
    this.log("debug", message, context);
  }

  info(message: string, context?: Record<string, unknown>) {
    this.log("info", message, context);
  }

  warn(message: string, context?: Record<string, unknown>, error?: Error) {
    this.log("warn", message, context, error);
  }

  error(message: string, context?: Record<string, unknown>, error?: Error) {
    this.log("error", message, context, error);
  }

  fatal(message: string, context?: Record<string, unknown>, error?: Error) {
    this.log("fatal", message, context, error);
  }
}

export const logger = new Logger();

export function createLoggerStream(): BusStream {
  return new TransformStream({
    transform(message: OsMessage, controller) {
      logger.info(`[Stream] ${message.type}`, {
        id: message.metadata?.id,
        kind: message.kind,
        correlation: message.metadata?.correlation
      });
      controller.enqueue(message);
    },
  });
}

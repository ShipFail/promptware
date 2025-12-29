/**
 * os/kernel/runtime/daemon-logger.ts
 *
 * RFC-23 Stage 4: Daemon Logging Interface
 *
 * Design Decision #3: Configurable daemon logging with syslog default
 * - Daemon logs written as JSON to stderr (can be redirected to syslog)
 * - Structured logging with timestamp and metadata
 */

export interface DaemonLogger {
  info(message: string, metadata?: Record<string, unknown>): void;
  error(message: string, metadata?: Record<string, unknown>): void;
  warn(message: string, metadata?: Record<string, unknown>): void;
}

/**
 * Syslog-compatible daemon logger.
 * Writes structured JSON logs to stderr.
 *
 * Usage in production:
 *   deno run -A syscall.ts --mode=daemon 2>&1 | logger -t promptware
 */
export class SyslogDaemonLogger implements DaemonLogger {
  info(message: string, metadata?: Record<string, unknown>): void {
    console.error(
      JSON.stringify({
        level: "info",
        timestamp: Date.now(),
        message,
        ...metadata,
      })
    );
  }

  error(message: string, metadata?: Record<string, unknown>): void {
    console.error(
      JSON.stringify({
        level: "error",
        timestamp: Date.now(),
        message,
        ...metadata,
      })
    );
  }

  warn(message: string, metadata?: Record<string, unknown>): void {
    console.error(
      JSON.stringify({
        level: "warn",
        timestamp: Date.now(),
        message,
        ...metadata,
      })
    );
  }
}

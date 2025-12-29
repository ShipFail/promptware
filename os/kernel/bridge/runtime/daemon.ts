/**
 * os/kernel/runtime/daemon.ts
 *
 * RFC-23 Stage 4: Daemon Runtime
 *
 * Long-running Unix socket server that accepts client connections.
 * Implements single-instance check, connection prologue, and graceful shutdown.
 */

import { TextLineStream } from "jsr:@std/streams";
import { KernelRuntime } from "./interface.ts";
import { OsEvent, createError } from "../../lib/event.ts";
import { getSocketPath } from "./socket-path.ts";
import { NDJSONDecodeStream, NDJSONEncodeStream } from "../protocol/ndjson.ts";
import { routerStream } from "../stream/router.ts";
import { DaemonLogger, SyslogDaemonLogger } from "./daemon-logger.ts";

// Global daemon state for graceful shutdown
let daemonListener: Deno.Listener | null = null;
let shutdownRequested = false;

export class DaemonRuntime implements KernelRuntime {
  private logger: DaemonLogger;

  constructor(logger?: DaemonLogger) {
    this.logger = logger || new SyslogDaemonLogger();
  }

  async run(): Promise<number> {
    const sockPath = getSocketPath();

    // 1. Single-instance check (remove stale socket if needed)
    await this.ensureSingleInstance(sockPath);

    // 2. Bind Unix socket
    try {
      daemonListener = Deno.listen({ transport: "unix", path: sockPath });
      this.logger.info("Daemon started", { socketPath: sockPath });
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      this.logger.error("Failed to bind socket", {
        socketPath: sockPath,
        error: errorMessage,
      });
      return 1;
    }

    // 3. Accept connections loop
    try {
      for await (const conn of daemonListener) {
        // Check shutdown flag before accepting new connections
        if (shutdownRequested) {
          this.logger.info("Shutdown requested, rejecting new connection");
          conn.close();
          break;
        }

        // Handle each connection in parallel
        this.handleConnection(conn as Deno.UnixConn).catch((err: unknown) => {
          const errorMessage = err instanceof Error ? err.message : String(err);
          this.logger.error("Connection error", { error: errorMessage });
        });
      }
    } finally {
      // 4. Cleanup on exit
      this.logger.info("Daemon shutting down");

      try {
        daemonListener.close();
      } catch {
        // Ignore if already closed
      }

      try {
        await Deno.remove(sockPath);
      } catch {
        // Ignore errors removing socket
      }
    }

    return 0;
  }

  /**
   * Handles a single client connection.
   * Protocol: NDJSON stream of OsEvents
   * RFC-23 Section 4.6: First event MUST be Syscall.Authenticate
   */
  private async handleConnection(conn: Deno.UnixConn): Promise<void> {
    this.logger.info("Client connected");

    try {
      // Build bidirectional pipeline with auth validation:
      // Client → Decode NDJSON → Auth Check → Router → Encode NDJSON → Client
      const inputStream = conn.readable
        .pipeThrough(new TextDecoderStream())
        .pipeThrough(new TextLineStream())
        .pipeThrough(new NDJSONDecodeStream())
        .pipeThrough(this.createAuthValidationStream());

      const outputStream = inputStream
        .pipeThrough(routerStream)
        .pipeThrough(new NDJSONEncodeStream())
        .pipeThrough(new TextEncoderStream());

      // Pipe output back to client
      await outputStream.pipeTo(conn.writable);

      this.logger.info("Client disconnected");
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      this.logger.warn("Client connection error", { error: errorMessage });
    } finally {
      try {
        conn.close();
      } catch {
        // Ignore close errors
      }
    }
  }

  /**
   * Creates a transform stream that validates authentication.
   * RFC-23 Section 4.6: First event MUST be Syscall.Authenticate
   */
  private createAuthValidationStream(): TransformStream<OsEvent, OsEvent> {
    let isFirstEvent = true;

    return new TransformStream<OsEvent, OsEvent>({
      transform(event, controller) {
        if (isFirstEvent) {
          isFirstEvent = false;

          // First event MUST be Syscall.Authenticate
          if (event.name !== "Syscall.Authenticate") {
            controller.enqueue(
              createError(
                event,
                "Authentication required: First event must be Syscall.Authenticate"
              )
            );
            controller.terminate();
            return;
          }
        }

        // Pass through all events (including the auth event itself)
        controller.enqueue(event);
      },
    });
  }

  /**
   * Ensures only one daemon instance is running.
   * RFC-23 Section 4.7.2: Stale socket cleanup
   */
  private async ensureSingleInstance(sockPath: string): Promise<void> {
    // Check if socket file exists
    try {
      await Deno.stat(sockPath);
    } catch (e: unknown) {
      // Socket doesn't exist, we're first
      if (e instanceof Deno.errors.NotFound) {
        return;
      }
      throw e;
    }

    // Socket exists - try connecting to see if daemon is alive
    try {
      const testConn = await Deno.connect({ transport: "unix", path: sockPath });
      testConn.close();

      // Connection succeeded → daemon is running
      throw new Error(
        `Daemon already running on ${sockPath}. Use --mode=client to connect.`
      );
    } catch (e: unknown) {
      // Connection failed → stale socket, safe to remove
      if (
        e instanceof Error &&
        (e.message.includes("Connection refused") ||
          e.message.includes("No such file"))
      ) {
        this.logger.info("Removing stale socket", { socketPath: sockPath });
        await Deno.remove(sockPath);
        return;
      }

      // Other error (like "already running" from above)
      throw e;
    }
  }
}

/**
 * Requests graceful daemon shutdown.
 * Called by Syscall.Shutdown handler.
 */
export function requestDaemonShutdown(): void {
  shutdownRequested = true;
  if (daemonListener) {
    daemonListener.close();
  }
}

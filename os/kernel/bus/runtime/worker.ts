/**
 * os/kernel/bus/runtime/worker.ts
 *
 * RFC-23 Stage 4: Worker Runtime
 *
 * Long-running Unix socket server that accepts main thread connections.
 * Implements single-instance check, connection prologue, and graceful shutdown.
 */

import { TextLineStream } from "jsr:@std/streams";
import { KernelRuntime } from "./interface.ts";
import { OsMessage, createError } from "../../protocol/message.ts";
import { getSocketPath } from "./socket-path.ts";
import { NDJSONDecodeStream, NDJSONEncodeStream } from "../protocol/ndjson.ts";
import { routerStream } from "../stream/router.ts";
import { WorkerLogger, SyslogWorkerLogger } from "./worker-logger.ts";
import { isShutdownRequested, onShutdown } from "./lifecycle.ts";

// Global worker state for graceful shutdown
let workerListener: Deno.Listener | null = null;

export class WorkerRuntime implements KernelRuntime {
  private logger: WorkerLogger;

  constructor(logger?: WorkerLogger) {
    this.logger = logger || new SyslogWorkerLogger();
    
    // Listen for shutdown requests
    onShutdown(() => {
      this.logger.info("Shutdown signal received");
      if (workerListener) {
        try {
          workerListener.close();
        } catch {
          // Ignore
        }
      }
    });
  }

  async run(): Promise<number> {
    const sockPath = getSocketPath();

    // 1. Single-instance check (remove stale socket if needed)
    await this.ensureSingleInstance(sockPath);

    // 2. Bind Unix socket
    try {
      workerListener = Deno.listen({ transport: "unix", path: sockPath });
      this.logger.info("Worker started", { socketPath: sockPath });
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
      for await (const conn of workerListener) {
        // Check shutdown flag before accepting new connections
        if (isShutdownRequested()) {
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
      this.logger.info("Worker shutting down");

      try {
        workerListener?.close();
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
   * Handles a single main thread connection.
   * Protocol: NDJSON stream of OsMessages
   * RFC-23 Section 4.6: First message MUST be Syscall.Authenticate
   */
  private async handleConnection(conn: Deno.UnixConn): Promise<void> {
    this.logger.info("Main thread connected");

    try {
      // Build bidirectional pipeline with auth validation:
      // Main → Decode NDJSON → Auth Check → Router → Encode NDJSON → Main
      const inputStream = conn.readable
        .pipeThrough(new TextDecoderStream())
        .pipeThrough(new TextLineStream())
        .pipeThrough(new NDJSONDecodeStream())
        .pipeThrough(this.createAuthValidationStream());

      const outputStream = inputStream
        .pipeThrough(routerStream)
        .pipeThrough(new NDJSONEncodeStream())
        .pipeThrough(new TextEncoderStream());

      // Pipe output back to main thread
      await outputStream.pipeTo(conn.writable);

      this.logger.info("Main thread disconnected");
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      this.logger.warn("Main thread connection error", { error: errorMessage });
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
   * RFC-23 Section 4.6: First message MUST be Syscall.Authenticate
   */
  private createAuthValidationStream(): TransformStream<OsMessage, OsMessage> {
    let isFirstMessage = true;

    return new TransformStream<OsMessage, OsMessage>({
      transform(message, controller) {
        if (isFirstMessage) {
          isFirstMessage = false;

          // First message MUST be Syscall.Authenticate
          if (message.type !== "Syscall.Authenticate") {
            controller.enqueue(
              createError(
                message,
                "Authentication required: First message must be Syscall.Authenticate"
              )
            );
            controller.terminate();
            return;
          }
        }

        // Pass through all messages (including the auth message itself)
        controller.enqueue(message);
      },
    });
  }

  /**
   * Ensures only one worker instance is running.
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

    // Socket exists - try connecting to see if worker is alive
    try {
      const testConn = await Deno.connect({ transport: "unix", path: sockPath });
      testConn.close();

      // Connection succeeded → worker is running
      throw new Error(
        `Worker already running on ${sockPath}. Use --mode=main to connect.`
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
 * Requests graceful worker shutdown.
 * Called by Syscall.Shutdown capability.
 * @deprecated Use lifecycle.ts requestShutdown() instead.
 */
export function requestWorkerShutdown(): void {
  // No-op, moved to lifecycle.ts
}

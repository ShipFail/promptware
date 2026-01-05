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
import { OsMessage, createError } from "../schema/message.ts";
import { getSocketPath, getLockPath } from "./socket-path.ts";
import { NDJSONDecodeStream, NDJSONEncodeStream } from "../lib/ndjson.ts";
import { createRouter } from "./router.ts";
import { registry } from "../capabilities/registry.ts";
import { logger, createLoggerStream } from "./logger.ts";
import { isShutdownRequested, onShutdown } from "./lifecycle.ts";

// Global worker state for graceful shutdown
let workerListener: Deno.Listener | null = null;
let lockFile: Deno.FsFile | null = null;

export class WorkerRuntime implements KernelRuntime {
  constructor() {
    // Listen for shutdown requests
    onShutdown(() => {
      logger.info("Shutdown signal received");
      if (workerListener) {
        try {
          workerListener.close();
        } catch {
          // Ignore
        }
      }
      if (lockFile) {
        try {
          // Closing the file releases the lock
          lockFile.close();
        } catch {
          // Ignore
        }
      }
    });
  }

  async run(): Promise<number> {
    const sockPath = getSocketPath();
    const lockPath = getLockPath();

    // 1. Acquire Exclusive Lock (The "Flock" Pattern)
    // This blocks if another worker is running or starting.
    // It ensures we are the single instance.
    try {
      // Open with write permissions to allow locking
      lockFile = await Deno.open(lockPath, { write: true, create: true });
      
      // Exclusive lock. Blocks until acquired.
      // If another process holds it, we wait here.
      // This solves the race condition: only one process can proceed to bind.
      await lockFile.lock(true);
      
      logger.info("Acquired instance lock", { lockPath });
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      logger.fatal("Failed to acquire instance lock", { lockPath, error: errorMessage });
      return 1;
    }

    // 2. Bind Unix socket (Atomic Creation)
    // We use the "Bind-Listen-Rename" trick to ensure the socket is fully connectable
    // the moment it appears on the filesystem.
    //
    // 1. Bind to a temporary path (kernel.sock.tmp)
    // 2. Start listening
    // 3. Rename tmp -> real (kernel.sock)
    //
    // This prevents the race condition where a client sees the file (created by bind)
    // but connects before the kernel is ready to accept (listen), causing ECONNREFUSED.
    const tmpSockPath = `${sockPath}.tmp`;

    try {
      // Cleanup stale files
      try { await Deno.remove(sockPath); } catch (e) { if (!(e instanceof Deno.errors.NotFound)) throw e; }
      try { await Deno.remove(tmpSockPath); } catch (e) { if (!(e instanceof Deno.errors.NotFound)) throw e; }

      // Bind and Listen on temporary path
      workerListener = Deno.listen({ transport: "unix", path: tmpSockPath });
      
      // Atomic Rename: The socket appears at the final path ONLY when it is ready.
      await Deno.rename(tmpSockPath, sockPath);
      
      logger.info("Worker started (Atomic Bind)", { socketPath: sockPath });
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      logger.error("Failed to bind socket", {
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
          logger.info("Shutdown requested, rejecting new connection");
          conn.close();
          break;
        }

        // Handle each connection in parallel
        this.handleConnection(conn as Deno.UnixConn).catch((err: unknown) => {
          logger.error("Connection error", {}, err instanceof Error ? err : new Error(String(err)));
        });
      }
    } finally {
      // 4. Cleanup on exit
      logger.info("Worker shutting down");

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

      try {
        await Deno.remove(tmpSockPath);
      } catch {
        // Ignore
      }

      try {
        // Release lock by closing file
        lockFile?.close();
      } catch {
        // Ignore
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
    logger.info("Main thread connected");

    try {
      // Build bidirectional pipeline with auth validation:
      // Main → Decode NDJSON → Auth Check → Tee
      //                                     ├──> Router → Encode NDJSON → Main (Main Path)
      //                                     └──> Logger (Side Path)
      
      // Wrap conn.readable to swallow "operation canceled" errors which happen on abrupt disconnects
      const safeReadable = new ReadableStream<Uint8Array>({
        async start(controller) {
          const reader = conn.readable.getReader();
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) {
                controller.close();
                break;
              }
              controller.enqueue(value);
            }
          } catch (e) {
             // Log but treat as EOF to allow flushing pending writes
             // logger.debug("Connection read error (treated as EOF)", { error: String(e) });
             try { controller.close(); } catch {}
          } finally {
            reader.releaseLock();
          }
        }
      });

      const inputStream = safeReadable
        .pipeThrough(new TextDecoderStream())
        .pipeThrough(new TextLineStream())
        .pipeThrough(new NDJSONDecodeStream())
        .pipeThrough(this.createAuthValidationStream());

      // Fork the stream
      const [mainBranch, logBranch] = inputStream.tee();

      // Path A: The Kernel (Critical Path)
      // We pipe to conn.writable, but we MUST NOT close it when the stream ends.
      // Why? Because conn.writable is the socket. If we close it, the client sees EOF.
      // But wait, we DO want the client to see EOF when we are done processing!
      //
      // The issue is that `pipeTo` closes the destination by default.
      // If `kernelPromise` finishes (because input ended), it closes `conn.writable`.
      // This is correct behavior for a request/response cycle initiated by a short-lived client.
      //
      // However, we are seeing "Connection reset by peer" errors.
      // This usually happens if we write to a closed socket.
      //
      // Let's add error handling to the pipeTo to suppress the "Connection reset" noise
      // which happens if the client disconnects abruptly.
      const kernelPromise = mainBranch
        .pipeThrough(createRouter(registry))
        .pipeThrough(new NDJSONEncodeStream())
        .pipeThrough(new TextEncoderStream())
        .pipeTo(conn.writable)
        .catch(() => {}); // Ignore write errors (client disconnected)

      // Path B: The Logger (Side Path)
      const loggerPromise = logBranch
        .pipeThrough(createLoggerStream())
        .pipeTo(new WritableStream()) // Sink to nowhere (loggerStream writes to stderr)
        .catch(() => {});

      // Wait for both (or at least the kernel)
      await Promise.all([kernelPromise, loggerPromise]);

      logger.info("Main thread disconnected");
    } catch (e: unknown) {
      logger.warn("Main thread connection error", {}, e instanceof Error ? e : new Error(String(e)));
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
}

/**
 * Requests graceful worker shutdown.
 * Called by Syscall.Shutdown capability.
 * @deprecated Use lifecycle.ts requestShutdown() instead.
 */
export function requestWorkerShutdown(): void {
  // No-op, moved to lifecycle.ts
}

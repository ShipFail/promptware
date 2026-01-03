/**
 * os/kernel/transport/runtime/main.ts
 *
 * RFC-23 Stage 3: Main Runtime
 *
 * Unix socket client that connects to worker (or spawns it if not running).
 * Implements the "connect-or-spawn" pattern with exponential backoff retry.
 */

import { TextLineStream } from "jsr:@std/streams";
import { KernelRuntime } from "./interface.ts";
import { OsMessage, createMessage } from "../../lib/os-event.ts";
import { getSocketPath } from "./socket-path.ts";
import { getEntrypointCommand } from "./entrypoint.ts";
import { NDJSONDecodeStream, NDJSONEncodeStream } from "../protocol/ndjson.ts";

export class MainRuntime implements KernelRuntime {
  async run(): Promise<number> {
    const sockPath = getSocketPath();

    // 1. Try connect to existing worker
    let conn: Deno.UnixConn;
    try {
      conn = await Deno.connect({ transport: "unix", path: sockPath }) as Deno.UnixConn;
      console.error("[Main] Connected to existing worker");
    } catch (_e) {
      // 2. Connection failed → spawn worker and retry
      console.error("[Main] Worker not running, spawning...");
      await this.spawnWorker();

      // 3. Retry connection with exponential backoff
      try {
        conn = await this.retryConnect(sockPath);
        console.error("[Main] Connected to newly spawned worker");
      } catch (e: unknown) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        console.error(`[Main] Failed to connect after spawn: ${errorMessage}`);
        return 1;
      }
    }

    try {
      // 4. Create stdin with auth prologue prepended
      const authMessage = createMessage("command", "Syscall.Authenticate", {});
      const authPayload = JSON.stringify(authMessage) + "\n";
      const encoder = new TextEncoder();

      let authSent = false;
      let stdinReader: ReadableStreamDefaultReader<Uint8Array> | null = null;

      const stdinWithAuth = new ReadableStream({
        async pull(controller) {
          // First pull: send auth message
          if (!authSent) {
            authSent = true;
            controller.enqueue(encoder.encode(authPayload));
            return;
          }

          // Subsequent pulls: read from stdin
          if (!stdinReader) {
            stdinReader = Deno.stdin.readable.getReader();
          }

          const { done, value } = await stdinReader.read();
          if (done) {
            controller.close();
          } else {
            controller.enqueue(value);
          }
        },
        cancel() {
          stdinReader?.releaseLock();
        },
      });

      // 5. Pipe stdin (with auth) → worker (write half)
      const stdinPipe = stdinWithAuth.pipeTo(conn.writable, {
        preventClose: true, // Allow half-close
      });

      // 6. Pipe worker → stdout (read half)
      const stdoutPipe = conn.readable.pipeTo(Deno.stdout.writable);

      // 7. Wait for both pipes to complete
      await Promise.all([stdinPipe, stdoutPipe]);

      return 0;
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      console.error(`[Main] Connection error: ${errorMessage}`);
      return 1;
    } finally {
      try {
        conn.close();
      } catch {
        // Ignore close errors
      }
    }
  }

  /**
   * Spawns a detached worker process.
   * Supports both local file and URL-based invocation.
   */
  private async spawnWorker(): Promise<void> {
    const { cmd, args } = getEntrypointCommand();

    const workerCmd = new Deno.Command(cmd, {
      args: [...args, "--mode=worker"],
      stdin: "null",
      stdout: "null",
      stderr: "inherit", // Show worker logs in main's stderr
    });

    // Spawn detached (don't wait for worker to exit)
    workerCmd.spawn();

    // Give worker time to start listening
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  /**
   * Retries connection with exponential backoff.
   * Delays: 10ms, 20ms, 40ms, 80ms, 160ms (total ~310ms)
   */
  private async retryConnect(path: string): Promise<Deno.UnixConn> {
    const delays = [10, 20, 40, 80, 160];

    for (const delay of delays) {
      await new Promise((resolve) => setTimeout(resolve, delay));

      try {
        return await Deno.connect({ transport: "unix", path }) as Deno.UnixConn;
      } catch (_e) {
        // Continue to next retry
      }
    }

    // All retries failed
    throw new Error(`Failed to connect to worker after ${delays.length} retries`);
  }
}

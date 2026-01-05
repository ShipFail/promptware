/**
 * os/kernel/bus/runtime/main.ts
 *
 * RFC-23 Stage 3: Main Runtime
 *
 * Unix socket client that connects to worker (or spawns it if not running).
 * Implements the "connect-or-spawn" pattern with exponential backoff retry.
 */

import { TextLineStream } from "jsr:@std/streams";
import { KernelRuntime } from "./interface.ts";
import { OsMessage, createCommand } from "../schema/message.ts";
import { getSocketPath, getLockPath, getSpawnLockPath } from "./socket-path.ts";
import { getEntrypointCommand } from "./entrypoint.ts";
import { NDJSONDecodeStream, NDJSONEncodeStream } from "../lib/ndjson.ts";
import { dirname } from "jsr:@std/path";

export class MainRuntime implements KernelRuntime {
  async run(): Promise<number> {
    const sockPath = getSocketPath();

    // 1. Connect or Spawn (Robust "Spawn Lock" Pattern)
    let conn: Deno.UnixConn;
    try {
      conn = await this.connectOrSpawn(sockPath);
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      console.error(`[Main] Failed to connect: ${errorMessage}`);
      return 1;
    }

    try {
      // 4. Create stdin with auth prologue prepended
      const authMessage = createCommand("Syscall.Authenticate", {});
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
      // We do NOT prevent close here. When stdin closes, we want to close the write half of the socket.
      // This signals EOF to the worker's reader.
      const stdinPipe = stdinWithAuth.pipeTo(conn.writable).catch(() => {});

      // 6. Pipe worker → stdout (read half)
      // We need to detect when the worker has finished replying to our request.
      const stdoutPipe = conn.readable.pipeTo(Deno.stdout.writable).catch(() => {});

      // 7. Wait for both pipes to complete
      await Promise.all([stdinPipe, stdoutPipe]);

      // 8. Explicitly close stdout to ensure the process exits cleanly
      // This is sometimes needed if Deno.stdout is kept open by other things
      try {
        Deno.stdout.close();
      } catch {
        // Ignore
      }

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
   * Connects to the worker, spawning it if necessary.
   * Implements the "Spawn Lock" pattern to prevent thundering herds.
   */
  private async connectOrSpawn(sockPath: string): Promise<Deno.UnixConn> {
    // 1. Fast Path: Try connecting immediately
    try {
      return await Deno.connect({ transport: "unix", path: sockPath }) as Deno.UnixConn;
    } catch {
      // Fallthrough to spawn logic
    }

    // 2. Acquire Spawn Lock
    // This serializes the spawning process. Only one client can be here.
    const lockPath = getSpawnLockPath();
    let lockFile: Deno.FsFile | null = null;

    try {
      lockFile = await Deno.open(lockPath, { create: true, write: true });
      await lockFile.lock(true); // Exclusive blocking lock

      // 3. Double Check (Crucial!)
      // Someone else might have spawned while we were waiting for the lock.
      try {
        return await Deno.connect({ transport: "unix", path: sockPath }) as Deno.UnixConn;
      } catch {
        // Still not running, so WE are the chosen spawner.
      }

      // 4. Spawn Worker
      this.spawnProcess();

      // 5. Wait for Socket (Event-Driven)
      // We hold the spawn lock while waiting, so other clients wait on us.
      // This is efficient because they will succeed in the "Double Check" step
      // as soon as we release the lock.
      return await this.waitForSocket(sockPath);

    } finally {
      // 6. Release Lock
      try {
        lockFile?.unlock();
        lockFile?.close();
      } catch {
        // Ignore
      }
    }
  }

  private spawnProcess(): void {
    const { cmd, args } = getEntrypointCommand();

    // Use shell to redirect stderr to file, so it persists after main exits
    const fullCmd = `${cmd} ${args.join(" ")} --mode=worker`;
    const workerCmd = new Deno.Command("sh", {
      args: ["-c", `${fullCmd} >>/tmp/promptware/worker.log 2>&1`],
      stdin: "null",
      stdout: "null",
      stderr: "null", 
    });

    // Spawn detached (don't wait for worker to exit)
    workerCmd.spawn();
  }

  /**
   * Waits for the socket to appear using filesystem events.
   * Falls back to polling if watcher fails.
   */
  private async waitForSocket(path: string): Promise<Deno.UnixConn> {
    const dir = dirname(path);
    const filename = path.split("/").pop()!;
    
    // Try connecting immediately just in case
    try {
      return await Deno.connect({ transport: "unix", path }) as Deno.UnixConn;
    } catch {
      // Ignore
    }

    // Watch for creation
    let watcher: Deno.FsWatcher;
    try {
      watcher = Deno.watchFs(dir);
    } catch (e) {
      console.error(`[Main] Failed to create watcher on ${dir}:`, e);
      throw e;
    }
    
    const timeout = 5000; // 5s timeout
    const start = Date.now();

    try {
      // Race: Watcher vs Timeout
      // We loop because the watcher might fire for other files
      while (Date.now() - start < timeout) {
        // Create a promise for the next relevant event
        const nextEvent = new Promise<void>((resolve) => {
          (async () => {
            try {
              for await (const event of watcher) {
                if (event.kind === "create" || event.kind === "modify") {
                  if (event.paths.some(p => p.endsWith(filename))) {
                    resolve();
                    return;
                  }
                }
              }
            } catch (e) {
               // Watcher closed or error
            }
          })();
        });

        // Wait for event or short timeout (to retry connect)
        await Promise.race([
          nextEvent,
          new Promise((r) => setTimeout(r, 100))
        ]);

        // Try connecting
        try {
          return await Deno.connect({ transport: "unix", path }) as Deno.UnixConn;
        } catch {
          // Continue waiting
        }
      }
    } catch (e) {
       console.error("[Main] Error in waitForSocket loop:", e);
       throw e;
    } finally {
      try {
        watcher.close();
      } catch (e) {
        console.error("[Main] Error closing watcher:", e);
      }
    }

    throw new Error("Timed out waiting for worker socket");
  }
}

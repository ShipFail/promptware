/**
 * os/kernel/runtime/platform.ts
 *
 * Platform Detection (RFC-23 Stage 1)
 *
 * Ensures client/daemon modes only run on supported platforms (macOS, Linux).
 * Windows is not supported for Unix socket-based IPC.
 */

export function ensureSupportedPlatform(): void {
  if (Deno.build.os === "windows") {
    console.error("Error: Daemon/client modes are not supported on Windows.");
    console.error("Please use inline mode: --mode=inline");
    console.error("Or run without --mode flag (defaults to inline).");
    Deno.exit(1);
  }
}

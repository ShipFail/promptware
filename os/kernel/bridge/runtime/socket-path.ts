/**
 * os/kernel/runtime/socket-path.ts
 *
 * RFC-23 Stage 3: Socket Path Computation
 *
 * Deterministic path for Unix domain socket communication.
 * Follows XDG Base Directory specification.
 */

/**
 * Computes the Unix socket path for daemon communication.
 *
 * RFC-23 Section 4.5.1: Deterministic path computation
 * - Follows XDG Base Directory spec
 * - Falls back to /tmp if XDG_RUNTIME_DIR unavailable
 * - Ensures directory exists with mode 0700 (user-only access)
 *
 * @returns Absolute path to kernel.sock
 */
export function getSocketPath(): string {
  // 1. Determine base runtime directory
  const base =
    Deno.env.get("XDG_RUNTIME_DIR") ||
    Deno.env.get("TMPDIR") ||
    "/tmp";

  // 2. Construct PromptWare runtime directory
  const runtimeDir = `${base}/promptware`;

  // 3. Ensure directory exists with mode 0700 (user-only access)
  try {
    Deno.mkdirSync(runtimeDir, { mode: 0o700, recursive: true });
  } catch (e: unknown) {
    // Ignore error if directory already exists
    if (!(e instanceof Deno.errors.AlreadyExists)) {
      throw e;
    }
  }

  // 4. Return socket path
  return `${runtimeDir}/kernel.sock`;
}

/**
 * os/kernel/runtime/entrypoint.ts
 *
 * RFC-23 Stage 3: Entrypoint Detection
 *
 * Detects how the kernel was invoked (local file vs URL) to enable
 * self-spawn of daemon from the same source.
 *
 * Design Decision #4: Support URL-based self-spawn
 * Example: deno run https://... --mode=client
 * → spawns: deno run https://... --mode=daemon
 */

export interface EntrypointCommand {
  cmd: string;
  args: string[];
}

/**
 * Detects the entrypoint command for spawning new processes.
 *
 * Handles both:
 * - Local file invocation: deno run -A /path/to/syscall.ts
 * - URL invocation: deno run -A https://example.com/syscall.ts
 *
 * @returns Command and args needed to re-invoke the kernel
 */
export function getEntrypointCommand(): EntrypointCommand {
  const mainModule = Deno.mainModule;

  // Always use the Deno executable
  const cmd = Deno.execPath();

  // Check if running from URL or local file
  if (mainModule.startsWith("http://") || mainModule.startsWith("https://")) {
    // URL-based invocation
    return {
      cmd,
      args: ["run", "-A", mainModule],
    };
  } else {
    // Local file invocation (file:// or absolute path)
    // Convert file:// URL to path if needed
    const modulePath = mainModule.startsWith("file://")
      ? new URL(mainModule).pathname
      : mainModule;

    return {
      cmd,
      args: ["run", "-A", modulePath],
    };
  }
}

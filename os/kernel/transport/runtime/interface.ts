/**
 * os/kernel/runtime/interface.ts
 *
 * KernelRuntime Interface (RFC-23 Stage 1)
 *
 * Defines the contract for different kernel execution modes:
 * - Inline: In-process execution (current v1.0 behavior)
 * - Main: Unix socket client (RFC-23 Stage 3)
 * - Worker: Unix socket server (RFC-23 Stage 4)
 */

export interface KernelRuntime {
  /**
   * Execute the runtime's main logic.
   * Returns exit code (0 = success, non-zero = failure).
   */
  run(): Promise<number>;
}

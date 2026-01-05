/**
 * PromptWare ØS Message Bus (bus.ts)
 *
 * The Unified Entry Point for the Main Thread and Worker.
 *
 * Supports multiple execution modes:
 * - inline: In-process execution (default, v1.0 behavior) [Stage 1]
 * - main: Unix socket client (Main Thread) [Stage 3]
 * - worker: Unix socket server (Worker Thread) [Stage 4]
 */

import { parseArgs } from "jsr:@std/cli/parse-args";

import { KernelRuntime } from "./bus/interface.ts";
import { InlineRuntime } from "./bus/inline.ts";
import { MainRuntime } from "./bus/main.ts";
import { WorkerRuntime } from "./bus/worker.ts";
import { ensureSupportedPlatform } from "./bus/platform.ts";
import { logger } from "./bus/logger.ts";

/**
 * Determines the execution mode based on CLI arguments.
 * Pure function for testability.
 */
export function determineMode(args: string[]): string {
  const parsed = parseArgs(args, { string: ["mode"] });
  if (parsed.mode) return parsed.mode;

  // Smart default:
  // - If args provided (CLI mode): use inline
  // - If pipe mode (no args): use main (worker)
  const hasArgs = parsed._.length > 0;
  return hasArgs ? "inline" : "main";
}

/**
 * Factory to create the appropriate runtime.
 * Isolated for testability.
 */
export function createRuntime(mode: string): KernelRuntime {
  switch (mode) {
    case "inline":
      return new InlineRuntime();
    case "main":
      ensureSupportedPlatform();
      return new MainRuntime();
    case "worker":
      ensureSupportedPlatform();
      return new WorkerRuntime();
    default:
      throw new Error(`Unknown mode: ${mode}`);
  }
}

/**
 * The Kernel Supervisor.
 * Orchestrates the boot process and handles panics.
 * Returns exit code instead of exiting process.
 */
export async function kernelMain(
  args: string[], 
  runtimeFactory = createRuntime
): Promise<number> {
  try {
    const mode = determineMode(args);
    const runtime = runtimeFactory(mode);
    return await runtime.run();
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    // If it's an unknown mode error, log as error, otherwise fatal panic
    if (errorMessage.startsWith("Unknown mode")) {
      logger.error(`Error: ${errorMessage}`);
      logger.error('Valid modes: "inline", "main", "worker"');
    } else {
      logger.fatal(`[Kernel Panic] ${errorMessage}`, {}, e instanceof Error ? e : undefined);
    }
    return 1;
  }
}

// Run if main
if (import.meta.main) {
  const exitCode = await kernelMain(Deno.args);
  Deno.exit(exitCode);
}


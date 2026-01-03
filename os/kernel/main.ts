/**
 * PromptWare ØS Kernel Entry Point (main.ts)
 *
 * RFC-23: Dual-Mode Bus Architecture
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

// Run if main
if (import.meta.main) {
  const args = parseArgs(Deno.args, {
    string: ["mode"],
  });

  // Smart default mode selection:
  // - If args provided (CLI mode): use inline
  // - If pipe mode (no args): use main (worker)
  // - Explicit --mode flag overrides
  let defaultMode = "inline";
  if (!args.mode) {
    const hasArgs = args._.length > 0;
    defaultMode = hasArgs ? "inline" : "main";
  }

  const mode = args.mode || defaultMode;
  let runtime: KernelRuntime;

  switch (mode) {
    case "inline":
      runtime = new InlineRuntime();
      break;
    case "main":
    case "client": // Deprecated alias
      ensureSupportedPlatform(); // Check not Windows
      runtime = new MainRuntime();
      break;
    case "worker":
    case "daemon": // Deprecated alias
      ensureSupportedPlatform(); // Check not Windows
      runtime = new WorkerRuntime();
      break;
    default:
      console.error(`Error: Unknown mode: ${mode}`);
      console.error('Valid modes: "inline", "main", "worker"');
      Deno.exit(1);
  }

  try {
    const exitCode = await runtime.run();
    Deno.exit(exitCode);
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    const errorStack = e instanceof Error ? e.stack : "";
    console.error(`[Kernel Panic] ${errorMessage}`);
    if (errorStack) console.error(errorStack);
    Deno.exit(1);
  }
}


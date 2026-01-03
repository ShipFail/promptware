/**
 * PromptWare ØS Kernel Entry Point (syscall.ts)
 *
 * RFC-23: Dual-Mode Syscall Transport
 *
 * Supports multiple execution modes:
 * - inline: In-process execution (default, v1.0 behavior) [Stage 1]
 * - main: Unix socket client (Main Thread) [Stage 3]
 * - worker: Unix socket server (Worker Thread) [Stage 4]
 */

import { parseArgs } from "jsr:@std/cli/parse-args";

import { KernelRuntime } from "./transport/runtime/interface.ts";
import { InlineRuntime } from "./transport/runtime/inline.ts";
import { MainRuntime } from "./transport/runtime/main.ts";
import { WorkerRuntime } from "./transport/runtime/worker.ts";
import { ensureSupportedPlatform } from "./transport/runtime/platform.ts";
import { createMessage } from "./lib/os-event.ts";
import { registry } from "./registry.ts";

/**
 * Legacy runKernel function (preserved for backward compatibility).
 * @deprecated Use InlineRuntime directly.
 */
export async function runKernel() {
  const runtime = new InlineRuntime();
  const exitCode = await runtime.run();
  if (exitCode !== 0) {
    Deno.exit(exitCode);
  }
}

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
  } catch (e: any) {
    console.error(`[Kernel Panic] ${e.message}`);
    console.error(e.stack);
    Deno.exit(1);
  }
}

// Legacy Export (Deprecated)
export async function syscall(name: string, ...args: any[]) {
  console.warn("DeprecationWarning: syscall() is deprecated. Use the Stream API.");

  const module = registry[name];
  if (!module) {
    throw new Error("Kernel Panic: Unknown syscall");
  }

  // Normalize CLI-style args if a cliAdapter exists
  let input: unknown = args;
  if (module.cliAdapter) {
    input = module.cliAdapter(args.map(String));
  }

  const parsedInput = await module.InputSchema.parseAsync(input);
  const output = await module.handler(parsedInput, createMessage("command", name, parsedInput));
  return module.OutputSchema.parse(output);
}


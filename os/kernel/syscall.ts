/**
 * PromptWare ØS Kernel Entry Point (syscall.ts)
 *
 * RFC-23: Dual-Mode Syscall Bridge
 *
 * Supports multiple execution modes:
 * - inline: In-process execution (default, v1.0 behavior) [Stage 1]
 * - client: Unix socket client [Stage 3]
 * - daemon: Unix socket server [Stage 4]
 */

import { parseArgs } from "jsr:@std/cli/parse-args";

import { KernelRuntime } from "./runtime/interface.ts";
import { InlineRuntime } from "./runtime/inline.ts";
import { ClientRuntime } from "./runtime/client.ts";
import { DaemonRuntime } from "./runtime/daemon.ts";
import { ensureSupportedPlatform } from "./runtime/platform.ts";
import { createEvent } from "./events.ts";
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
  // - If pipe mode (no args): use client (daemon)
  // - Explicit --mode flag overrides
  let defaultMode = "inline";
  if (!args.mode) {
    const hasArgs = args._.length > 0;
    defaultMode = hasArgs ? "inline" : "client";
  }

  const mode = args.mode || defaultMode;
  let runtime: KernelRuntime;

  switch (mode) {
    case "inline":
      runtime = new InlineRuntime();
      break;
    case "client":
      ensureSupportedPlatform(); // Check not Windows
      runtime = new ClientRuntime();
      break;
    case "daemon":
      ensureSupportedPlatform(); // Check not Windows
      runtime = new DaemonRuntime();
      break;
    default:
      console.error(`Error: Unknown mode: ${mode}`);
      console.error('Valid modes: "inline", "client", "daemon"');
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
  const output = await module.handler(parsedInput, createEvent("command", name, parsedInput));
  return module.OutputSchema.parse(output);
}


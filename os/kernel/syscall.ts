/**
 * PromptWar̊e ØS Kernel Entry Point (syscall.ts)
 *
 * The "Reactive Kernel" Runner.
 * Connects Input -> Middleware -> Router -> Output.
 */

import { TextLineStream } from "jsr:@std/streams";
import { JsonStringifyStream } from "jsr:@std/json";
import { parseArgs } from "jsr:@std/cli/parse-args";

import { OsEvent, createEvent, createError } from "./events.ts";
import { routerStream } from "./streams/router.ts";
import { loggerStream } from "./streams/logger.ts";
import { registry } from "./registry.ts";

/**
 * The Main Kernel Pipeline.
 */
export async function runKernel() {
  // 1. Determine Input Source
  let inputStream: ReadableStream<OsEvent>;

  if (Deno.stdin.isTerminal()) {
    // A. Interactive/CLI Mode (Args -> Single Event)
    const args = parseArgs(Deno.args);
    const name = args._[0]?.toString();
    const payload = args._.slice(1);

    if (!name) {
      console.error("Usage: deno run -A syscall.ts <syscall> [args...]");
      console.error("   Or: echo 'JSON' | deno run -A syscall.ts");
      Deno.exit(1);
    }

    const event = createEvent("command", name, payload);
    inputStream = new ReadableStream({
      start(controller) {
        controller.enqueue(event);
        controller.close();
      },
    });
  } else {
    // B. Pipe Mode (Stdin -> NDJSON Stream)
    // Protocol: NDJSON (Newline Delimited JSON)
    // Rationale:
    // 1. Unix-Native: Works with grep, awk, sed, and standard pipes.
    // 2. LLM-Friendly: Sequential generation of thoughts/events.
    // 3. Robust: JSON.stringify() guarantees single-line output (escaping internal newlines).
    inputStream = Deno.stdin.readable
      .pipeThrough(new TextDecoderStream())
      .pipeThrough(new TextLineStream())
      .pipeThrough(
        new TransformStream<string, OsEvent>({
          transform(line, controller) {
            if (!line.trim()) return; // Skip empty lines
            try {
              const json = JSON.parse(line);

              // Strict Validation: Ensure it looks like an OsEvent
              // We do a lightweight check here for performance.
              // Full Zod validation happens inside specific handlers if needed.
              if (!json.type || !json.name) {
                throw new Error("Missing required fields: type, name");
              }

              controller.enqueue(json);
            } catch (e: any) {
              // Protocol Violation: Emit an Error Event to the stream
              // This ensures the pipe doesn't crash, but the caller knows something went wrong.
              console.error(`[Kernel Protocol Violation] Invalid NDJSON: ${e.message}`);
              // Optionally: controller.enqueue(createError(..., "Invalid NDJSON"));
            }
          },
        })
      );
  }

  // 2. Build Pipeline
  // Source -> Logger -> Router -> JSON Stringifier -> Stdout
  await inputStream
    .pipeThrough(loggerStream)
    .pipeThrough(routerStream)
    .pipeThrough(new JsonStringifyStream()) // Converts objects to JSON strings
    .pipeThrough(new TextEncoderStream())   // Converts strings to bytes
    .pipeTo(Deno.stdout.writable);
}

// Run if main
if (import.meta.main) {
  try {
    await runKernel();
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


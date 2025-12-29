/**
 * os/kernel/dispatch/engine.ts
 *
 * Core Dispatch Engine (RFC-23 Stage 1)
 *
 * Pure function that routes OsEvents to registered syscall handlers.
 * Extracted from router.ts to enable reuse across runtime modes.
 */

import { OsEvent, createEvent, createError } from "../events.ts";
import { SyscallModule } from "../syscalls/contract.ts";

export type Registry = Record<string, SyscallModule<any, any>>;

/**
 * Dispatch a single OsEvent to the appropriate handler.
 *
 * Returns a response or error event.
 */
export async function dispatch(
  event: OsEvent,
  registry: Registry
): Promise<OsEvent> {
  try {
    // 1. Filter: Only process commands and queries
    if (event.type !== "command" && event.type !== "query") {
      // Pass through events, responses, and errors unchanged
      return event;
    }

    // 2. Route: Look up handler
    const module = registry[event.name];
    let result: unknown;
    let handled = false;

    if (module) {
      // Native handler found
      let inputData = event.payload;

      // Check for CLI/Shell adapter requirement
      if (Array.isArray(inputData) && module.cliAdapter) {
        // Convert array args to structured input
        inputData = module.cliAdapter(inputData.map(String));
      }

      // A. Validate input
      const input = await module.InputSchema.parseAsync(inputData);

      // B. Execute handler
      const output = await module.handler(input, event);

      // C. Validate output
      result = module.OutputSchema.parse(output);
      handled = true;
    } else {
      // Mode 3: Shell fallback
      // If no native handler, try to execute as a shell command.

      let args: string[] = [];
      if (Array.isArray(event.payload)) {
        args = event.payload.map(String);
      } else if (typeof event.payload === "string") {
        args = [event.payload];
      } else if (
        typeof event.payload === "object" &&
        event.payload !== null &&
        "args" in event.payload
      ) {
        // @ts-ignore
        args = (event.payload.args as any[]).map(String);
      }

      const cmd = new Deno.Command(event.name, {
        args,
        stdout: "piped",
        stderr: "piped",
      });

      const output = await cmd.output();
      const decoder = new TextDecoder();
      const stdout = decoder.decode(output.stdout);
      const stderr = decoder.decode(output.stderr);

      if (!output.success) {
        throw new Error(
          `Shell command '${event.name}' failed (exit code ${output.code}): ${stderr}`
        );
      }

      result = {
        stdout,
        stderr,
        code: output.code,
      };
      handled = true;
    }

    // 3. Response: Wrap result in a new event
    if (handled) {
      return createEvent(
        "response",
        event.name,
        result,
        undefined, // New ID
        event.metadata?.correlation, // Preserve workflow correlation
        event.metadata?.id // This event caused the result
      );
    }

    // Should never reach here
    throw new Error("Event was not handled");
  } catch (err: any) {
    // 4. Error handling: Return error event instead of throwing
    console.error(err); // Print stack trace to stderr
    return createError(event, err.message || String(err));
  }
}

/**
 * os/kernel/transport/dispatch/engine.ts
 *
 * Core Dispatch Engine (RFC-23 Stage 1)
 *
 * Pure function that routes OsMessages to registered syscall handlers.
 * Extracted from router.ts to enable reuse across runtime modes.
 */

import { OsMessage, createMessage, createError } from "../../lib/os-event.ts";
import { SyscallModule } from "../../handler/contract.ts";

export type Registry = Record<string, SyscallModule<any, any>>;

/**
 * Dispatch a single OsMessage to the appropriate handler.
 *
 * Returns a reply or error message.
 */
export async function dispatch(
  message: OsMessage,
  registry: Registry
): Promise<OsMessage> {
  try {
    // 1. Filter: Only process commands and queries
    if (message.kind !== "command" && message.kind !== "query") {
      // Pass through events, replies, and errors unchanged
      return message;
    }

    // 2. Route: Look up handler
    const module = registry[message.type];
    let result: unknown;
    let handled = false;

    if (module) {
      // Native handler found
      let inputData = message.data;

      // Check for CLI/Shell adapter requirement
      if (Array.isArray(inputData) && module.cliAdapter) {
        // Convert array args to structured input
        inputData = module.cliAdapter(inputData.map(String));
      }

      // A. Validate input
      const input = await module.InputSchema.parseAsync(inputData);

      // B. Execute handler
      const output = await module.handler(input, message);

      // C. Validate output
      result = module.OutputSchema.parse(output);
      handled = true;
    } else {
      // Mode 3: Shell fallback
      // If no native handler, try to execute as a shell command.

      let args: string[] = [];
      if (Array.isArray(message.data)) {
        args = message.data.map(String);
      } else if (typeof message.data === "string") {
        args = [message.data];
      } else if (
        typeof message.data === "object" &&
        message.data !== null &&
        "args" in message.data
      ) {
        // @ts-ignore
        args = (message.data.args as any[]).map(String);
      }

      const cmd = new Deno.Command(message.type, {
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
          `Shell command '${message.type}' failed (exit code ${output.code}): ${stderr}`
        );
      }

      result = {
        stdout,
        stderr,
        code: output.code,
      };
      handled = true;
    }

    // 3. Response: Wrap result in a new message
    if (handled) {
      return createMessage(
        "reply",
        message.type,
        result,
        undefined, // New ID
        message.metadata?.correlation, // Preserve workflow correlation
        message.metadata?.id // This message caused the result
      );
    }

    // Should never reach here
    throw new Error("Message was not handled");
  } catch (err: any) {
    // 4. Error handling: Return error message instead of throwing
    console.error(err); // Print stack trace to stderr
    return createError(message, err.message || String(err));
  }
}

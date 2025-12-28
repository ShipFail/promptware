/**
 * os/kernel/streams/router.ts
 *
 * The Central Dispatch for the Reactive Kernel.
 * Routes OsEvents to specific Syscall Handlers based on `event.name`.
 */

import { SyscallStream } from "./interface.ts";
import { createEvent, createError, OsEvent } from "../events.ts";
import { SyscallModule } from "../syscalls/contract.ts";
import { registry as baseRegistry } from "../registry.ts";
import sysDescribeModule from "../syscalls/sys-describe.ts";

// Full Registry (Base + System Utilities)
const registry: Record<string, SyscallModule<any, any>> = {
  ...baseRegistry,
  "Sys.Describe": sysDescribeModule,
};

export const routerStream: SyscallStream = new TransformStream({
  async transform(event: OsEvent, controller) {
    try {
      // 1. Filter: Process Commands and Queries only
      if (event.type !== "command" && event.type !== "query") {
        // Pass through events, results, and errors unchanged
        controller.enqueue(event);
        return;
      }

      // 2. Route: Dispatch based on event name
      let result: unknown;
      let handled = false;

      const module = registry[event.name];

      if (module) {
        // Native Handler Found
        let inputData = event.payload;

        // Check for CLI/Shell Adapter requirement
        if (Array.isArray(inputData) && module.cliAdapter) {
          // Convert array args to structured input
          inputData = module.cliAdapter(inputData.map(String));
        }

        // A. Validate Input
        const input = await module.InputSchema.parseAsync(inputData);

        // B. Execute Handler
        const output = await module.handler(input, event);

        // C. Validate Output
        result = module.OutputSchema.parse(output);
        handled = true;
      } else {
        // Mode 3: Shell Fallback
        // If no native handler, try to execute as a shell command.
        // This relies on the LLM to interpret the raw text output.
        
        // Note: Shell fallback expects an array of strings as arguments.
        // If event.payload is an object, we might need to convert it or fail.
        // For now, we assume shell commands are sent as { args: [...] } or just an array.
        
        let args: string[] = [];
        if (Array.isArray(event.payload)) {
          args = event.payload.map(String);
        } else if (typeof event.payload === "string") {
          args = [event.payload];
        } else if (typeof event.payload === "object" && event.payload !== null && "args" in event.payload) {
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

      // 3. Response: Wrap result in a new Event
      if (handled) {
        const response = createEvent(
          "response",
          event.name,
          result,
          undefined, // New ID
          event.metadata?.correlation, // Preserve workflow correlation
          event.metadata?.id // This event caused the result
        );
        controller.enqueue(response);
      }

    } catch (err: any) {
      // 4. Error Handling: Fail-Safe
      // Emit an Error Event instead of crashing the stream
      console.error(err); // Print stack trace to stderr
      const errorEvent = createError(event, err.message || String(err));
      controller.enqueue(errorEvent);
    }
  },
});

/**
 * os/kernel/bus/dispatch/engine.ts
 *
 * Core Routing Engine (RFC-23 Stage 1)
 *
 * Pure function that routes OsMessages to registered capabilities.
 * Extracted from router.ts to enable reuse across runtime modes.
 */

import { OsMessage, createMessage, createError } from "../schema/message.ts";
import { Capability } from "../schema/contract.ts";
import { logger } from "./logger.ts";

export type Registry = Record<string, Capability<any, any>>;

/**
 * Route a single OsMessage to the appropriate capability.
 *
 * Returns a reply or error message.
 */
export async function route(
  message: OsMessage,
  registry: Registry
): Promise<OsMessage> {
  try {
    // 1. Filter: Only process commands and queries
    if (message.kind !== "command" && message.kind !== "query") {
      // Pass through events, replies, and errors unchanged
      return message;
    }

    // 2. Route: Look up capability
    const capability = registry[message.type];

    if (capability) {
      // Native capability found
      
      // A. Validate input
      // Note: We assume message.data matches the schema structure.
      // If it's an array (CLI args), we might need a separate adapter layer before this.
      // For now, we assume structured input.
      const input = await capability.inbound.parseAsync(message);

      // B. Execute capability (Stream Processing)
      // Create a fresh processor instance for this request (Crash-Only/Resilient)
      const processor = capability.factory();

      // Use concurrent pipeTo pattern to avoid deadlock
      // The writable side waits for readable to drain, and vice versa
      const results: OsMessage[] = [];
      const collector = new WritableStream<OsMessage>({
        write(chunk) {
          results.push(chunk);
        },
      });

      const inputStream = new ReadableStream<OsMessage>({
        start(controller) {
          controller.enqueue(input);
          controller.close();
        },
      });

      // Run both pipes CONCURRENTLY - this is critical!
      await Promise.all([
        inputStream.pipeTo(processor.writable),
        processor.readable.pipeTo(collector),
      ]);

      if (results.length === 0) {
        throw new Error("Capability processor returned no output");
      }

      // C. Validate output
      const output = await capability.outbound.parseAsync(results[0]);
      return output;

    } else {
      // Mode 3: Shell fallback
      // If no native capability, try to execute as a shell command.
      logger.info(`Shell fallback: ${message.type}`, { data: message.data });

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
        const errorMsg = `Shell command '${message.type}' failed (exit code ${output.code}): ${stderr}`;
        logger.warn(errorMsg, { stdout, stderr, code: output.code });
        throw new Error(errorMsg);
      }

      const result = {
        stdout,
        stderr,
        code: output.code,
      };
      
      return createMessage(
        "reply",
        message.type,
        result,
        undefined, // New ID
        message.metadata?.correlation, // Preserve workflow correlation
        message.metadata?.id // This message caused the result
      );
    }
  } catch (err: any) {
    // 4. Error handling: Return error message instead of throwing
    logger.error("Kernel Panic (Recovered)", { 
      type: message.type, 
      id: message.metadata?.id 
    }, err);
    return createError(message, err.message || String(err));
  }
}

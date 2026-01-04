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
      // Mode 3: Secure Fallback (RFC-23)
      // If no native capability is found, return a 404 error.
      // We NEVER execute arbitrary shell commands here.
      
      logger.warn(`Capability not found: ${message.type}`, { 
        id: message.metadata?.id,
        correlation: message.metadata?.correlation 
      });

      return createError(message, {
        code: 404,
        message: `Capability '${message.type}' not found in registry.`
      });
    }
  } catch (err: any) {
    // 4. Error handling: Return error message instead of throwing
    logger.error("Kernel Panic (Recovered)", { 
      type: message.type, 
      id: message.metadata?.id 
    }, err);
    return createError(message, err);
  }
}

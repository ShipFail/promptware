/**
 * os/kernel/bus/router.ts
 *
 * The Central Router for the Reactive Kernel.
 * Routes OsMessages to specific Capabilities based on `message.type`.
 *
 * Architecture: Pure TransformStream (Sequential Stream Joining)
 */

import { OsMessage, createError } from "../schema/message.ts";
import { Capability } from "../schema/capability.ts";
import { logger } from "./logger.ts";

export type Registry = Record<string, Capability<any, any>>;

/**
 * Creates a Router Stream that dispatches messages to capabilities.
 *
 * @param registry The capability registry.
 * @returns A TransformStream that accepts commands/queries and emits replies/events.
 */
export function createRouter(registry: Registry): TransformStream<OsMessage, OsMessage> {
  return new TransformStream({
    async transform(message: OsMessage, controller) {
      try {
        // 1. Filter: Only process commands and queries
        if (message.kind !== "command" && message.kind !== "query") {
          // Pass through events, replies, and errors unchanged
          controller.enqueue(message);
          return;
        }

        // 2. Route: Look up capability
        const capability = registry[message.type];

        if (capability) {
          // Native capability found
          
          // A. Validate input
          const input = await capability.inbound.parseAsync(message);

          // B. Execute capability (Stream Joining)
          // We pipe the capability's output DIRECTLY to the router's output.
          // No buffering. No arrays. Pure flow.
          const processor = capability.factory();

          // Create a single-item stream for the input
          const inputStream = new ReadableStream({
            start(c) {
              c.enqueue(input);
              c.close();
            }
          });

          // Pipe: Input -> Processor -> Router Output
          await inputStream.pipeThrough(processor).pipeTo(new WritableStream({
            write(chunk) {
              controller.enqueue(chunk);
            }
          }));

        } else {
          // Mode 3: Secure Fallback (RFC-23)
          logger.warn(`Capability not found: ${message.type}`, { 
            id: message.metadata?.id,
            correlation: message.metadata?.correlation 
          });

          controller.enqueue(createError(message, {
            code: 404,
            message: `Capability '${message.type}' not found in registry.`
          }));
        }
      } catch (err: any) {
        // 4. Error handling: Return error message instead of throwing
        logger.error("Kernel Panic (Recovered)", { 
          type: message.type, 
          id: message.metadata?.id 
        }, err);
        controller.enqueue(createError(message, err));
      }
    }
  });
}

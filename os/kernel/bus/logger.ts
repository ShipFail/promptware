/**
 * os/kernel/bus/stream/logger.ts
 *
 * A simple middleware stream that logs events to stderr.
 * This ensures stdout remains clean for the JSON stream.
 */

import { OsMessage } from "../schema/message.ts";
import { BusStream } from "./stream-types.ts";

export const loggerStream: BusStream = new TransformStream({
  transform(message: OsMessage, controller) {
    // Log to stderr to avoid polluting the stdout JSON stream
    // Use 'kind' if available, or infer from type/structure if needed.
    // Assuming OsMessage has 'kind' or we just log the type.
    // In the new protocol, we have Command/Query/Event/Response types.
    // We can check 'kind' if it exists on the union, or just log the type.
    
    // RFC-24: OsMessage = Command | Query | Event | Response | ErrorMessage
    // They all have 'type' and 'id'.
    
    const timestamp = message.metadata?.timestamp 
      ? new Date(message.metadata.timestamp).toISOString() 
      : new Date().toISOString();

    console.error(
      `[${timestamp}] ` +
        `${message.type} ` +
        `(ID: ${message.metadata?.id || "unknown"})`
    );

    // Pass the message through unchanged
    controller.enqueue(message);
  },
});

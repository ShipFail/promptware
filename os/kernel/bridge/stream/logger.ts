/**
 * os/kernel/bridge/stream/logger.ts
 *
 * A simple middleware stream that logs events to stderr.
 * This ensures stdout remains clean for the JSON stream.
 */

import { OsEvent } from "../../lib/event.ts";
import { SyscallStream } from "./interface.ts";

export const loggerStream: SyscallStream = new TransformStream({
  transform(event: OsEvent, controller) {
    // Log to stderr to avoid polluting the stdout JSON stream
    const typeStr = `${event.type.toUpperCase()} `;
    console.error(
      `[${new Date(event.metadata?.timestamp || Date.now()).toISOString()}] ` +
        `${typeStr}${event.name} ` +
        `(ID: ${event.metadata?.id || "unknown"})`
    );

    // Pass the event through unchanged
    controller.enqueue(event);
  },
});

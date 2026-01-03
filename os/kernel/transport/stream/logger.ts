/**
 * os/kernel/transport/stream/logger.ts
 *
 * A simple middleware stream that logs events to stderr.
 * This ensures stdout remains clean for the JSON stream.
 */

import { OsMessage } from "../../lib/os-event.ts";
import { SyscallStream } from "./interface.ts";

export const loggerStream: SyscallStream = new TransformStream({
  transform(message: OsMessage, controller) {
    // Log to stderr to avoid polluting the stdout JSON stream
    const kindStr = `${message.kind.toUpperCase()} `;
    console.error(
      `[${new Date(message.metadata?.timestamp || Date.now()).toISOString()}] ` +
        `${kindStr}${message.type} ` +
        `(ID: ${message.metadata?.id || "unknown"})`
    );

    // Pass the message through unchanged
    controller.enqueue(message);
  },
});

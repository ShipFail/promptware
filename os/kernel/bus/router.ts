/**
 * os/kernel/bus/stream/router.ts
 *
 * The Central Router for the Reactive Kernel.
 * Routes OsMessages to specific Capabilities based on `message.type`.
 *
 * Refactored (RFC-23 Stage 1): Now uses the routing engine.
 */

import { BusStream } from "./stream-types.ts";
import { OsMessage } from "../schema/message.ts";
import { registry } from "../capabilities/registry.ts";
import { route } from "./engine.ts";

export const routerStream: BusStream = new TransformStream({
  async transform(message: OsMessage, controller) {
    // Delegate to routing engine
    const result = await route(message, registry);
    controller.enqueue(result);
  },
});

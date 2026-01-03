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
import { Capability } from "../schema/contract.ts";
import { registry as baseRegistry } from "../handlers/registry.ts";
import sysDescribeModule from "../handlers/describe.ts";
import { route } from "./engine.ts";

// Full Registry (Base + System Utilities)
const registry: Record<string, Capability<any, any>> = {
  ...baseRegistry,
  "Sys.Describe": sysDescribeModule,
};

export const routerStream: BusStream = new TransformStream({
  async transform(message: OsMessage, controller) {
    // Delegate to routing engine
    const result = await route(message, registry);
    controller.enqueue(result);
  },
});

/**
 * os/kernel/bus/stream/router.ts
 *
 * The Central Router for the Reactive Kernel.
 * Routes OsMessages to specific Capabilities based on `message.type`.
 *
 * Refactored (RFC-23 Stage 1): Now uses the routing engine.
 */

import { BusStream } from "./interface.ts";
import { OsMessage } from "../../protocol/message.ts";
import { Capability } from "../../capabilities/contract.ts";
import { registry as baseRegistry } from "../../capabilities/registry.ts";
import sysDescribeModule from "../../capabilities/describe.ts";
import { route } from "../dispatch/engine.ts";

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

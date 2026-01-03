/**
 * os/kernel/transport/stream/router.ts
 *
 * The Central Dispatch for the Reactive Kernel.
 * Routes OsMessages to specific Syscall Handlers based on `message.type`.
 *
 * Refactored (RFC-23 Stage 1): Now uses the dispatch engine.
 */

import { SyscallStream } from "./interface.ts";
import { OsMessage } from "../../lib/os-event.ts";
import { SyscallModule } from "../../handler/contract.ts";
import { registry as baseRegistry } from "../../registry.ts";
import sysDescribeModule from "../../handler/describe.ts";
import { dispatch } from "../dispatch/engine.ts";

// Full Registry (Base + System Utilities)
const registry: Record<string, SyscallModule<any, any>> = {
  ...baseRegistry,
  "Sys.Describe": sysDescribeModule,
};

export const routerStream: SyscallStream = new TransformStream({
  async transform(event: OsMessage, controller) {
    // Delegate to dispatch engine
    const result = await dispatch(event, registry);
    controller.enqueue(result);
  },
});

/**
 * os/kernel/bus/handler/shutdown.ts
 *
 * RFC-23 Stage 4: Syscall.Shutdown
 *
 * Reserved capability for graceful worker shutdown.
 * In inline mode: No-op (process exits naturally)
 * In worker mode: Closes listener, removes socket, exits
 */

import { z } from "jsr:@zod/zod";
import { Capability } from "../schema/contract.ts";
import { createMessage } from "../schema/message.ts";
import { requestShutdown } from "../bus/lifecycle.ts";

// Input Schema
const ShutdownInput = z.object({
  // Future: Add shutdown options (force, timeout, etc.)
}).describe("Input for Syscall.Shutdown");

// Output Schema
const ShutdownOutput = z.object({
  message: z.string().describe("Shutdown acknowledgment message"),
}).describe("Output from Syscall.Shutdown");

export const ShutdownModule = {
  "Syscall.Shutdown": (): Capability<any, any> => ({
    description: "Request graceful shutdown of the kernel.",
    inbound: z.object({
      kind: z.literal("command"),
      type: z.literal("Syscall.Shutdown"),
      data: ShutdownInput
    }),
    outbound: z.object({
      kind: z.literal("reply"),
      type: z.literal("Syscall.Shutdown"),
      data: ShutdownOutput
    }),
    factory: () => new TransformStream({
      async transform(msg, controller) {
        requestShutdown();
        controller.enqueue(createMessage("reply", "Syscall.Shutdown", { message: "Shutdown acknowledged" }, undefined, msg.metadata?.correlation, msg.metadata?.id));
      }
    })
  })
};

export default ShutdownModule;

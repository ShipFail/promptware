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
import { Capability } from "../../capabilities/contract.ts";
import { OsMessage } from "../../protocol/message.ts";
import { requestShutdown } from "../runtime/lifecycle.ts";

// Input Schema
const ShutdownInput = z.object({
  // Future: Add shutdown options (force, timeout, etc.)
}).describe("Input for Syscall.Shutdown");

// Output Schema
const ShutdownOutput = z.object({
  message: z.string().describe("Shutdown acknowledgment message"),
}).describe("Output from Syscall.Shutdown");

const shutdownCapability: Capability<
  typeof ShutdownInput,
  typeof ShutdownOutput
> = {
  type: "command",
  InputSchema: ShutdownInput,
  OutputSchema: ShutdownOutput,

  process: async (_input: z.infer<typeof ShutdownInput>, _message: OsMessage): Promise<z.infer<typeof ShutdownOutput>> => {
    // Trigger graceful shutdown (only affects worker mode)
    requestShutdown();

    return {
      message: "Shutdown acknowledged",
    };
  },

  // CLI adapter: Convert empty args to empty object
  fromArgs: (_args: string[]) => {
    return {};
  },
};

export default shutdownCapability;

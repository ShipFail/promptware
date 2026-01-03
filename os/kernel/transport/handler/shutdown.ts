/**
 * os/kernel/syscalls/syscall-shutdown.ts
 *
 * RFC-23 Stage 4: Syscall.Shutdown
 *
 * Reserved syscall for graceful worker shutdown.
 * In inline mode: No-op (process exits naturally)
 * In worker mode: Closes listener, removes socket, exits
 */

import { z } from "jsr:@zod/zod";
import { SyscallModule } from "../../handler/contract.ts";
import { OsMessage } from "../../lib/os-event.ts";
import { requestWorkerShutdown } from "../runtime/worker.ts";

// Input Schema
const ShutdownInput = z.object({
  // Future: Add shutdown options (force, timeout, etc.)
}).describe("Input for Syscall.Shutdown");

// Output Schema
const ShutdownOutput = z.object({
  message: z.string().describe("Shutdown acknowledgment message"),
}).describe("Output from Syscall.Shutdown");

const syscallShutdownModule: SyscallModule<
  typeof ShutdownInput,
  typeof ShutdownOutput
> = {
  type: "command",
  InputSchema: ShutdownInput,
  OutputSchema: ShutdownOutput,

  handler: async (_input: z.infer<typeof ShutdownInput>, _message: OsMessage): Promise<z.infer<typeof ShutdownOutput>> => {
    // Trigger graceful shutdown (only affects worker mode)
    requestWorkerShutdown();

    return {
      message: "Shutdown acknowledged",
    };
  },

  // CLI adapter: Convert empty args to empty object
  cliAdapter: (_args: string[]) => {
    return {};
  },
};

export default syscallShutdownModule;

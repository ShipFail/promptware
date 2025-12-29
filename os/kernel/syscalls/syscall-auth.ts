/**
 * os/kernel/syscalls/syscall-auth.ts
 *
 * RFC-23 Stage 2: Syscall.Authenticate
 *
 * Reserved syscall for client-daemon connection prologue.
 * In inline mode: No-op (authentication not required)
 * In daemon mode: Validates client credentials (Stage 4)
 */

import { z } from "jsr:@zod/zod";
import { SyscallModule } from "./contract.ts";
import { OsEvent } from "../events.ts";

// Input Schema
const AuthenticateInput = z.object({
  // Future: Add authentication fields (API key, token, etc.)
  // For now, accept empty object or any payload
}).describe("Input for Syscall.Authenticate");

// Output Schema
const AuthenticateOutput = z.object({
  authenticated: z.boolean().describe("Whether authentication succeeded"),
  message: z.string().describe("Authentication status message"),
}).describe("Output from Syscall.Authenticate");

const syscallAuthModule: SyscallModule<
  typeof AuthenticateInput,
  typeof AuthenticateOutput
> = {
  type: "command",
  InputSchema: AuthenticateInput,
  OutputSchema: AuthenticateOutput,

  handler: async (_input: z.infer<typeof AuthenticateInput>, _event: OsEvent): Promise<z.infer<typeof AuthenticateOutput>> => {
    // Inline mode: No-op (always succeeds)
    // Daemon mode (Stage 4): Will check credentials
    return {
      authenticated: true,
      message: "Authentication successful (inline mode: no-op)",
    };
  },

  // CLI adapter: Convert empty args to empty object
  cliAdapter: (_args: string[]) => {
    return {};
  },
};

export default syscallAuthModule;

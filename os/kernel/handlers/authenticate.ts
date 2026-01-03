/**
 * os/kernel/bus/handler/authenticate.ts
 *
 * RFC-23 Stage 2: Syscall.Authenticate
 *
 * Reserved capability for main-worker connection prologue.
 * In inline mode: No-op (authentication not required)
 * In worker mode: Validates main credentials (Stage 4)
 */

import { z } from "jsr:@zod/zod";
import { Capability } from "../schema/contract.ts";
import { OsMessage } from "../schema/message.ts";

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

const authenticateCapability: Capability<
  typeof AuthenticateInput,
  typeof AuthenticateOutput
> = {
  type: "command",
  InputSchema: AuthenticateInput,
  OutputSchema: AuthenticateOutput,

  process: async (_input: z.infer<typeof AuthenticateInput>, _message: OsMessage): Promise<z.infer<typeof AuthenticateOutput>> => {
    // Inline mode: No-op (always succeeds)
    // Worker mode (Stage 4): Will check credentials
    return {
      authenticated: true,
      message: "Authentication successful (inline mode: no-op)",
    };
  },

  // CLI adapter: Convert empty args to empty object
  fromArgs: (_args: string[]) => {
    return {};
  },
};

export default authenticateCapability;

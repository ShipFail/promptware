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
import { Capability } from "../schema/capability.ts";
import { createMessage } from "../schema/message.ts";

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

export const SyscallAuthenticate: Capability<any, any> = {
  description: "Authenticate the connection (No-op in inline mode).",
  inbound: z.object({
    kind: z.literal("command"),
    type: z.literal("Syscall.Authenticate"),
    data: AuthenticateInput
  }),
  outbound: z.object({
    kind: z.literal("reply"),
    type: z.literal("Syscall.Authenticate"),
    data: AuthenticateOutput
  }),
  factory: () => new TransformStream({
    async transform(msg, controller) {
      const result = {
        authenticated: true,
        message: "Authentication successful (inline mode: no-op)",
      };
      controller.enqueue(createMessage("reply", "Syscall.Authenticate", result, undefined, msg.metadata?.correlation, msg.metadata?.id));
    }
  })
};

export default [SyscallAuthenticate];

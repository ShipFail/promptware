import { z } from "jsr:@zod/zod";
import { Capability } from "../schema/contract.ts";
import { createMessage, OsMessage } from "../schema/message.ts";
import { registry } from "./registry-store.ts";

const DescribeInput = z.object({
  capabilities: z.array(z.string()).describe("List of capabilities to describe. Use ['*'] for all."),
}).describe("Input for the Syscall.Describe capability.");

const DescribeOutput = z.object({
  schemas: z.record(z.string(), z.object({
    description: z.string(),
    // In a full implementation, we would serialize the Zod schema here.
    // For now, we return the human-readable description.
  }))
}).describe("Output from the Syscall.Describe capability.");

const DescribeInbound = z.object({
  kind: z.literal("query"),
  type: z.literal("Syscall.Describe"),
  data: DescribeInput,
});

const DescribeOutbound = z.object({
  kind: z.literal("reply"),
  type: z.literal("Syscall.Describe"),
  data: DescribeOutput,
});

export const SyscallDescribe: Capability<typeof DescribeInbound, typeof DescribeOutbound> = {
  description: "Introspects the kernel capabilities.",
  inbound: DescribeInbound,
  outbound: DescribeOutbound,
  factory: () => new TransformStream({
    async transform(msg, controller) {
      const data = msg.data as z.infer<typeof DescribeInput>;
      const targets = data.capabilities.includes("*") 
        ? Object.keys(registry) 
        : data.capabilities;

      const schemas: Record<string, { description: string }> = {};

      for (const target of targets) {
        const cap = registry[target];
        if (cap) {
          schemas[target] = {
            description: cap.description,
          };
        }
      }

      controller.enqueue(createMessage(
        "reply",
        "Syscall.Describe",
        { schemas },
        undefined,
        msg.metadata?.correlation,
        msg.metadata?.id
      ));
    }
  })
};

export default [SyscallDescribe];

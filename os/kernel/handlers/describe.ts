import { z } from "jsr:@zod/zod";
import { Capability } from "../schema/contract.ts";
import { createMessage, OsMessage } from "../schema/message.ts";
import { registry } from "./registry.ts";

const DescribeInput = z.object({
  capability: z.string().describe("The name of the capability to describe."),
}).describe("Input for the Sys.Describe capability.");

const DescribeOutput = z.object({
  name: z.string().describe("The capability name."),
  description: z.string().describe("Human-readable description."),
}).describe("Output from the Sys.Describe capability.");

const DescribeInbound = z.object({
  kind: z.literal("query"),
  type: z.literal("Sys.Describe"),
  data: DescribeInput,
});

const DescribeOutbound = z.object({
  kind: z.literal("reply"),
  type: z.literal("Sys.Describe"),
  data: DescribeOutput,
});

export default {
  "Sys.Describe": (): Capability<typeof DescribeInbound, typeof DescribeOutbound> => ({
    description: "Introspects the kernel capabilities.",
    inbound: DescribeInbound,
    outbound: DescribeOutbound,
    factory: () => new TransformStream({
      async transform(msg, controller) {
        const data = msg.data as z.infer<typeof DescribeInput>;
        const cap = registry[data.capability];

        if (!cap) {
          throw new Error(`Capability '${data.capability}' not found.`);
        }

        const result = {
          name: data.capability,
          description: cap.description,
        };

        controller.enqueue(createMessage(
          "reply",
          "Sys.Describe",
          result,
          undefined,
          msg.metadata?.correlation,
          msg.metadata?.id
        ));
      }
    })
  })
};

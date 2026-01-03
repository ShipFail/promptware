import { z } from "jsr:@zod/zod";
import { Capability } from "./contract.ts";
import { OsMessage } from "../protocol/message.ts";
import { registry } from "./registry.ts";

export const InputSchema = z.object({
  capability: z.string().describe("The name of the capability to describe."),
}).describe("Input for the sys/describe capability.");

export const OutputSchema = z.object({
  name: z.string().describe("The capability name (e.g., Memory.Get, Crypto.Seal)"),
  type: z.enum(["command", "query"]).describe("CQRS type discriminator"),
  input: z.any().describe("JSON Schema describing the capability input."),
  output: z.any().describe("JSON Schema describing the capability output."),
}).describe("Output from the Sys.Describe capability.");

export const process = async (input: z.infer<typeof InputSchema>, _message: OsMessage): Promise<z.infer<typeof OutputSchema>> => {
  const capability = registry[input.capability];

  if (!capability) {
    throw new Error(`Capability '${input.capability}' not found.`);
  }

  return {
    name: input.capability,
    type: capability.type,
    input: capability.InputSchema.toJSONSchema(),
    output: capability.OutputSchema.toJSONSchema(),
  };
};

const capability: Capability<typeof InputSchema, typeof OutputSchema> = {
  type: "query",
  InputSchema,
  OutputSchema,
  process,
  fromArgs: (args: string[]) => {
    if (args.length < 1) throw new Error("Usage: Sys.Describe <capability_name>");
    return { capability: args[0] };
  },
};

export default capability;

import { z } from "jsr:@zod/zod";
import { Capability } from "../schema/contract.ts";
import { OsMessage } from "../schema/message.ts";

export const InputSchema = z.object({
  message: z.string().describe("The message to echo back."),
}).describe("Input for the echo capability.");

export const OutputSchema = z.object({
  echo: z.string().describe("The echoed message."),
}).describe("Output from the echo capability.");

export const process = async (input: z.infer<typeof InputSchema>, _message: OsMessage): Promise<z.infer<typeof OutputSchema>> => {
  return { echo: input.message };
};

const capability: Capability<typeof InputSchema, typeof OutputSchema> = {
  type: "query",
  InputSchema,
  OutputSchema,
  process,
  fromArgs: (args: string[]) => ({ message: args.join(" ") }),
};

export default capability;

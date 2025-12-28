import { z } from "jsr:@zod/zod";
import { SyscallModule } from "./contract.ts";
import { OsEvent } from "../events.ts";

export const InputSchema = z.object({
  message: z.string().describe("The message to echo back."),
}).describe("Input for the echo syscall.");

export const OutputSchema = z.object({
  echo: z.string().describe("The echoed message."),
}).describe("Output from the echo syscall.");

export const handler = async (input: z.infer<typeof InputSchema>, _event: OsEvent): Promise<z.infer<typeof OutputSchema>> => {
  return { echo: input.message };
};

const module: SyscallModule<typeof InputSchema, typeof OutputSchema> = {
  type: "query",
  InputSchema,
  OutputSchema,
  handler,
  cliAdapter: (args: string[]) => ({ message: args.join(" ") }),
};

export default module;

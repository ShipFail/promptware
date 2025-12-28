import { z } from "jsr:@zod/zod";
import { SyscallModule } from "./contract.ts";
import { OsEvent } from "../events.ts";
import { registry } from "../registry.ts";

export const InputSchema = z.object({
  syscall: z.string().describe("The name of the syscall to describe."),
}).describe("Input for the sys/describe syscall.");

export const OutputSchema = z.object({
  name: z.string().describe("The syscall name (e.g., Memory.Get, Crypto.Seal)"),
  type: z.enum(["command", "query"]).describe("CQRS type discriminator"),
  input: z.any().describe("JSON Schema describing the syscall input."),
  output: z.any().describe("JSON Schema describing the syscall output."),
}).describe("Output from the Sys.Describe syscall.");

export const handler = async (input: z.infer<typeof InputSchema>, _event: OsEvent): Promise<z.infer<typeof OutputSchema>> => {
  const module = registry[input.syscall];

  if (!module) {
    throw new Error(`Syscall '${input.syscall}' not found.`);
  }

  return {
    name: input.syscall,
    type: module.type,
    input: module.InputSchema.toJSONSchema(),
    output: module.OutputSchema.toJSONSchema(),
  };
};

const module: SyscallModule<typeof InputSchema, typeof OutputSchema> = {
  type: "query",
  InputSchema,
  OutputSchema,
  handler,
  cliAdapter: (args: string[]) => {
    if (args.length < 1) throw new Error("Usage: Sys.Describe <syscall_name>");
    return { syscall: args[0] };
  },
};

export default module;

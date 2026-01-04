import { z } from "jsr:@zod/zod";
import { Capability } from "../schema/contract.ts";
import { createMessage } from "../schema/message.ts";
import { parseArgs } from "jsr:@std/cli/parse-args";
import { resolve } from "../vfs/core.ts";

/**
 * PromptWare ØS Resolve Capability
 *
 * Resolves URIs against a base context and OS root.
 * Implements TypeScript-style import resolution.
 */

const InputSchema = z.object({
  uri: z.string().describe("The URI to resolve (relative, absolute, or os://)"),
  base: z.string().optional().describe("Optional base context for relative paths"),
}).describe("Input for the resolve capability.");

const OutputSchema = z.object({
  resolved: z.string().url().describe("The fully resolved URL"),
}).describe("Output from the resolve capability.");

export const ResolveModule = {
  "FileSystem.Resolve": (): Capability<any, any> => ({
    description: "Resolve a URI against the OS root or a base context.",
    inbound: z.object({
      kind: z.literal("query"),
      type: z.literal("FileSystem.Resolve"),
      data: InputSchema
    }),
    outbound: z.object({
      kind: z.literal("reply"),
      type: z.literal("FileSystem.Resolve"),
      data: OutputSchema
    }),
    factory: () => new TransformStream({
      async transform(msg, controller) {
        const input = msg.data as z.infer<typeof InputSchema>;
        const resolved = await resolve(input.uri, input.base);
        controller.enqueue(createMessage("reply", "FileSystem.Resolve", { resolved }, undefined, msg.metadata?.correlation, msg.metadata?.id));
      }
    })
  })
};

export default ResolveModule;

// CLI Entry Point
if (import.meta.main) {
  const args = parseArgs(Deno.args, {
    string: ["root"],
    boolean: ["help"],
    alias: { help: "h" },
  });

  if (args.help) {
    console.log(`
Usage: deno run -A resolve.ts [--root <os_root>] <uri> [base]

Arguments:
  uri     The URI to resolve (relative, absolute, or os://).
  base    The base URI (context) to resolve relative paths against.

Options:
  --root <url>    The OS Root URL (optional, loads from KV if not provided).
  --help, -h      Show this help message.
`);
    Deno.exit(0);
  }

  const root = args.root;
  const uri = String(args._[0]);
  const base = args._[1] ? String(args._[1]) : undefined;

  if (!uri || uri === "undefined") {
    console.error("Error: Missing uri argument");
    Deno.exit(1);
  }

  try {
    console.log(await resolve(uri, base, root));
  } catch (e: any) {
    console.error(`Error: ${e.message}`);
    Deno.exit(1);
  }
}

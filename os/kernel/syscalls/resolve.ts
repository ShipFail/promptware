import { z } from "jsr:@zod/zod";
import { SyscallModule } from "./contract.ts";
import { OsEvent } from "../events.ts";
import { parseArgs } from "jsr:@std/cli/parse-args";
import { join, dirname } from "jsr:@std/path";

/**
 * PromptWare ØS Resolve Syscall
 *
 * Resolves URIs against a base context and OS root.
 * Implements TypeScript-style import resolution.
 */

function isUrl(path: string): boolean {
  try {
    new URL(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolves a URI against a Base and Root.
 */
async function resolve(uri: string, base?: string, explicitRoot?: string): Promise<string> {
  let root = explicitRoot;
  let mounts: Record<string, string> | undefined;

  if (!root) {
    const kv = await Deno.openKv();
    try {
      const res = await kv.get(["proc", "cmdline"]);
      if (res.value) {
        const params = JSON.parse(res.value as string);
        root = params.root;
        mounts = params.mounts;
      } else {
        throw new Error("Kernel Panic: proc/cmdline not found.");
      }
    } finally {
      kv.close();
    }
  }

  if (isUrl(uri)) {
    if (uri.startsWith("os://")) {
      const path = uri.replace("os://", "");

      if (mounts) {
        const parts = path.split("/");
        const topLevel = parts[0];
        if (mounts[topLevel]) {
          const rest = parts.slice(1).join("/");
          if (isUrl(mounts[topLevel])) {
            return new URL(rest, mounts[topLevel]).href;
          }
        }
      }

      return new URL(path, root).href;
    }
    return uri;
  }

  if (uri.startsWith("/")) {
    return new URL(uri.slice(1), root).href;
  }

  if (base) {
    if (isUrl(base)) {
      return new URL(uri, base).href;
    }
    return join(dirname(base), uri);
  }

  return new URL(uri, root).href;
}

export const InputSchema = z.object({
  uri: z.string().describe("The URI to resolve (relative, absolute, or os://)"),
  base: z.string().optional().describe("Optional base context for relative paths"),
}).describe("Input for the resolve syscall.");

export const OutputSchema = z.object({
  resolved: z.string().url().describe("The fully resolved URL"),
}).describe("Output from the resolve syscall.");

export const handler = async (input: z.infer<typeof InputSchema>, _event: OsEvent): Promise<z.infer<typeof OutputSchema>> => {
  const resolved = await resolve(input.uri, input.base);
  return { resolved };
};

const module: SyscallModule<typeof InputSchema, typeof OutputSchema> = {
  type: "query",
  InputSchema,
  OutputSchema,
  handler,
  cliAdapter: (args: string[]) => {
    if (args.length < 1) throw new Error("Usage: resolve <uri> [base]");
    return {
      uri: args[0],
      base: args[1],
    };
  },
};

export default module;

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

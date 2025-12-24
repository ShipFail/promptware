import { parseArgs } from "jsr:@std/cli/parse-args";
import { join, dirname } from "jsr:@std/path";

/**
 * PromptWar̊e ØS Syscall: Resolve
 * Resolves a URI against a Base and Root.
 * Implements the "Law of Anchoring" and "TypeScript Import" style.
 */

const HELP_TEXT = `
Usage: deno run -A resolve.ts --root <os_root> <uri> [base]

Arguments:
  uri     The URI to resolve (relative, absolute, or os://).
  base    The base URI (context) to resolve relative paths against.

Options:
  --root <url>    The OS Root URL (Required).
  --help, -h      Show this help message.
`;

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
export default async function resolve(uri: string, base?: string, explicitRoot?: string): Promise<string> {
  let root = explicitRoot;
  let mounts: Record<string, string> | undefined;

  if (!root) {
    // Load Root from KV
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

  // 1. Absolute URLs (http://, https://, file://)
  if (isUrl(uri)) {
    // Handle os:// protocol
    if (uri.startsWith("os://")) {
      const path = uri.replace("os://", "");
      
      // Check mounts first
      if (mounts) {
        const parts = path.split("/");
        const topLevel = parts[0];
        if (mounts[topLevel]) {
           const rest = parts.slice(1).join("/");
           // If mount is a URL, resolve against it
           if (isUrl(mounts[topLevel])) {
             return new URL(rest, mounts[topLevel]).href;
           }
        }
      }

      return new URL(path, root).href;
    }
    return uri;
  }

  // 2. OS-Absolute Paths (starting with /)
  // Anchored to OS Root
  if (uri.startsWith("/")) {
    // Remove leading slash to append to root
    return new URL(uri.slice(1), root).href;
  }

  // 3. Relative Paths (./, ../, or simple filenames)
  // Anchored to Base (Context)
  if (base) {
    // If base is a URL
    if (isUrl(base)) {
      return new URL(uri, base).href;
    }
    // If base is a local file path
    return join(dirname(base), uri);
  }

  // 4. Fallback: If no base, assume relative to Root
  return new URL(uri, root).href;
}

// CLI Entry Point
if (import.meta.main) {
  const args = parseArgs(Deno.args, {
    string: ["root"],
    boolean: ["help"],
    alias: { help: "h" },
  });

  if (args.help) {
    console.log(HELP_TEXT);
    Deno.exit(0);
  }

  const root = args.root;
  if (!root) {
    console.error("Error: --root <url> is required.");
    Deno.exit(1);
  }

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

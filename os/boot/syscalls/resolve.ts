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
export function resolveUri(root: string, uri: string, base?: string): string {
  // 1. Absolute URLs (http://, https://, file://)
  if (isUrl(uri)) {
    // Handle os:// protocol
    if (uri.startsWith("os://")) {
      const path = uri.replace("os://", "");
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

async function main() {
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
    console.log(resolveUri(root, uri, base));
  } catch (e: any) {
    console.error(`Error: ${e.message}`);
    Deno.exit(1);
  }
}

if (import.meta.main) {
  main();
}

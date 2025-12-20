import { parseArgs } from "jsr:@std/cli/parse-args";

/**
 * PromptWar̊e ØS Syscall: Memory
 * Manages OS memory using Deno KV.
 */

const HELP_TEXT = `
Usage: deno run -A memory.ts --root <os_root> <action> [key] [value]

Arguments:
  action  The action to perform (get, set, delete, list).
  key     The key to operate on (required for get, set, delete).
  value   The value to set (required for set).

Options:
  --root <url>    The OS Root URL (Required).
  --help, -h      Show this help message.
`;

export async function memory(action: string, keyStr?: string, value?: string): Promise<void> {
  const kv = await Deno.openKv(); // Uses default location or --location flag (passed via Deno args in real usage, but here we rely on caller context or default)
  // Note: In a real deployment, we'd want to pass the location based on root, but Deno KV location is a CLI flag to the Deno process, not an API option.
  // So we assume the caller (Kernel) runs this script with --location <root_hash> if needed.
  
  try {
    const parseKey = (k: string) => k.split("/").filter(p => p.length > 0);

    if (action === "set") {
      if (!keyStr || value === undefined) throw new Error("Missing key or value");
      await kv.set(parseKey(keyStr), value);
      console.log(`[ OK ] Set ${keyStr}`);
    } else if (action === "get") {
      if (!keyStr) throw new Error("Missing key");
      const res = await kv.get(parseKey(keyStr));
      console.log(res.value === null ? "[ NULL ]" : res.value);
    } else if (action === "delete") {
      if (!keyStr) throw new Error("Missing key");
      await kv.delete(parseKey(keyStr));
      console.log(`[ OK ] Deleted ${keyStr}`);
    } else if (action === "list") {
      const prefix = keyStr ? parseKey(keyStr) : [];
      for await (const entry of kv.list({ prefix })) {
        console.log(`${entry.key.join("/")}: ${entry.value}`);
      }
    } else {
      throw new Error(`Unknown action: ${action}`);
    }
  } finally {
    kv.close();
  }
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

  // Root is technically not used inside the function logic (Deno KV handles isolation via --location flag on process start),
  // but we keep it for consistency with the syscall signature.
  const root = args.root;
  if (!root) {
    console.error("Error: --root <url> is required.");
    Deno.exit(1);
  }

  const action = String(args._[0]);
  const key = args._[1] ? String(args._[1]) : undefined;
  const value = args._[2] ? String(args._[2]) : undefined;

  if (!action || action === "undefined") {
    console.error("Error: Missing action argument");
    Deno.exit(1);
  }

  try {
    await memory(action, key, value);
  } catch (e: any) {
    console.error(`Error: ${e.message}`);
    Deno.exit(1);
  }
}

if (import.meta.main) {
  main();
}

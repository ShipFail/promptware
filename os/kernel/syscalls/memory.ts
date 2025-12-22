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

export default async function memory(root: string, action: string, keyStr?: string, value?: string): Promise<any> {
  const kv = await Deno.openKv();
  try {
    const parseKey = (k: string) => k.split("/").filter(p => p.length > 0);

    if (action === "set") {
      if (!keyStr || value === undefined) throw new Error("Missing key or value");
      
      let valToSave: any = value;
      try {
        valToSave = JSON.parse(value);
      } catch {
        // If parsing fails, save as string
      }

      await kv.set(parseKey(keyStr), valToSave);
      return `[ OK ] Set ${keyStr}`;
    } else if (action === "get") {
      if (!keyStr) throw new Error("Missing key");
      const res = await kv.get(parseKey(keyStr));
      return res.value;
    } else if (action === "delete") {
      if (!keyStr) throw new Error("Missing key");
      await kv.delete(parseKey(keyStr));
      return `[ OK ] Deleted ${keyStr}`;
    } else if (action === "list") {
      const prefix = keyStr ? parseKey(keyStr) : [];
      const result: Record<string, any> = {};
      for await (const entry of kv.list({ prefix })) {
        result[entry.key.join("/")] = entry.value;
      }
      return result;
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
    const result = await memory(root, action, key, value);
    if (typeof result === "object") {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(result);
    }
  } catch (e: any) {
    console.error(`Error: ${e.message}`);
    Deno.exit(1);
  }
}

if (import.meta.main) {
  main();
}

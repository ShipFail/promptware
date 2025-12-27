import { parseArgs } from "jsr:@std/cli/parse-args";

/**
 * PromptWar̊e ØS Syscall: Memory
 * Manages OS memory using Deno KV.
 * Implements RFC 0018: Memory Subsystem Specification.
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
  --description   Show tool description (RFC 0012).
`;

const TOOL_DESCRIPTION = "Manages OS memory using Deno KV. Supports /vault/ namespace for sealed storage (RFC 0018).";

export default async function memory(action: string, keyStr?: string, value?: string): Promise<any> {
  const kv = await Deno.openKv();
  try {
    const parseKey = (k: string) => {
      if (!k.startsWith("/")) {
        throw new Error(`Invalid path: '${k}'. Paths MUST be absolute (start with /).`);
      }
      return k.split("/").filter(p => p.length > 0);
    };

    if (action === "set") {
      if (!keyStr || value === undefined) throw new Error("Missing key or value");
      
      // RFC 0018: Vault Enforcement
      if (keyStr.startsWith("/vault/")) {
        if (!value.startsWith("pwenc:v1:")) {
          throw new Error("E_VAULT_REQUIRES_PWENC: /vault/ paths accept only ciphertext (pwenc:v1:...).");
        }
      }

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

// CLI Entry Point
async function main() {
  const args = parseArgs(Deno.args, {
    string: ["root"],
    boolean: ["help", "description"],
    alias: { help: "h" },
  });

  if (args.help) {
    console.log(HELP_TEXT);
    Deno.exit(0);
  }

  if (args.description) {
    console.log(TOOL_DESCRIPTION);
    Deno.exit(0);
  }

  // Note: --root is not strictly used by memory.ts (it uses Deno.openKv which respects --location)
  // But we keep it in CLI for consistency with other tools if needed, or just ignore it.
  
  const action = String(args._[0]);
  const key = args._[1] ? String(args._[1]) : undefined;
  const value = args._[2] ? String(args._[2]) : undefined;

  if (!action || action === "undefined") {
    console.error("Error: Missing action argument");
    Deno.exit(1);
  }

  try {
    const result = await memory(action, key, value);
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

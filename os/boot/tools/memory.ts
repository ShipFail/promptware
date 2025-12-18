import { parseArgs } from "jsr:@std/cli/parse-args";

const HELP_TEXT = `
Promptware OS Kernel Memory Manager (Deno KV Edition)
Usage: deno run -A --unstable-kv --location <root_url> memory.ts <action> [key/prefix] [value]

Actions:
  get <path>          Retrieve a value from memory.
  set <path> <value>  Save a value to memory.
  delete <path>       Remove a value from memory.
  list [path]         List keys. If path provided, lists keys under that prefix.

Options:
  --help, -h          Show this help message.
`;

function parseKey(keyStr: string): string[] {
  // Split by slash and remove empty segments to handle leading/trailing slashes
  return keyStr.split("/").filter((p) => p.length > 0);
}

export async function memory(action: string, keyStr?: string, value?: string): Promise<void> {
  // Open the KV store associated with the --location flag (or default if none)
  const kv = await Deno.openKv();

  try {
    if (action === "set") {
      if (!keyStr || value === undefined) {
        console.error("Error: Missing key or value for set action.");
        Deno.exit(1);
      }
      const key = parseKey(keyStr);
      // We store everything as a string for simplicity in this shell-like interface
      await kv.set(key, value);
      console.log(`[ OK ] Set ${key.join("/")}.`);

    } else if (action === "get") {
      if (!keyStr) {
        console.error("Error: Missing key for get action.");
        Deno.exit(1);
      }
      const key = parseKey(keyStr);
      const result = await kv.get(key);
      if (result.value === null) {
        console.log("[ NULL ]");
      } else {
        console.log(result.value);
      }

    } else if (action === "delete") {
      if (!keyStr) {
        console.error("Error: Missing key for delete action.");
        Deno.exit(1);
      }
      const key = parseKey(keyStr);
      await kv.delete(key);
      console.log(`[ OK ] Deleted ${key.join("/")}.`);

    } else if (action === "list") {
      // If a key string is provided, use it as a prefix. Otherwise, list all.
      const prefix = keyStr ? parseKey(keyStr) : [];
      const entries = kv.list({ prefix });
      for await (const entry of entries) {
        // Reconstruct the path from the key array
        const path = entry.key.join("/");
        console.log(`${path}: ${entry.value}`);
      }

    } else {
      console.error(`Error: Unknown action '${action}'.`);
      Deno.exit(1);
    }
  } finally {
    kv.close();
  }
}

async function main() {
  const args = parseArgs(Deno.args, {
    boolean: ["help"],
    alias: { help: "h" },
  });

  if (args.help || args._.length === 0) {
    console.log(HELP_TEXT);
    Deno.exit(0);
  }

  const action = String(args._[0]);
  const key = args._[1] ? String(args._[1]) : undefined;
  const value = args._[2] ? String(args._[2]) : undefined;

  await memory(action, key, value);
}

if (import.meta.main) {
  main();
}

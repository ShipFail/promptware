import { parseArgs } from "jsr:@std/cli/parse-args";

const HELP_TEXT = `
Promptware OS Kernel Memory Manager (Deno KV Edition)
Usage: deno run -A --unstable-kv --location <root_url> memory.ts <action> <key> [value]

Actions:
  get <key>          Retrieve a value from memory.
  set <key> <value>  Save a value to memory.
  delete <key>       Remove a value from memory.
  list               List all keys in memory.

Options:
  --help, -h         Show this help message.
`;

export async function memory(action: string, key?: string, value?: string): Promise<void> {
  // Open the KV store associated with the --location flag (or default if none)
  const kv = await Deno.openKv();

  try {
    if (action === "set") {
      if (!key || value === undefined) {
        console.error("Error: Missing key or value for set action.");
        Deno.exit(1);
      }
      // We store everything as a string for simplicity in this shell-like interface
      await kv.set([key], value);
      console.log(`[ OK ] Set ${key}.`);

    } else if (action === "get") {
      if (!key) {
        console.error("Error: Missing key for get action.");
        Deno.exit(1);
      }
      const result = await kv.get([key]);
      if (result.value === null) {
        console.log("[ NULL ]");
      } else {
        console.log(result.value);
      }

    } else if (action === "delete") {
      if (!key) {
        console.error("Error: Missing key for delete action.");
        Deno.exit(1);
      }
      await kv.delete([key]);
      console.log(`[ OK ] Deleted ${key}.`);

    } else if (action === "list") {
      const entries = kv.list({ prefix: [] });
      for await (const entry of entries) {
        console.log(`${entry.key[0]}: ${entry.value}`);
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

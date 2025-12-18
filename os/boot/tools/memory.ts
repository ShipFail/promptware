import { join } from "jsr:@std/path";
import { ensureDir } from "jsr:@std/fs";
import { parseArgs } from "jsr:@std/cli/parse-args";

const HELP_TEXT = `
Promptware OS Kernel Memory Manager
Usage: deno run -A memory.ts <action> <key> [value]

Actions:
  get <key>          Retrieve a value from memory.
  set <key> <value>  Save a value to memory.

Options:
  --help, -h         Show this help message.
`;

export async function memory(action: string, key: string, value?: string): Promise<void> {
  const homeDir = Deno.env.get("HOME") || Deno.env.get("USERPROFILE");
  if (!homeDir) {
    console.error("Error: Could not determine home directory.");
    Deno.exit(1);
  }

  const memoryDir = join(homeDir, ".promptwareos");
  const memoryFile = join(memoryDir, "memory.json");

  await ensureDir(memoryDir);

  let memoryStore: Record<string, any> = {};
  try {
    const content = await Deno.readTextFile(memoryFile);
    memoryStore = JSON.parse(content);
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) {
      console.error("Error reading memory file:", error);
    }
  }

  if (action === "set") {
    if (value === undefined) {
      console.error("Error: Missing value for set action.");
      Deno.exit(1);
    }
    memoryStore[key] = value;
    await Deno.writeTextFile(memoryFile, JSON.stringify(memoryStore, null, 2));
    console.log(`[ OK ] Set ${key}.`);
  } else if (action === "get") {
    const val = memoryStore[key];
    if (val === undefined) {
      console.log("[ NULL ]");
    } else {
      console.log(val);
    }
  } else {
    console.error(`Error: Unknown action '${action}'.`);
    Deno.exit(1);
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

  if (!action || !key) {
    console.error("Error: Missing action or key.");
    console.log(HELP_TEXT);
    Deno.exit(1);
  }

  await memory(action, key, value);
}

if (import.meta.main) {
  main();
}

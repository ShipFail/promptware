import { parseArgs } from "jsr:@std/cli/parse-args";
import { goodwinCheck } from "./goodwin.ts";

/**
 * PromptWar̊e ØS Syscall Supervisor (deno-exec.ts)
 * Acts as the "Middleware" for all system calls.
 * Performs the Goodwin Check before executing the target script.
 */

const HELP_TEXT = `
Usage: deno run -A deno-exec.ts --root <os_root> <target_script> [args...]

Arguments:
  target_script   The path/URI of the Deno script to execute.
  args            Arguments to pass to the target script.

Options:
  --root <url>    The OS Root URL (Required for Goodwin Check).
  --help, -h      Show this help message.
`;

async function main() {
  // We parse args manually to separate our flags from the target's flags
  const args = Deno.args;
  
  let root: string | undefined;
  let targetScript: string | undefined;
  let targetArgs: string[] = [];

  // Simple manual parsing to extract --root and target
  // We can't use parseArgs easily because we want to pass the rest raw
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--root") {
      root = args[i + 1];
      i++; // Skip next
    } else if (args[i] === "--help" || args[i] === "-h") {
      console.log(HELP_TEXT);
      Deno.exit(0);
    } else {
      // First non-flag argument is the target script
      targetScript = args[i];
      targetArgs = args.slice(i + 1);
      break;
    }
  }

  if (!root) {
    console.error("Error: --root <url> is required for Supervisor.");
    Deno.exit(1);
  }

  if (!targetScript) {
    console.error("Error: Missing target script.");
    Deno.exit(1);
  }

  // 1. Perform Goodwin Check
  const kv = await Deno.openKv();
  try {
    await goodwinCheck(kv);
    // console.error("[ Supervisor ] Goodwin Check Passed."); // Optional verbose logging
  } catch (e: any) {
    console.error(e.message);
    Deno.exit(1); // Panic
  } finally {
    kv.close();
  }

  // 2. Execute Target Script
  // We spawn a subprocess to run the target.
  // We must pass the same --location <root> implicitly by running in the same environment?
  // No, Deno.Command spawns a new process. We need to pass --location explicitly if we want the child to access KV.
  // However, the Kernel calls *us* with --location. Does it propagate? No.
  // We need to construct the deno run command for the child.
  
  const command = new Deno.Command(Deno.execPath(), {
    args: [
      "run", 
      "-A", 
      "--unstable-kv", 
      "--location", root, 
      targetScript, 
      "--root", root, // Pass root to child as well (syscalls expect it)
      ...targetArgs
    ],
    stdout: "inherit",
    stderr: "inherit",
    stdin: "inherit",
  });

  const status = await command.spawn().status;
  Deno.exit(status.code);
}

if (import.meta.main) {
  main();
}

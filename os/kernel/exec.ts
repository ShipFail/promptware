import { parseArgs } from "jsr:@std/cli/parse-args";

/**
 * PromptWar̊e ØS Monolithic Kernel Entry Point (exec.ts)
 * 
 * Acts as the unified bridge between Promptware (Intent) and Software (Physics).
 * Automatically derives the OS Root and dispatches to the requested syscall.
 */

export async function exec(syscallName: string, ...args: any[]) {
  // 1. Derive OS_ROOT
  // We assume this file is located at <root>/kernel/exec.ts
  const currentUrl = new URL(import.meta.url);
  const kernelDir = new URL(".", currentUrl); // .../os/kernel/
  const osRoot = new URL("../", kernelDir).href; // .../os/

  // 2. Resolve Syscall Path
  // Syscalls are located in ./syscalls/<name>.ts relative to this file
  const syscallUrl = new URL(`./syscalls/${syscallName}.ts`, kernelDir).href;

  try {
    // 3. Dynamic Import
    const module = await import(syscallUrl);
    
    if (!module.default || typeof module.default !== "function") {
      throw new Error(`Syscall '${syscallName}' does not export a default function.`);
    }

    // 4. Invoke
    // We inject OS_ROOT as the first argument to every syscall.
    // Signature: syscall(root, ...args)
    return await module.default(osRoot, ...args);

  } catch (e: any) {
    throw new Error(`Kernel Panic: Failed to execute syscall '${syscallName}'. ${e.message}`);
  }
}

// CLI Entry Point
if (import.meta.main) {
  const args = parseArgs(Deno.args);
  const syscall = args._[0]?.toString();
  const syscallArgs = args._.slice(1);

  if (!syscall) {
    console.error("Usage: deno run -A exec.ts <syscall> [args...]");
    Deno.exit(1);
  }

  try {
    const result = await exec(syscall, ...syscallArgs);
    if (result !== undefined) {
      // Output result as JSON if it's an object, or string otherwise
      if (typeof result === "object") {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(result);
      }
    }
  } catch (e: any) {
    console.error(e.message);
    Deno.exit(1);
  }
}

import { parseArgs } from "jsr:@std/cli/parse-args";

/**
 * PromptWar̊e ØS Monolithic Kernel Entry Point (syscall.ts)
 * 
 * Acts as the unified bridge between Promptware (Intent) and Software (Precision).
 * Automatically derives the OS Root and dispatches to the requested syscall.
 */

export async function syscall(syscallName: string, ...args: any[]) {
  // 1. Derive OS_ROOT
  // We assume this file is located at <root>/kernel/syscall.ts
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
  const syscallName = args._[0]?.toString();
  const syscallArgs = args._.slice(1);

  if (!syscallName) {
    console.error(JSON.stringify({
      jsonrpc: "2.0",
      error: { code: -32600, message: "Invalid Request: Usage: deno run -A syscall.ts <syscall> [args...]" },
      id: null
    }, null, 2));
    Deno.exit(1);
  }

  try {
    const result = await syscall(syscallName, ...syscallArgs);
    // Success Envelope (JSON-RPC 2.0)
    console.log(JSON.stringify({
      jsonrpc: "2.0",
      result: result,
      id: 1
    }, null, 2));
  } catch (e: any) {
    // Error Envelope (JSON-RPC 2.0)
    console.log(JSON.stringify({
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message: e.message
      },
      id: 1
    }, null, 2));
    Deno.exit(1);
  }
}

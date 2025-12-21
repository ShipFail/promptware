/**
 * PromptWar̊e ØS Syscall: Goodwin Check
 * Implements the "Goodwin Check" for Cognitive Integrity.
 * 
 * "Are you still you, and are you still thinking straight?"
 */

export interface KernelParameters {
  root: string;
  init: string;
  mounts?: Record<string, string>;
}

export const KERNEL_PARAMS_KEY = ["proc", "cmdline"];

/**
 * Verifies the integrity of the Kernel's memory.
 * If the LLM has drifted (forgotten the root), the Deno KV location will be wrong,
 * and this check will fail to find the kernel parameters.
 */
export async function goodwinCheck(kv: Deno.Kv): Promise<KernelParameters> {
  const res = await kv.get<KernelParameters>(KERNEL_PARAMS_KEY);
  if (!res.value) {
    throw new Error("KERNEL PANIC: Goodwin Check Failed. Cognitive Drift Detected. (Root mismatch or uninitialized memory)");
  }
  return res.value;
}

/**
 * Saves the Kernel Parameters to memory (Boot time only).
 */
export async function setKernelParams(kv: Deno.Kv, params: KernelParameters): Promise<void> {
  await kv.set(KERNEL_PARAMS_KEY, params);
}

/**
 * Retrieves the Kernel Parameters from memory.
 * Useful for syscalls that need access to mounts or init.
 */
export async function getKernelParams(kv: Deno.Kv): Promise<KernelParameters> {
  return goodwinCheck(kv);
}

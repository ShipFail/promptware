import { join, dirname } from "jsr:@std/path";

/**
 * Checks if a string is a valid URL.
 */
export function isUrl(path: string): boolean {
  try {
    new URL(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Retrieves kernel parameters from the KV store.
 */
export async function getKernelParams() {
  const kv = await Deno.openKv();
  try {
    const res = await kv.get(["proc", "cmdline"]);
    if (res.value) {
      return JSON.parse(res.value as string);
    } else {
      // Fallback or throw? 
      // For now, we throw as per original implementation, 
      // but we might want to handle the case where it's not initialized yet.
      // However, resolve() usually expects it to be there.
      // If explicitRoot is passed, this might not be called.
      return null; 
    }
  } finally {
    try { kv.close(); } catch {}
  }
}

/**
 * Resolves a URI against a Base and Root.
 * Implements the VFS path resolution logic (RFC 0013).
 */
export async function resolve(uri: string, base?: string, explicitRoot?: string): Promise<string> {
  let root = explicitRoot;
  let mounts: Record<string, string> | undefined;

  if (!root) {
    const params = await getKernelParams();
    if (params) {
      root = params.root;
      mounts = params.mounts;
    } else {
       throw new Error("Kernel Panic: proc/cmdline not found.");
    }
  }

  if (isUrl(uri)) {
    if (uri.startsWith("os://")) {
      const path = uri.replace("os://", "");

      if (mounts) {
        const parts = path.split("/");
        const topLevel = parts[0];
        if (mounts[topLevel]) {
          const rest = parts.slice(1).join("/");
          if (isUrl(mounts[topLevel])) {
            return new URL(rest, mounts[topLevel]).href;
          }
        }
      }

      return new URL(path, root).href;
    }
    return uri;
  }

  if (uri.startsWith("/")) {
    return new URL(uri.slice(1), root).href;
  }

  if (base) {
    if (isUrl(base)) {
      return new URL(uri, base).href;
    }
    return join(dirname(base), uri);
  }

  return new URL(uri, root).href;
}

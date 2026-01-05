import { z } from "jsr:@zod/zod";
import { Capability } from "../schema/capability.ts";
import { createMessage } from "../schema/message.ts";

/**
 * PromptWare ØS Memory Capabilities
 *
 * Provides CQRS-compliant key-value operations via Deno KV.
 * Enforces RFC 0018: Vault paths require pwenc encryption.
 */

// ================================
// Shared Utilities
// ================================

/**
 * Execute a function with an open KV connection, automatically closing it.
 */
async function withKv<T>(fn: (kv: Deno.Kv) => Promise<T>): Promise<T> {
  const kv = await Deno.openKv();
  try {
    return await fn(kv);
  } finally {
    // Ensure KV is closed, but handle potential race conditions if Deno test runner is strict
    try { kv.close(); } catch {}
  }
}

/**
 * Parse a key path string into KV key segments.
 * Enforces absolute paths (must start with /).
 */
function parseKey(k: string): string[] {
  if (!k.startsWith("/")) {
    throw new Error(`Invalid path: '${k}'. Paths MUST be absolute (start with /).`);
  }
  return k.split("/").filter(p => p.length > 0);
}

// ================================
// Schemas
// ================================

const GetInput = z.object({
  key: z.string().describe("The absolute path to retrieve (e.g., /foo/bar)"),
}).describe("Input for memory/get capability.");

const GetOutput = z.any().describe("The stored value, or null if not found.");

const ListInput = z.object({
  prefix: z.string().optional().describe("Optional prefix path to filter results (e.g., /vault)"),
}).describe("Input for memory/list capability.");

const ListOutput = z.record(z.string(), z.any()).describe("Object mapping paths to values.");

const SetInput = z.object({
  key: z.string().describe("The absolute path to store (e.g., /config/api-key)"),
  value: z.any().describe("The value to store (any JSON-serializable type)"),
}).describe("Input for memory/set capability.");

const SetOutput = z.object({
  success: z.boolean(),
  message: z.string(),
}).describe("Confirmation of the set operation.");

const DeleteInput = z.object({
  key: z.string().describe("The absolute path to delete (e.g., /temp/cache)"),
}).describe("Input for memory/delete capability.");

const DeleteOutput = z.object({
  success: z.boolean(),
  message: z.string(),
}).describe("Confirmation of the delete operation.");

// ================================
// Exports
// ================================

export const MemoryGet: Capability<any, any> = {
  description: "Retrieve value by key",
  inbound: z.object({
    kind: z.literal("query"),
    type: z.literal("Memory.Get"),
    data: GetInput
  }),
  outbound: z.object({
    kind: z.literal("reply"),
    type: z.literal("Memory.Get"),
    data: GetOutput
  }),
  factory: () => new TransformStream({
    async transform(msg, controller) {
      const data = msg.data as z.infer<typeof GetInput>;
      const result = await withKv(async (kv) => {
        const res = await kv.get(parseKey(data.key));
        return res.value;
      });
      controller.enqueue(createMessage("reply", "Memory.Get", result, undefined, msg.metadata?.correlation, msg.metadata?.id));
    }
  })
};

export const MemoryList: Capability<any, any> = {
  description: "List entries by prefix",
  inbound: z.object({
    kind: z.literal("query"),
    type: z.literal("Memory.List"),
    data: ListInput
  }),
  outbound: z.object({
    kind: z.literal("reply"),
    type: z.literal("Memory.List"),
    data: ListOutput
  }),
  factory: () => new TransformStream({
    async transform(msg, controller) {
      const data = msg.data as z.infer<typeof ListInput>;
      const result = await withKv(async (kv) => {
        const prefix = data.prefix ? parseKey(data.prefix) : [];
        const result: Record<string, any> = {};
        for await (const entry of kv.list({ prefix })) {
          result["/" + entry.key.join("/")] = entry.value;
        }
        return result;
      });
      controller.enqueue(createMessage("reply", "Memory.List", result, undefined, msg.metadata?.correlation, msg.metadata?.id));
    }
  })
};

export const MemorySet: Capability<any, any> = {
  description: "Store key-value pair",
  inbound: z.object({
    kind: z.literal("command"),
    type: z.literal("Memory.Set"),
    data: SetInput
  }),
  outbound: z.object({
    kind: z.literal("reply"),
    type: z.literal("Memory.Set"),
    data: SetOutput
  }),
  factory: () => new TransformStream({
    async transform(msg, controller) {
      const data = msg.data as z.infer<typeof SetInput>;
      // RFC 0018: Vault Enforcement
      if (data.key.startsWith("/vault/")) {
        const valStr = typeof data.value === 'string' ? data.value : JSON.stringify(data.value);
        if (!valStr.startsWith("pwenc:v1:")) {
          throw new Error("E_VAULT_REQUIRES_PWENC: /vault/ paths accept only ciphertext (pwenc:v1:...).");
        }
      }

      const result = await withKv(async (kv) => {
        await kv.set(parseKey(data.key), data.value);
        return { success: true, message: `Set ${data.key}` };
      });
      controller.enqueue(createMessage("reply", "Memory.Set", result, undefined, msg.metadata?.correlation, msg.metadata?.id));
    }
  })
};

export const MemoryDelete: Capability<any, any> = {
  description: "Remove key",
  inbound: z.object({
    kind: z.literal("command"),
    type: z.literal("Memory.Delete"),
    data: DeleteInput
  }),
  outbound: z.object({
    kind: z.literal("reply"),
    type: z.literal("Memory.Delete"),
    data: DeleteOutput
  }),
  factory: () => new TransformStream({
    async transform(msg, controller) {
      const data = msg.data as z.infer<typeof DeleteInput>;
      const result = await withKv(async (kv) => {
        await kv.delete(parseKey(data.key));
        return { success: true, message: `Deleted ${data.key}` };
      });
      controller.enqueue(createMessage("reply", "Memory.Delete", result, undefined, msg.metadata?.correlation, msg.metadata?.id));
    }
  })
};

export default [MemoryGet, MemoryList, MemorySet, MemoryDelete];

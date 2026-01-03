import { z } from "jsr:@zod/zod";
import { SyscallModule } from "./contract.ts";
import { OsMessage } from "../lib/os-event.ts";

/**
 * PromptWare ØS Memory Syscalls
 *
 * Provides CQRS-compliant key-value operations via Deno KV.
 * Enforces RFC 0018: Vault paths require pwenc encryption.
 *
 * Exports 4 modules:
 * - memory/get (query): Retrieve value by key
 * - memory/list (query): List entries by prefix
 * - memory/set (command): Store key-value pair
 * - memory/delete (command): Remove key
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
    kv.close();
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
// QUERY: memory/get
// ================================

const GetInputSchema = z.object({
  key: z.string().describe("The absolute path to retrieve (e.g., /foo/bar)"),
}).describe("Input for memory/get syscall.");

const GetOutputSchema = z.any().describe("The stored value, or null if not found.");

const getHandler = async (input: z.infer<typeof GetInputSchema>, _event: OsMessage): Promise<z.infer<typeof GetOutputSchema>> => {
  return withKv(async (kv) => {
    const res = await kv.get(parseKey(input.key));
    return res.value;
  });
};

export const memoryGetModule: SyscallModule<typeof GetInputSchema, typeof GetOutputSchema> = {
  type: "query",
  InputSchema: GetInputSchema,
  OutputSchema: GetOutputSchema,
  handler: getHandler,
  cliAdapter: (args: string[]) => {
    if (args.length < 1) throw new Error("Usage: memory/get <key>");
    return { key: args[0] };
  },
};

// ================================
// QUERY: memory/list
// ================================

const ListInputSchema = z.object({
  prefix: z.string().optional().describe("Optional prefix path to filter results (e.g., /vault)"),
}).describe("Input for memory/list syscall.");

const ListOutputSchema = z.record(z.string(), z.any()).describe("Object mapping paths to values.");

const listHandler = async (input: z.infer<typeof ListInputSchema>, _event: OsMessage): Promise<z.infer<typeof ListOutputSchema>> => {
  return withKv(async (kv) => {
    const prefix = input.prefix ? parseKey(input.prefix) : [];
    const result: Record<string, any> = {};
    for await (const entry of kv.list({ prefix })) {
      result["/" + entry.key.join("/")] = entry.value;
    }
    return result;
  });
};

export const memoryListModule: SyscallModule<typeof ListInputSchema, typeof ListOutputSchema> = {
  type: "query",
  InputSchema: ListInputSchema,
  OutputSchema: ListOutputSchema,
  handler: listHandler,
  cliAdapter: (args: string[]) => {
    return { prefix: args[0] };
  },
};

// ================================
// COMMAND: memory/set
// ================================

const SetInputSchema = z.object({
  key: z.string().describe("The absolute path to store (e.g., /config/api-key)"),
  value: z.any().describe("The value to store (any JSON-serializable type)"),
}).describe("Input for memory/set syscall.");

const SetOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
}).describe("Confirmation of the set operation.");

const setHandler = async (input: z.infer<typeof SetInputSchema>, _event: OsMessage): Promise<z.infer<typeof SetOutputSchema>> => {
  // RFC 0018: Vault Enforcement
  if (input.key.startsWith("/vault/")) {
    const valStr = typeof input.value === 'string' ? input.value : JSON.stringify(input.value);
    if (!valStr.startsWith("pwenc:v1:")) {
      throw new Error("E_VAULT_REQUIRES_PWENC: /vault/ paths accept only ciphertext (pwenc:v1:...).");
    }
  }

  return withKv(async (kv) => {
    await kv.set(parseKey(input.key), input.value);
    return { success: true, message: `Set ${input.key}` };
  });
};

export const memorySetModule: SyscallModule<typeof SetInputSchema, typeof SetOutputSchema> = {
  type: "command",
  InputSchema: SetInputSchema,
  OutputSchema: SetOutputSchema,
  handler: setHandler,
  cliAdapter: (args: string[]) => {
    if (args.length < 2) throw new Error("Usage: memory/set <key> <value>");
    return { key: args[0], value: args[1] };
  },
};

// ================================
// COMMAND: memory/delete
// ================================

const DeleteInputSchema = z.object({
  key: z.string().describe("The absolute path to delete (e.g., /temp/cache)"),
}).describe("Input for memory/delete syscall.");

const DeleteOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
}).describe("Confirmation of the delete operation.");

const deleteHandler = async (input: z.infer<typeof DeleteInputSchema>, _event: OsMessage): Promise<z.infer<typeof DeleteOutputSchema>> => {
  return withKv(async (kv) => {
    await kv.delete(parseKey(input.key));
    return { success: true, message: `Deleted ${input.key}` };
  });
};

export const memoryDeleteModule: SyscallModule<typeof DeleteInputSchema, typeof DeleteOutputSchema> = {
  type: "command",
  InputSchema: DeleteInputSchema,
  OutputSchema: DeleteOutputSchema,
  handler: deleteHandler,
  cliAdapter: (args: string[]) => {
    if (args.length < 1) throw new Error("Usage: memory/delete <key>");
    return { key: args[0] };
  },
};

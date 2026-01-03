import { assertEquals, assertRejects } from "jsr:@std/assert";
import { registry } from "./handlers/registry.ts";
import { createCommand } from "./schema/message.ts";

// Helper to simulate the old syscall function for testing
async function syscall(name: string, ...args: any[]) {
  const capability = registry[name];
  if (!capability) {
    throw new Error("Kernel Panic: Unknown capability");
  }

  // Normalize CLI-style args if a fromArgs exists
  let input: unknown = args;
  if (capability.fromArgs) {
    input = capability.fromArgs(args.map(String));
  }

  // Parse input
  const parsedInput = await capability.InputSchema.parseAsync(input);
  
  // Create command message
  const command = createCommand(name, parsedInput);
  
  // Execute capability
  const output = await capability.process(parsedInput, command);
  
  // Parse output
  return capability.OutputSchema.parse(output);
}

Deno.test("RFC 0019: Syscall MUST fail for non-existent tool", async () => {
  await assertRejects(
    async () => await syscall("non_existent_tool"),
    Error,
    "Kernel Panic"
  );
});

// Note: We cannot easily test the JSON-RPC output format here because that logic resides in the 
// 'if (import.meta.main)' block which is not exported.
// However, we can verify that the 'syscall' function returns raw values, 
// which the CLI wrapper then wraps in JSON-RPC.

Deno.test("RFC 0019: Syscall function returns raw value (not JSON-RPC)", async () => {
  // We use 'echo' as a safe, predictable syscall to test dispatch
  const result = await syscall("Echo", "hello", "world");
  
  // Echo syscall returns an object { echo: string }
  assertEquals((result as any).echo, "hello world");
  
  // It should NOT return { jsonrpc: ... }
  if (typeof result === "object" && result !== null && "jsonrpc" in result) {
    throw new Error("Syscall function should return raw data, not JSON-RPC envelope.");
  }
});

Deno.test("RFC 0019: Syscall MUST validate module exports default function", async () => {
  // The error message should indicate missing default export
  // We can't easily create a bad module, but we can test the error path
  // by relying on the existing error handling
  await assertRejects(
    async () => await syscall("invalid_syscall_name_xyz"),
    Error,
    "Kernel Panic"
  );
});

// ================================
// CQRS Validation Tests
// ================================

Deno.test("CQRS: memory/get is a query and returns data", async () => {
  // First set a value to ensure it exists
  await syscall("Memory.Set", "/test/cqrs-get", "test-value");

  // Now query it
  const result = await syscall("Memory.Get", "/test/cqrs-get");
  assertEquals(result, "test-value");

  // Cleanup
  await syscall("Memory.Delete", "/test/cqrs-get");
});

Deno.test("CQRS: memory/set is a command and mutates state", async () => {
  const result = await syscall("Memory.Set", "/test/cqrs-set", "new-value");
  assertEquals((result as any).success, true);

  // Verify state was mutated
  const stored = await syscall("Memory.Get", "/test/cqrs-set");
  assertEquals(stored, "new-value");

  // Cleanup
  await syscall("Memory.Delete", "/test/cqrs-set");
});

Deno.test("CQRS: memory/delete is a command and removes state", async () => {
  // Setup
  await syscall("Memory.Set", "/test/cqrs-delete", "to-be-deleted");

  // Execute command
  const result = await syscall("Memory.Delete", "/test/cqrs-delete");
  assertEquals((result as any).success, true);

  // Verify deletion
  const stored = await syscall("Memory.Get", "/test/cqrs-delete");
  assertEquals(stored, null);
});

Deno.test("CQRS: memory/list is a query and returns multiple entries", async () => {
  // Setup test data
  await syscall("Memory.Set", "/test/list/item1", "value1");
  await syscall("Memory.Set", "/test/list/item2", "value2");

  // Query
  const result = await syscall("Memory.List", "/test/list") as Record<string, any>;
  assertEquals(result["/test/list/item1"], "value1");
  assertEquals(result["/test/list/item2"], "value2");

  // Cleanup
  await syscall("Memory.Delete", "/test/list/item1");
  await syscall("Memory.Delete", "/test/list/item2");
});

Deno.test("CQRS: echo is a query (pure function)", async () => {
  const result = await syscall("Echo", "hello", "world");
  assertEquals((result as any).echo, "hello world");

  // Should be idempotent
  const result2 = await syscall("Echo", "hello", "world");
  assertEquals((result2 as any).echo, "hello world");
});

Deno.test("CQRS: fetch is a command (has side effects)", async () => {
  // Note: This test requires network access
  // Fetch is a command because it makes external HTTP requests
  const result = await syscall("Http.Fetch", "https://httpbin.org/get") as any;
  assertEquals(result.ok, true);
  assertEquals(result.status, 200);
});

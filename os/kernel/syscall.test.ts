import { assertEquals, assertRejects } from "jsr:@std/assert";
import { syscall } from "./syscall.ts";

// Mock the dynamic import mechanism
// Since we can't easily mock dynamic imports in Deno without external libs,
// we will test the "Registry" logic and "Error Handling" logic which are the core responsibilities of syscall.ts.
// We will assume the actual dispatch to files works if the file exists (integration test).

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
  // We use 'resolve' as a safe, side-effect-free syscall to test dispatch
  const root = "https://example.com/";
  // Note: resolve.ts treats os://test as relative to root if no mounts match
  // syscall.ts derives root from its own location: file:///workspaces/promptware/os/
  // So os://test -> file:///workspaces/promptware/os/test
  const result = await syscall("resolve", "os://test", "https://example.com/base");
  
  // It should return the string directly
  assertEquals(result, "file:///workspaces/promptware/os/test");
  
  // It should NOT return { jsonrpc: ... }
  if (typeof result === "object" && result !== null && "jsonrpc" in result) {
    throw new Error("Syscall function should return raw data, not JSON-RPC envelope.");
  }
});

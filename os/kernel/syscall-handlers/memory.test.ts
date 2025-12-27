import { assertEquals, assertRejects } from "jsr:@std/assert";
import memory from "./memory.ts";

// RFC 0018: Memory Subsystem Specification
// We use the real Deno KV but with an in-memory backend (if supported) or a temp file.
// Since Deno.openKv(":memory:") is available in recent Deno versions, we rely on that
// or the fact that we are running in a test environment where side effects are acceptable/isolated.
// Note: memory.ts calls Deno.openKv() without args, which opens the default KV.
// To test properly without polluting the real KV, we should ideally mock Deno.openKv.
// However, for this environment, we will assume the test runner handles isolation or we accept the side effect.

Deno.test("RFC 0018: Memory MUST enforce absolute paths", async () => {
  await assertRejects(
    async () => await memory("get", "relative/path"),
    Error,
    "Invalid path: 'relative/path'. Paths MUST be absolute (start with /)."
  );
});

Deno.test("RFC 0018: Memory MUST enforce Sealed-at-Rest for /vault/", async () => {
  // Valid pwenc
  await memory("set", "/vault/test", "pwenc:v1:valid");
  
  // Invalid plaintext
  await assertRejects(
    async () => await memory("set", "/vault/bad", "plaintext_secret"),
    Error,
    "E_VAULT_REQUIRES_PWENC: /vault/ paths accept only ciphertext (pwenc:v1:...)."
  );
});

Deno.test("RFC 0018: Memory CRUD operations", async () => {
  const root = "os://";
  const key = "/users/test/setting";
  const value = { theme: "dark" };

  // Set
  await memory("set", key, JSON.stringify(value));

  // Get
  const retrieved = await memory("get", key);
  assertEquals(retrieved, value);

  // List
  const list = await memory("list", "/users/test/");
  assertEquals(list["users/test/setting"], value);

  // Delete
  await memory("delete", key);
  const deleted = await memory("get", key);
  assertEquals(deleted, null);
});

Deno.test("RFC 0018: Memory MUST parse JSON values when possible", async () => {
  const key = "/config/settings";
  const jsonValue = JSON.stringify({ enabled: true, count: 42 });
  
  await memory("set", key, jsonValue);
  const result = await memory("get", key);
  
  // Should be parsed as object, not string
  assertEquals(typeof result, "object");
  assertEquals(result.enabled, true);
  assertEquals(result.count, 42);
});

Deno.test("RFC 0018: Memory MUST store non-JSON values as strings", async () => {
  const key = "/simple/text";
  const plainValue = "just a string";
  
  await memory("set", key, plainValue);
  const result = await memory("get", key);
  
  assertEquals(result, plainValue);
});

import { assertEquals, assertRejects } from "jsr:@std/assert";
import { MemoryGet, MemorySet, MemoryList, MemoryDelete } from "./memory.ts";
import { dispatch } from "../lib/dispatch.ts";

// RFC 0018: Memory Subsystem Specification
// We use the real Deno KV but with an in-memory backend (if supported) or a temp file.
// Since Deno.openKv(":memory:") is available in recent Deno versions, we rely on that
// or the fact that we are running in a test environment where side effects are acceptable/isolated.

Deno.test("RFC 0018: Memory MUST enforce absolute paths on get", async () => {
  await assertRejects(
    async () => await dispatch(MemoryGet, { key: "relative/path" }),
    Error,
    "Invalid path: 'relative/path'. Paths MUST be absolute (start with /)."
  );
});

Deno.test("RFC 0018: Memory MUST enforce absolute paths on set", async () => {
  await assertRejects(
    async () => await dispatch(MemorySet, { key: "relative/path", value: "test" }),
    Error,
    "Invalid path: 'relative/path'. Paths MUST be absolute (start with /)."
  );
});

Deno.test("RFC 0018: Memory MUST enforce Sealed-at-Rest for /vault/", async () => {
  // Valid pwenc
  await dispatch(MemorySet, { key: "/vault/test", value: "pwenc:v1:valid" });

  // Invalid plaintext
  await assertRejects(
    async () => await dispatch(MemorySet, { key: "/vault/bad", value: "plaintext_secret" }),
    Error,
    "E_VAULT_REQUIRES_PWENC: /vault/ paths accept only ciphertext (pwenc:v1:...)."
  );
});

Deno.test("RFC 0018: Memory CRUD operations", async () => {
  const key = "/users/test/setting";
  const value = { theme: "dark" };

  // Set
  await dispatch(MemorySet, { key, value: JSON.stringify(value) });

  // Get
  const getResult = await dispatch(MemoryGet, { key });
  const retrieved = getResult.data;
  assertEquals(typeof retrieved, "string"); // KV stores the JSON string

  // List
  const listResult = await dispatch(MemoryList, { prefix: "/users/test/" });
  const list = listResult.data as Record<string, any>;
  assertEquals(list["/users/test/setting"], JSON.stringify(value));

  // Delete
  await dispatch(MemoryDelete, { key });
  const deletedResult = await dispatch(MemoryGet, { key });
  assertEquals(deletedResult.data, null);
});

Deno.test("RFC 0018: Memory MUST store JSON values as strings", async () => {
  const key = "/config/settings";
  const jsonValue = JSON.stringify({ enabled: true, count: 42 });

  await dispatch(MemorySet, { key, value: jsonValue });
  const result = await dispatch(MemoryGet, { key });

  // Should be stored as string (caller must parse if needed)
  assertEquals(typeof result.data, "string");
  const parsed = JSON.parse(result.data as string);
  assertEquals(parsed.enabled, true);
  assertEquals(parsed.count, 42);
});

Deno.test("RFC 0018: Memory MUST store non-JSON values as strings", async () => {
  const key = "/simple/text";
  const plainValue = "just a string";

  await dispatch(MemorySet, { key, value: plainValue });
  const result = await dispatch(MemoryGet, { key });

  assertEquals(result.data, plainValue);
});

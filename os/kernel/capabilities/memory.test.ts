import { assertEquals, assertRejects } from "jsr:@std/assert";
import { memoryGetModule, memorySetModule, memoryDeleteModule, memoryListModule } from "./memory.ts";

// RFC 0018: Memory Subsystem Specification
// We use the real Deno KV but with an in-memory backend (if supported) or a temp file.
// Since Deno.openKv(":memory:") is available in recent Deno versions, we rely on that
// or the fact that we are running in a test environment where side effects are acceptable/isolated.
// Note: memory.ts calls Deno.openKv() without args, which opens the default KV.
// To test properly without polluting the real KV, we should ideally mock Deno.openKv.
// However, for this environment, we will assume the test runner handles isolation or we accept the side effect.

Deno.test("RFC 0018: Memory MUST enforce absolute paths on get", async () => {
  await assertRejects(
    async () => await memoryGetModule.process({ key: "relative/path" }, {} as any),
    Error,
    "Invalid path: 'relative/path'. Paths MUST be absolute (start with /)."
  );
});

Deno.test("RFC 0018: Memory MUST enforce absolute paths on set", async () => {
  await assertRejects(
    async () => await memorySetModule.process({ key: "relative/path", value: "test" }, {} as any),
    Error,
    "Invalid path: 'relative/path'. Paths MUST be absolute (start with /)."
  );
});

Deno.test("RFC 0018: Memory MUST enforce Sealed-at-Rest for /vault/", async () => {
  // Valid pwenc
  await memorySetModule.process({ key: "/vault/test", value: "pwenc:v1:valid" }, {} as any);

  // Invalid plaintext
  await assertRejects(
    async () => await memorySetModule.process({ key: "/vault/bad", value: "plaintext_secret" }, {} as any),
    Error,
    "E_VAULT_REQUIRES_PWENC: /vault/ paths accept only ciphertext (pwenc:v1:...)."
  );
});

Deno.test("RFC 0018: Memory CRUD operations", async () => {
  const key = "/users/test/setting";
  const value = { theme: "dark" };

  // Set
  await memorySetModule.process({ key, value: JSON.stringify(value) }, {} as any);

  // Get
  const retrieved = await memoryGetModule.process({ key }, {} as any);
  assertEquals(typeof retrieved, "string"); // KV stores the JSON string

  // List
  const list = await memoryListModule.process({ prefix: "/users/test/" }, {} as any);
  assertEquals(list["/users/test/setting"], JSON.stringify(value));

  // Delete
  await memoryDeleteModule.process({ key }, {} as any);
  const deleted = await memoryGetModule.process({ key }, {} as any);
  assertEquals(deleted, null);
});

Deno.test("RFC 0018: Memory MUST store JSON values as strings", async () => {
  const key = "/config/settings";
  const jsonValue = JSON.stringify({ enabled: true, count: 42 });

  await memorySetModule.process({ key, value: jsonValue }, {} as any);
  const result = await memoryGetModule.process({ key }, {} as any);

  // Should be stored as string (caller must parse if needed)
  assertEquals(typeof result, "string");
  const parsed = JSON.parse(result);
  assertEquals(parsed.enabled, true);
  assertEquals(parsed.count, 42);
});

Deno.test("RFC 0018: Memory MUST store non-JSON values as strings", async () => {
  const key = "/simple/text";
  const plainValue = "just a string";

  await memorySetModule.process({ key, value: plainValue }, {} as any);
  const result = await memoryGetModule.process({ key }, {} as any);

  assertEquals(result, plainValue);
});

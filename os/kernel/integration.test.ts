import { assertEquals, assertRejects } from "jsr:@std/assert";
import { registry } from "./capabilities/registry.ts";
import { createMessage, OsMessage } from "./schema/message.ts";
import { route } from "./bus/engine.ts";

/**
 * os/kernel/main.test.ts
 * 
 * Integration tests for the PromptWare ØS Kernel.
 * Verifies the Pure Reactive Architecture (Streams) via the Route Engine.
 */

// ============================================================================
// Test Harness
// ============================================================================

/**
 * Helper to dispatch a message through the kernel engine.
 * This simulates the "Syscall" interface but allows full control over the message.
 */
async function dispatch(
  kind: "command" | "query",
  type: string,
  data: any
): Promise<any> {
  const message = createMessage(kind, type, data);
  const response = await route(message, registry);

  if (response.kind === "error") {
    const errData = response.data as { message: string };
    throw new Error(errData.message);
  }

  return response.data;
}

// ============================================================================
// 1. Core Architecture Tests (RFC 0019)
// ============================================================================

Deno.test("Kernel: Unknown capability throws Error", async () => {
  await assertRejects(
    async () => await dispatch("command", "System.Unknown", {}),
    Error,
    "Failed to spawn 'System.Unknown'" // Shell fallback fails
  );
});

Deno.test("Kernel: Ping (Query) returns payload verbatim", async () => {
  const result = await dispatch("query", "Ping", { payload: "hello" });
  assertEquals(result.payload, "hello");
});

// ============================================================================
// 2. Memory Subsystem Tests (RFC 0018)
// ============================================================================

Deno.test("Memory: CRUD Lifecycle", async () => {
  const key = "/test/lifecycle";
  const value = { foo: "bar", ts: Date.now() };

  // 1. Set (Command)
  const setRes = await dispatch("command", "Memory.Set", { key, value });
  assertEquals(setRes.success, true);

  // 2. Get (Query)
  const getRes = await dispatch("query", "Memory.Get", { key });
  assertEquals(getRes, value);

  // 3. Delete (Command)
  const delRes = await dispatch("command", "Memory.Delete", { key });
  assertEquals(delRes.success, true);

  // 4. Verify Delete
  const verifyRes = await dispatch("query", "Memory.Get", { key });
  assertEquals(verifyRes, null);
});

Deno.test("Memory: List Prefix", async () => {
  await dispatch("command", "Memory.Set", { key: "/test/list/a", value: 1 });
  await dispatch("command", "Memory.Set", { key: "/test/list/b", value: 2 });

  const listRes = await dispatch("query", "Memory.List", { prefix: "/test/list" });
  assertEquals(listRes["/test/list/a"], 1);
  assertEquals(listRes["/test/list/b"], 2);

  // Cleanup
  await dispatch("command", "Memory.Delete", { key: "/test/list/a" });
  await dispatch("command", "Memory.Delete", { key: "/test/list/b" });
});

Deno.test("Network: Fetch (Command) performs HTTP request", async () => {
  const result = await dispatch("command", "Network.Fetch", {
    url: "https://httpbin.org/get"
  });
  assertEquals(result.ok, true);
  assertEquals(result.status, 200);
  assertEquals(typeof result.body, "string");
});

Deno.test("Resilience: Factory creates fresh streams", async () => {
  // We manually inspect the registry to verify the factory pattern
  const cap = registry["Ping"];

  const stream1 = cap.factory();
  const stream2 = cap.factory();

  // They should be different instances
  assertEquals(stream1 === stream2, false);

  // Helper to test a stream using concurrent pipeTo pattern
  async function testStream(
    stream: TransformStream<OsMessage, OsMessage>,
    payload: string
  ): Promise<string> {
    const results: OsMessage[] = [];
    const collector = new WritableStream<OsMessage>({
      write(chunk) {
        results.push(chunk);
      },
    });

    const inputStream = new ReadableStream<OsMessage>({
      start(controller) {
        controller.enqueue(createMessage("query", "Ping", { payload }));
        controller.close();
      },
    });

    // Run both pipes CONCURRENTLY to avoid deadlock
    await Promise.all([
      inputStream.pipeTo(stream.writable),
      stream.readable.pipeTo(collector),
    ]);

    return (results[0]?.data as { payload: string }).payload;
  }

  // Both streams should work independently
  const res1 = await testStream(stream1, "first");
  assertEquals(res1, "first");

  const res2 = await testStream(stream2, "second");
  assertEquals(res2, "second");
});

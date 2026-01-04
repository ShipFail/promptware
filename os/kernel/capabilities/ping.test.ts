/**
 * os/kernel/capabilities/ping.test.ts
 *
 * Test Suite: ABI Integrity via PING/PONG (RFC-6455 Semantics)
 *
 * These tests verify the syscall bridge and framing correctness:
 * 1. No payload mutation - data in === data out
 * 2. No truncation - large payloads preserved
 * 3. Type preservation - JSON types maintained
 * 4. Correct correlation - causation lineage works
 *
 * Doc phrase: "Ping proves framing; semantics come later."
 */

import { assertEquals } from "jsr:@std/assert";
import pingModule from "./ping.ts";
import { createMessage } from "../schema/message.ts";

// Get the Ping capability
const pingCapability = pingModule["Ping"]();

/**
 * Helper: Execute Ping and return Pong using pipeTo() for proper stream cleanup
 *
 * IMPORTANT: Both pipes must run concurrently to avoid deadlock.
 * The writable side waits for readable to drain, and vice versa.
 */
async function executePing<T>(payload: T): Promise<T> {
  const processor = pingCapability.factory();

  // Collector to capture output
  const results: unknown[] = [];
  const collector = new WritableStream({
    write(chunk) {
      results.push(chunk);
    },
  });

  // Create input stream
  const input = createMessage("query", "Ping", { payload });
  const inputStream = new ReadableStream({
    start(controller) {
      controller.enqueue(input);
      controller.close();
    },
  });

  // Run both pipes CONCURRENTLY to avoid deadlock
  await Promise.all([
    inputStream.pipeTo(processor.writable),
    processor.readable.pipeTo(collector),
  ]);

  const output = results[0] as { data: { payload: T } };
  return output.data.payload;
}

// ============================================================================
// Test Group 1: Basic Type Preservation
// ============================================================================

Deno.test("Ping: String payload MUST be returned verbatim", async () => {
  const payload = "hello world";
  const result = await executePing(payload);
  assertEquals(result, payload);
});

Deno.test("Ping: Empty string payload MUST be returned verbatim", async () => {
  const payload = "";
  const result = await executePing(payload);
  assertEquals(result, payload);
});

Deno.test("Ping: Number payload MUST be returned verbatim", async () => {
  const payload = 42;
  const result = await executePing(payload);
  assertEquals(result, payload);
});

Deno.test("Ping: Zero payload MUST be returned verbatim", async () => {
  const payload = 0;
  const result = await executePing(payload);
  assertEquals(result, payload);
});

Deno.test("Ping: Negative number payload MUST be returned verbatim", async () => {
  const payload = -123.456;
  const result = await executePing(payload);
  assertEquals(result, payload);
});

Deno.test("Ping: Boolean true payload MUST be returned verbatim", async () => {
  const payload = true;
  const result = await executePing(payload);
  assertEquals(result, payload);
});

Deno.test("Ping: Boolean false payload MUST be returned verbatim", async () => {
  const payload = false;
  const result = await executePing(payload);
  assertEquals(result, payload);
});

Deno.test("Ping: Null payload MUST be returned verbatim", async () => {
  const payload = null;
  const result = await executePing(payload);
  assertEquals(result, payload);
});

// ============================================================================
// Test Group 2: Compound Types (Objects and Arrays)
// ============================================================================

Deno.test("Ping: Object payload MUST be returned verbatim", async () => {
  const payload = { key: "value", nested: { deep: true } };
  const result = await executePing(payload);
  assertEquals(result, payload);
});

Deno.test("Ping: Empty object payload MUST be returned verbatim", async () => {
  const payload = {};
  const result = await executePing(payload);
  assertEquals(result, payload);
});

Deno.test("Ping: Array payload MUST be returned verbatim", async () => {
  const payload = [1, 2, 3, "four", { five: 5 }];
  const result = await executePing(payload);
  assertEquals(result, payload);
});

Deno.test("Ping: Empty array payload MUST be returned verbatim", async () => {
  const payload: unknown[] = [];
  const result = await executePing(payload);
  assertEquals(result, payload);
});

Deno.test("Ping: Deeply nested structure MUST be returned verbatim", async () => {
  const payload = {
    level1: {
      level2: {
        level3: {
          level4: {
            value: "deep",
            array: [1, [2, [3, [4]]]],
          },
        },
      },
    },
  };
  const result = await executePing(payload);
  assertEquals(result, payload);
});

// ============================================================================
// Test Group 3: Edge Cases (Boundary Conditions)
// ============================================================================

Deno.test("Ping: Unicode payload MUST be returned verbatim", async () => {
  const payload = "Hello 世界 🌍 مرحبا";
  const result = await executePing(payload);
  assertEquals(result, payload);
});

Deno.test("Ping: Special characters payload MUST be returned verbatim", async () => {
  const payload = "Line1\nLine2\tTabbed\r\nCRLF";
  const result = await executePing(payload);
  assertEquals(result, payload);
});

Deno.test("Ping: JSON-like string payload MUST NOT be parsed", async () => {
  // A string that looks like JSON should remain a string
  const payload = '{"not": "parsed"}';
  const result = await executePing(payload);
  assertEquals(result, payload);
  assertEquals(typeof result, "string");
});

Deno.test("Ping: Mixed types in array MUST be preserved", async () => {
  const payload = [
    "string",
    123,
    true,
    false,
    null,
    { obj: "ect" },
    ["nested"],
  ];
  const result = await executePing(payload);
  assertEquals(result, payload);
});

// ============================================================================
// Test Group 4: Large Payload (Truncation Detection)
// ============================================================================

Deno.test("Ping: 1KB payload MUST NOT be truncated", async () => {
  const payload = "x".repeat(1024);
  const result = await executePing(payload);
  assertEquals((result as string).length, 1024);
  assertEquals(result, payload);
});

Deno.test("Ping: 10KB payload MUST NOT be truncated", async () => {
  const payload = "y".repeat(10 * 1024);
  const result = await executePing(payload);
  assertEquals((result as string).length, 10 * 1024);
  assertEquals(result, payload);
});

Deno.test("Ping: Complex 5KB object MUST NOT be truncated", async () => {
  // Create a complex object with many keys
  const payload: Record<string, unknown> = {};
  for (let i = 0; i < 100; i++) {
    payload[`key_${i}`] = {
      index: i,
      data: "x".repeat(50),
      nested: { value: i * 2 },
    };
  }
  const result = await executePing(payload);
  assertEquals(Object.keys(result as object).length, 100);
  assertEquals(result, payload);
});

// ============================================================================
// Test Group 5: Correlation/Causation Lineage
// ============================================================================

/**
 * Helper: Execute Ping and return full OsMessage (for metadata inspection)
 */
async function executePingFull(
  payload: unknown,
  correlationId?: string
): Promise<{ data: { payload: unknown }; metadata?: { id?: string; correlation?: string; causation?: string } }> {
  const processor = pingCapability.factory();

  const results: unknown[] = [];
  const collector = new WritableStream({
    write(chunk) {
      results.push(chunk);
    },
  });

  const input = createMessage("query", "Ping", { payload }, undefined, correlationId);
  const inputStream = new ReadableStream({
    start(controller) {
      controller.enqueue(input);
      controller.close();
    },
  });

  // Run both pipes CONCURRENTLY
  await Promise.all([
    inputStream.pipeTo(processor.writable),
    processor.readable.pipeTo(collector),
  ]);

  return results[0] as { data: { payload: unknown }; metadata?: { id?: string; correlation?: string; causation?: string } };
}

Deno.test("Ping: Correlation ID MUST be preserved in Pong", async () => {
  const correlationId = "workflow-abc-123";
  const result = await executePingFull("test", correlationId);
  assertEquals(result.metadata?.correlation, correlationId);
});

Deno.test("Ping: Causation ID MUST reference input message ID", async () => {
  const processor = pingCapability.factory();

  const results: unknown[] = [];
  const collector = new WritableStream({
    write(chunk) {
      results.push(chunk);
    },
  });

  const input = createMessage("query", "Ping", { payload: "test" });
  const inputId = input.metadata?.id;

  const inputStream = new ReadableStream({
    start(controller) {
      controller.enqueue(input);
      controller.close();
    },
  });

  // Run both pipes CONCURRENTLY
  await Promise.all([
    inputStream.pipeTo(processor.writable),
    processor.readable.pipeTo(collector),
  ]);

  const result = results[0] as { metadata?: { causation?: string } };
  assertEquals(result.metadata?.causation, inputId);
});

// ============================================================================
// Test Group 6: Schema Validation
// ============================================================================

Deno.test("Ping: Inbound schema validates query kind", () => {
  const validMessage = {
    kind: "query",
    type: "Ping",
    data: { payload: "test" },
  };
  const result = pingCapability.inbound.safeParse(validMessage);
  assertEquals(result.success, true);
});

Deno.test("Ping: Inbound schema rejects command kind", () => {
  const invalidMessage = {
    kind: "command", // Wrong kind
    type: "Ping",
    data: { payload: "test" },
  };
  const result = pingCapability.inbound.safeParse(invalidMessage);
  assertEquals(result.success, false);
});

Deno.test("Ping: Outbound schema validates reply kind", () => {
  const validMessage = {
    kind: "reply",
    type: "Ping",
    data: { payload: "test" },
  };
  const result = pingCapability.outbound.safeParse(validMessage);
  assertEquals(result.success, true);
});

import { assertEquals } from "jsr:@std/assert";
import { route } from "./engine.ts";
import { createMessage } from "../schema/message.ts";
import { registry } from "../capabilities/registry.ts";

Deno.test("Bus: Route to known capability", async () => {
  const msg = createMessage("query", "Syscall.Ping", { payload: "test" });
  const result = await route(msg, registry);
  
  assertEquals(result.kind, "reply");
  assertEquals((result.data as any).payload, "test");
});

Deno.test("Bus: Route to unknown capability returns Error (404)", async () => {
  const msg = createMessage("command", "Hacker.Attack", { target: "kernel" });
  const result = await route(msg, registry);
  
  assertEquals(result.kind, "error");
  const error = result.data as { code: number; message: string };
  assertEquals(error.code, 404);
  assertEquals(error.message, "Capability 'Hacker.Attack' not found in registry.");
});

Deno.test("Bus: Route ignores non-command/query messages", async () => {
  const msg = createMessage("event", "System.Log", { text: "info" });
  const result = await route(msg, registry);
  
  // Should return the message unchanged
  assertEquals(result, msg);
});

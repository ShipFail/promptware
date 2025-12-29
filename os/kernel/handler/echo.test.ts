import { assertEquals } from "jsr:@std/assert";
import echoModule from "./echo.ts";

Deno.test("Syscall: Echo MUST return input message", async () => {
  const result = await echoModule.handler({ message: "hello world" }, {} as any);
  assertEquals(result.echo, "hello world");
});

Deno.test("Syscall: Echo MUST handle empty message", async () => {
  const result = await echoModule.handler({ message: "" }, {} as any);
  assertEquals(result.echo, "");
});

Deno.test("Syscall: Echo cliAdapter MUST join arguments", () => {
  const input = echoModule.cliAdapter!(["hello", "world"]);
  assertEquals(input.message, "hello world");
});

Deno.test("Syscall: Echo cliAdapter MUST handle empty arguments", () => {
  const input = echoModule.cliAdapter!([]);
  assertEquals(input.message, "");
});

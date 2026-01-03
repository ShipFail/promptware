import { assertEquals } from "jsr:@std/assert";
import echoModule from "./echo.ts";

Deno.test("Syscall: Echo MUST return input message", async () => {
  const result = await echoModule.process({ message: "hello world" }, {} as any);
  assertEquals(result.echo, "hello world");
});

Deno.test("Syscall: Echo MUST handle empty message", async () => {
  const result = await echoModule.process({ message: "" }, {} as any);
  assertEquals(result.echo, "");
});

Deno.test("Syscall: Echo fromArgs MUST join arguments", () => {
  const input = echoModule.fromArgs!(["hello", "world"]);
  assertEquals(input.message, "hello world");
});

Deno.test("Syscall: Echo fromArgs MUST handle empty arguments", () => {
  const input = echoModule.fromArgs!([]);
  assertEquals(input.message, "");
});

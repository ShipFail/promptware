import { assertEquals } from "jsr:@std/assert";
import echo from "./echo.ts";

Deno.test("Syscall: Echo MUST return joined arguments", async () => {
  const result = await echo("os://", "hello", "world");
  assertEquals(result, "hello world");
});

Deno.test("Syscall: Echo MUST handle empty arguments", async () => {
  const result = await echo("os://");
  assertEquals(result, "");
});

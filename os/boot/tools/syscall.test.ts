import { assertEquals } from "jsr:@std/assert";
import { resolveUri } from "./syscall.ts";

const ROOT = "https://raw.githubusercontent.com/ShipFail/promptware/main/os/";

Deno.test("resolveUri - Absolute URL", () => {
  const uri = "https://example.com/foo.md";
  const result = resolveUri(ROOT, uri);
  assertEquals(result, "https://example.com/foo.md");
});

Deno.test("resolveUri - os:// Protocol", () => {
  const uri = "os://agents/powell.md";
  const result = resolveUri(ROOT, uri);
  assertEquals(result, "https://raw.githubusercontent.com/ShipFail/promptware/main/os/agents/powell.md");
});

Deno.test("resolveUri - OS Absolute Path (/)", () => {
  const uri = "/skills/writer.md";
  const result = resolveUri(ROOT, uri);
  assertEquals(result, "https://raw.githubusercontent.com/ShipFail/promptware/main/os/skills/writer.md");
});

Deno.test("resolveUri - Relative Path (./) with URL Base", () => {
  const base = "https://raw.githubusercontent.com/ShipFail/promptware/main/os/agents/powell.md";
  const uri = "./helper.md";
  const result = resolveUri(ROOT, uri, base);
  assertEquals(result, "https://raw.githubusercontent.com/ShipFail/promptware/main/os/agents/helper.md");
});

Deno.test("resolveUri - Relative Path (../) with URL Base", () => {
  const base = "https://raw.githubusercontent.com/ShipFail/promptware/main/os/agents/powell.md";
  const uri = "../skills/writer.md";
  const result = resolveUri(ROOT, uri, base);
  assertEquals(result, "https://raw.githubusercontent.com/ShipFail/promptware/main/os/skills/writer.md");
});

Deno.test("resolveUri - Relative Path (../) with Local File Base", () => {
  // Simulating local development
  const root = "/workspaces/promptware/os/";
  const base = "/workspaces/promptware/os/agents/powell.md";
  const uri = "../skills/writer.md";
  const result = resolveUri(root, uri, base);
  assertEquals(result, "/workspaces/promptware/os/skills/writer.md");
});

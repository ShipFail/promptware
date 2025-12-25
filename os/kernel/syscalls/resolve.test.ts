import { assertEquals } from "jsr:@std/assert";
import resolve from "./resolve.ts";

Deno.test("RFC 0013: Resolve Absolute OS Path", async () => {
  const root = "https://raw.githubusercontent.com/ShipFail/promptware/main/os/";
  const result = await resolve("os://agents/powell.md", undefined, root);
  assertEquals(result, "https://raw.githubusercontent.com/ShipFail/promptware/main/os/agents/powell.md");
});

Deno.test("RFC 0013: Resolve Relative Path (Sibling)", async () => {
  const root = "https://example.com/os/";
  const base = "https://example.com/os/agents/powell.md";
  const result = await resolve("./felix.md", base, root);
  assertEquals(result, "https://example.com/os/agents/felix.md");
});

Deno.test("RFC 0013: Resolve Relative Path (Parent)", async () => {
  const root = "https://example.com/os/";
  const base = "https://example.com/os/agents/powell.md";
  const result = await resolve("../skills/writer.md", base, root);
  assertEquals(result, "https://example.com/os/skills/writer.md");
});

Deno.test("RFC 0013: Default to file:// for local paths", async () => {
  const root = "file:///workspaces/promptware/os/";
  // If base is not provided, it might default to CWD or __filename.
  // The resolve.ts implementation uses 'new URL(uri, base)' logic.
  // If uri is absolute (starts with /), it's file://
  
  // Note: resolve.ts treats paths starting with / as relative to ROOT, not filesystem root.
  // So /tmp/test.txt becomes root + tmp/test.txt
  const result = await resolve("/tmp/test.txt", undefined, root);
  assertEquals(result, "file:///workspaces/promptware/os/tmp/test.txt");
});

Deno.test("RFC 0015: Absolute URLs MUST pass through unchanged", async () => {
  const root = "https://example.com/os/";
  const result = await resolve("https://external.com/resource.md", undefined, root);
  assertEquals(result, "https://external.com/resource.md");
});

Deno.test("RFC 0015: Relative path without base MUST anchor to root", async () => {
  const root = "https://example.com/os/";
  const result = await resolve("agents/powell.md", undefined, root);
  assertEquals(result, "https://example.com/os/agents/powell.md");
});

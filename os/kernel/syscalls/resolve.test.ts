import { assertEquals } from "jsr:@std/assert";
import resolve from "./resolve.ts";

Deno.test("RFC 0013: Resolve Absolute OS Path", async () => {
  const root = "https://raw.githubusercontent.com/ShipFail/promptware/main/os/";
  const result = await resolve(root, "os://agents/powell.md");
  assertEquals(result, "https://raw.githubusercontent.com/ShipFail/promptware/main/os/agents/powell.md");
});

Deno.test("RFC 0013: Resolve Relative Path (Sibling)", async () => {
  const root = "https://example.com/os/";
  const base = "https://example.com/os/agents/powell.md";
  const result = await resolve(root, "./felix.md", base);
  assertEquals(result, "https://example.com/os/agents/felix.md");
});

Deno.test("RFC 0013: Resolve Relative Path (Parent)", async () => {
  const root = "https://example.com/os/";
  const base = "https://example.com/os/agents/powell.md";
  const result = await resolve(root, "../skills/writer.md", base);
  assertEquals(result, "https://example.com/os/skills/writer.md");
});

Deno.test("RFC 0013: Default to file:// for local paths", async () => {
  const root = "file:///workspaces/promptware/os/";
  // If base is not provided, it might default to CWD or __filename.
  // The resolve.ts implementation uses 'new URL(uri, base)' logic.
  // If uri is absolute (starts with /), it's file://
  
  // Note: resolve.ts treats paths starting with / as relative to ROOT, not filesystem root.
  // So /tmp/test.txt becomes root + tmp/test.txt
  const result = await resolve(root, "/tmp/test.txt");
  assertEquals(result, "file:///workspaces/promptware/os/tmp/test.txt");
});

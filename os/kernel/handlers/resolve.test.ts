import { assertEquals } from "jsr:@std/assert";
import resolveModule from "./resolve.ts";

// Mock Deno.openKv to provide test root
async function withMockKv(root: string, mounts: Record<string, string> | undefined, fn: () => Promise<void>) {
  const originalOpenKv = Deno.openKv;
  Deno.openKv = async () => {
    return {
      get: async (key: any[]) => {
        if (key[0] === "proc" && key[1] === "cmdline") {
          return { value: JSON.stringify({ root, mounts }) };
        }
        return { value: null };
      },
      close: () => {},
    } as any;
  };
  try {
    await fn();
  } finally {
    Deno.openKv = originalOpenKv;
  }
}

Deno.test("RFC 0013: Resolve Absolute OS Path", async () => {
  const root = "https://raw.githubusercontent.com/ShipFail/promptware/main/os/";
  await withMockKv(root, undefined, async () => {
    const result = await resolveModule.process({ uri: "os://agents/powell.md" }, {} as any);
    assertEquals(result.resolved, "https://raw.githubusercontent.com/ShipFail/promptware/main/os/agents/powell.md");
  });
});

Deno.test("RFC 0013: Resolve Relative Path (Sibling)", async () => {
  const root = "https://example.com/os/";
  const base = "https://example.com/os/agents/powell.md";
  await withMockKv(root, undefined, async () => {
    const result = await resolveModule.process({ uri: "./felix.md", base }, {} as any);
    assertEquals(result.resolved, "https://example.com/os/agents/felix.md");
  });
});

Deno.test("RFC 0013: Resolve Relative Path (Parent)", async () => {
  const root = "https://example.com/os/";
  const base = "https://example.com/os/agents/powell.md";
  await withMockKv(root, undefined, async () => {
    const result = await resolveModule.process({ uri: "../skills/writer.md", base }, {} as any);
    assertEquals(result.resolved, "https://example.com/os/skills/writer.md");
  });
});

Deno.test("RFC 0013: Default to file:// for local paths", async () => {
  const root = "file:///workspaces/promptware/os/";
  // If base is not provided, it might default to CWD or __filename.
  // The resolve.ts implementation uses 'new URL(uri, base)' logic.
  // If uri is absolute (starts with /), it's file://

  // Note: resolve.ts treats paths starting with / as relative to ROOT, not filesystem root.
  // So /tmp/test.txt becomes root + tmp/test.txt
  await withMockKv(root, undefined, async () => {
    const result = await resolveModule.process({ uri: "/tmp/test.txt" }, {} as any);
    assertEquals(result.resolved, "file:///workspaces/promptware/os/tmp/test.txt");
  });
});

Deno.test("RFC 0015: Absolute URLs MUST pass through unchanged", async () => {
  const root = "https://example.com/os/";
  await withMockKv(root, undefined, async () => {
    const result = await resolveModule.process({ uri: "https://external.com/resource.md" }, {} as any);
    assertEquals(result.resolved, "https://external.com/resource.md");
  });
});

Deno.test("RFC 0015: Relative path without base MUST anchor to root", async () => {
  const root = "https://example.com/os/";
  await withMockKv(root, undefined, async () => {
    const result = await resolveModule.process({ uri: "agents/powell.md" }, {} as any);
    assertEquals(result.resolved, "https://example.com/os/agents/powell.md");
  });
});

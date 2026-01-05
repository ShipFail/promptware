import { assertEquals } from "jsr:@std/assert";
import { FileSystemResolve } from "./resolve.ts";
import { dispatch } from "../lib/dispatch.ts";

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
    const result = await dispatch(FileSystemResolve, { uri: "os://agents/odin.md" });
    const data = result.data as { resolved: string };
    assertEquals(data.resolved, "https://raw.githubusercontent.com/ShipFail/promptware/main/os/agents/odin.md");
  });
});

Deno.test("RFC 0013: Resolve Relative Path (Sibling)", async () => {
  const root = "https://example.com/os/";
  const base = "https://example.com/os/agents/odin.md";
  await withMockKv(root, undefined, async () => {
    const result = await dispatch(FileSystemResolve, { uri: "./felix.md", base });
    const data = result.data as { resolved: string };
    assertEquals(data.resolved, "https://example.com/os/agents/felix.md");
  });
});

Deno.test("RFC 0013: Resolve Relative Path (Parent)", async () => {
  const root = "https://example.com/os/";
  const base = "https://example.com/os/agents/odin.md";
  await withMockKv(root, undefined, async () => {
    const result = await dispatch(FileSystemResolve, { uri: "../skills/writer.md", base });
    const data = result.data as { resolved: string };
    assertEquals(data.resolved, "https://example.com/os/skills/writer.md");
  });
});

Deno.test("RFC 0013: Default to file:// for local paths", async () => {
  const root = "file:///workspaces/promptware/os/";
  await withMockKv(root, undefined, async () => {
    const result = await dispatch(FileSystemResolve, { uri: "/tmp/test.txt" });
    const data = result.data as { resolved: string };
    assertEquals(data.resolved, "file:///workspaces/promptware/os/tmp/test.txt");
  });
});

Deno.test("RFC 0015: Absolute URLs MUST pass through unchanged", async () => {
  const root = "https://example.com/os/";
  await withMockKv(root, undefined, async () => {
    const result = await dispatch(FileSystemResolve, { uri: "https://external.com/resource.md" });
    const data = result.data as { resolved: string };
    assertEquals(data.resolved, "https://external.com/resource.md");
  });
});

Deno.test("RFC 0015: Relative path without base MUST anchor to root", async () => {
  const root = "https://example.com/os/";
  await withMockKv(root, undefined, async () => {
    const result = await dispatch(FileSystemResolve, { uri: "agents/odin.md" });
    const data = result.data as { resolved: string };
    assertEquals(data.resolved, "https://example.com/os/agents/odin.md");
  });
});

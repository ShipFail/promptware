import { assertEquals, assertRejects } from "jsr:@std/assert";
import { FileSystemHydrate } from "./hydrate.ts";
import { dispatch, dispatchAll } from "../lib/dispatch.ts";

// Mock fetch for hydrate
const originalFetch = globalThis.fetch;

function mockFetch(body: string) {
  globalThis.fetch = async () => new Response(body);
}

function restoreFetch() {
  globalThis.fetch = originalFetch;
}

// Mock Deno.openKv to provide test root
async function withMockKv(root: string, fn: () => Promise<void>) {
  const originalOpenKv = Deno.openKv;
  Deno.openKv = async () => {
    return {
      get: async (key: any[]) => {
        if (key[0] === "proc" && key[1] === "cmdline") {
          return { value: JSON.stringify({ root }) };
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

Deno.test("RFC 0020: Hydrate MUST return ACK and trigger Kernel.Ingest", async () => {
  const content = "# Just Markdown\n\nNo YAML here.";

  mockFetch(content);
  try {
    await withMockKv("https://root.com/", async () => {
      const results = await dispatchAll(FileSystemHydrate, { uri: "https://example.com/simple.md" });
      
      // 1. Check ACK
      assertEquals(results.length, 2);
      assertEquals(results[0].kind, "reply");
      assertEquals((results[0].data as any).code, 202);

      // 2. Check Ingest
      assertEquals(results[1].kind, "command");
      assertEquals(results[1].type, "Kernel.Ingest");
      assertEquals((results[1].data as any).data, content);
    });
  } finally {
    restoreFetch();
  }
});

Deno.test("RFC 0020: Hydrate MUST preserve content with front matter", async () => {
  const content = `---
name: TestAgent
description: A test agent
---
# Hello`;

  mockFetch(content);
  try {
    await withMockKv("https://root.com/", async () => {
      const results = await dispatchAll(FileSystemHydrate, { uri: "https://example.com/agent.md" });
      const ingestData = (results[1].data as any).data;
      // Should return hydrated content with frontmatter
      assertEquals(ingestData.includes("# Hello"), true);
    });
  } finally {
    restoreFetch();
  }
});

Deno.test("RFC 0020: Hydrate MUST fail on fetch error", async () => {
  globalThis.fetch = async () => { throw new Error("Network Error"); };
  try {
    await withMockKv("https://root.com/", async () => {
      // dispatchAll should return an error message in the stream, NOT throw
      const results = await dispatchAll(FileSystemHydrate, { uri: "https://example.com/bad.md" });
      
      assertEquals(results.length, 1);
      assertEquals(results[0].kind, "error");
      assertEquals((results[0].data as any).message, "Failed to read https://example.com/bad.md: Network Error");
    });
  } finally {
    restoreFetch();
  }
});

Deno.test("RFC 0020: Hydrate MUST preserve body content", async () => {
  const body = "\n\n# Hello World\n\nThis is content.\n";
  const content = `---\nname: Test\n---${body}`;

  mockFetch(content);
  try {
    await withMockKv("https://root.com/", async () => {
      const results = await dispatchAll(FileSystemHydrate, { uri: "https://example.com/test.md" });
      const ingestData = (results[1].data as any).data;
      
      // Body should be preserved after front matter
      if (!ingestData.includes("# Hello World")) {
        throw new Error("Body content was modified");
      }
      if (!ingestData.includes("This is content.")) {
        throw new Error("Body content was truncated");
      }
    });
  } finally {
    restoreFetch();
  }
});

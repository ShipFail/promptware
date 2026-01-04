import { assertEquals, assertRejects } from "jsr:@std/assert";
import ingestModule from "./ingest.ts";
import { dispatch } from "../test-utils.ts";

// Mock fetch for ingest
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

Deno.test("RFC 0020: Ingest MUST return raw content without front matter", async () => {
  const content = "# Just Markdown\n\nNo YAML here.";

  mockFetch(content);
  try {
    await withMockKv("https://root.com/", async () => {
      const result = await dispatch(ingestModule, "FileSystem.Ingest", { uri: "https://example.com/simple.md" });
      const data = result.data as { content: string };
      assertEquals(data.content, content);
    });
  } finally {
    restoreFetch();
  }
});

Deno.test("RFC 0020: Ingest MUST preserve content with front matter", async () => {
  const content = `---
name: TestAgent
description: A test agent
---
# Hello`;

  mockFetch(content);
  try {
    await withMockKv("https://root.com/", async () => {
      const result = await dispatch(ingestModule, "FileSystem.Ingest", { uri: "https://example.com/agent.md" });
      const data = result.data as { content: string };
      // Should return hydrated content with frontmatter
      assertEquals(data.content.includes("# Hello"), true);
    });
  } finally {
    restoreFetch();
  }
});

Deno.test("RFC 0020: Ingest MUST fail on fetch error", async () => {
  globalThis.fetch = async () => { throw new Error("Network Error"); };
  try {
    await withMockKv("https://root.com/", async () => {
      await assertRejects(
        async () => await dispatch(ingestModule, "FileSystem.Ingest", { uri: "https://example.com/bad.md" }),
        Error,
        "Network Error"
      );
    });
  } finally {
    restoreFetch();
  }
});

Deno.test("RFC 0020: Ingest MUST preserve body content", async () => {
  const body = "\n\n# Hello World\n\nThis is content.\n";
  const content = `---\nname: Test\n---${body}`;

  mockFetch(content);
  try {
    await withMockKv("https://root.com/", async () => {
      const result = await dispatch(ingestModule, "FileSystem.Ingest", { uri: "https://example.com/test.md" });
      const data = result.data as { content: string };
      // Body should be preserved after front matter
      if (!data.content.includes("# Hello World")) {
        throw new Error("Body content was modified");
      }
      if (!data.content.includes("This is content.")) {
        throw new Error("Body content was truncated");
      }
    });
  } finally {
    restoreFetch();
  }
});

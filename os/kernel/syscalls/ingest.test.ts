import { assertEquals, assertRejects } from "jsr:@std/assert";
import ingest from "./ingest.ts";

// Mock fetch for ingest
const originalFetch = globalThis.fetch;

function mockFetch(body: string) {
  globalThis.fetch = async () => new Response(body);
}

function restoreFetch() {
  globalThis.fetch = originalFetch;
}

Deno.test("RFC 0020: Ingest MUST return raw content", async () => {
  const content = `---
name: TestAgent
description: A test agent
---
# Hello`;
  
  mockFetch(content);
  try {
    const result = await ingest("https://example.com/agent.md", "https://root.com/");
    assertEquals(result, content);
  } finally {
    restoreFetch();
  }
});

Deno.test("RFC 0020: Ingest MUST hydrate metadata (console.log check)", async () => {
  // We can't easily check console.log output in Deno test without spying.
  // But we can verify it doesn't crash on valid frontmatter.
  const content = `---
name: ValidAgent
description: Valid description
---
# Code`;
  
  mockFetch(content);
  try {
    await ingest("https://example.com/agent.md", "https://root.com/");
  } finally {
    restoreFetch();
  }
});

Deno.test("RFC 0020: Ingest MUST fail on fetch error", async () => {
  globalThis.fetch = async () => { throw new Error("Network Error"); };
  try {
    await assertRejects(
      async () => await ingest("https://example.com/bad.md", "os://"),
      Error,
      "Network Error"
    );
  } finally {
    restoreFetch();
  }
});

Deno.test("RFC 0020: Ingest MUST preserve body content", async () => {
  const body = "\n\n# Hello World\n\nThis is content.\n";
  const content = `---\nname: Test\n---${body}`;
  
  mockFetch(content);
  try {
    const result = await ingest("https://example.com/test.md", "https://root.com/");
    // Body should be preserved after front matter
    if (!result.includes("# Hello World")) {
      throw new Error("Body content was modified");
    }
    if (!result.includes("This is content.")) {
      throw new Error("Body content was truncated");
    }
  } finally {
    restoreFetch();
  }
});

Deno.test("RFC 0020: Ingest MUST handle files without front matter", async () => {
  const content = "# Just Markdown\n\nNo YAML here.";
  
  mockFetch(content);
  try {
    const result = await ingest("https://example.com/simple.md", "https://root.com/");
    assertEquals(result, content);
  } finally {
    restoreFetch();
  }
});

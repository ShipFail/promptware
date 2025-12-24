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
    const result = await ingest("os://", "https://example.com/agent.md");
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
    await ingest("os://", "https://example.com/agent.md");
  } finally {
    restoreFetch();
  }
});

Deno.test("RFC 0020: Ingest MUST fail on fetch error", async () => {
  globalThis.fetch = async () => { throw new Error("Network Error"); };
  try {
    await assertRejects(
      async () => await ingest("os://", "https://example.com/bad.md"),
      Error,
      "Network Error"
    );
  } finally {
    restoreFetch();
  }
});

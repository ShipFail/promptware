import { assertEquals, assertRejects } from "jsr:@std/assert";
import { NetworkFetch } from "./fetch.ts";
import { dispatch } from "../lib/dispatch.ts";

// Mock globalThis.fetch
const originalFetch = globalThis.fetch;

function mockFetch(handler: (req: Request) => Response) {
  globalThis.fetch = async (input: string | Request | URL, init?: RequestInit) => {
    const req = new Request(input, init);
    return handler(req);
  };
}

function restoreFetch() {
  globalThis.fetch = originalFetch;
}

Deno.test("RFC 0017: Fetch MUST attempt to unseal pwenc headers", async () => {
  const url = "https://example.com";
  const pwenc = "pwenc:v1:fake_ciphertext";

  // We expect this to fail because 'open' will fail to decrypt 'fake_ciphertext'.
  // The error message from crypto.ts 'open' is "Invalid format: payload is not base64url" or similar.
  // This proves fetch.ts detected the header and called open().

  await assertRejects(
    async () => await dispatch(NetworkFetch, {
      url,
      init: {
        headers: { "Authorization": `Bearer ${pwenc}` }
      }
    }),
    Error,
    "Failed to unseal header 'authorization'"
  );
});

Deno.test("RFC 0017: Fetch MUST pass through standard requests", async () => {
  const url = "https://example.com/api";

  mockFetch((req) => {
    assertEquals(req.url, url);
    assertEquals(req.headers.get("X-Custom"), "value");
    return new Response("ok", { status: 200 });
  });

  try {
    const result = await dispatch(NetworkFetch, {
      url,
      init: {
        headers: { "X-Custom": "value" }
      }
    });

    const data = result.data as any;
    assertEquals(data.status, 200);
    assertEquals(data.body, "ok");
  } finally {
    restoreFetch();
  }
});

Deno.test("RFC 0017: Fetch MUST return serializable response object", async () => {
  const url = "https://example.com/data";

  mockFetch(() => new Response("test data", {
    status: 201,
    statusText: "Created",
    headers: { "Content-Type": "text/plain" }
  }));

  try {
    const result = await dispatch(NetworkFetch, { url });
    const data = result.data as any;

    // Verify structure
    assertEquals(typeof data, "object");
    assertEquals(data.ok, true);
    assertEquals(data.status, 201);
    assertEquals(data.statusText, "Created");
    assertEquals(data.body, "test data");
    assertEquals(data.headers["content-type"], "text/plain");

    // Verify it's serializable
    const json = JSON.stringify(data);
    assertEquals(typeof json, "string");
  } finally {
    restoreFetch();
  }
});

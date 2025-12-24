import { assertEquals, assertRejects } from "jsr:@std/assert";
import fetchSyscall from "./fetch.ts";

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

// Mock crypto.ts open function
// Since fetch.ts imports 'open' from './crypto.ts', and we can't easily mock that import,
// we will rely on the fact that 'open' throws if the format is invalid.
// To test the "unsealing" logic, we would need 'open' to actually return plaintext.
// Since we can't mock 'open' easily, we will test the *attempt* to unseal.
// If we pass a valid-looking pwenc string, fetch.ts will call open().
// If open() fails (because we don't have the key), fetch.ts throws.
// This confirms that fetch.ts IS attempting to unseal.

Deno.test("RFC 0017: Fetch MUST attempt to unseal pwenc headers", async () => {
  const root = "os://";
  const url = "https://example.com";
  const pwenc = "pwenc:v1:fake_ciphertext";

  // We expect this to fail because 'open' will fail to decrypt 'fake_ciphertext'.
  // The error message from crypto.ts 'open' is "Invalid format: payload is not base64url" or similar.
  // This proves fetch.ts detected the header and called open().
  
  await assertRejects(
    async () => await fetchSyscall(root, url, JSON.stringify({
      headers: { "Authorization": `Bearer ${pwenc}` }
    })),
    Error,
    "Failed to unseal header 'authorization'"
  );
});

Deno.test("RFC 0017: Fetch MUST pass through standard requests", async () => {
  const root = "os://";
  const url = "https://example.com/api";
  
  mockFetch((req) => {
    assertEquals(req.url, url);
    assertEquals(req.headers.get("X-Custom"), "value");
    return new Response("ok", { status: 200 });
  });

  try {
    const result = await fetchSyscall(root, url, JSON.stringify({
      headers: { "X-Custom": "value" }
    }));
    
    assertEquals(result.status, 200);
    assertEquals(result.body, "ok");
  } finally {
    restoreFetch();
  }
});

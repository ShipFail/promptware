import { assertEquals, assertRejects } from "jsr:@std/assert";
import { encodeBase64Url } from "jsr:@std/encoding/base64url";
import cryptoSyscall, { seal, open } from "./crypto.ts";

// Mock Deno.connect for SSH Agent
// We need to simulate the SSH Agent Protocol:
// 1. Request Identities (Code 11) -> Answer (Code 12) with KeyBlob
// 2. Sign Request (Code 13) -> Answer (Code 14) with Signature

const MOCK_KEY_BLOB = new Uint8Array([0, 0, 0, 7, ...new TextEncoder().encode("ssh-rsa"), 0, 0, 0, 1, 65]); // Minimal fake key
const MOCK_SIG = new Uint8Array([0, 0, 0, 7, ...new TextEncoder().encode("ssh-rsa"), 0, 0, 0, 4, 0xDE, 0xAD, 0xBE, 0xEF]); // Fake sig

const originalConnect = Deno.connect;

function mockAgent() {
  Deno.connect = async (options) => {
    if (options.transport === "unix") {
      return {
        read: async (p: Uint8Array) => {
          // This is a very simplified mock that just returns canned responses
          // based on the expected flow.
          // In reality, we'd parse the request buffer.
          // For now, we assume the flow is always GetKey -> Sign.
          return null; // We handle logic in write/read loop simulation or just mock the SshAgentClient class?
          // Mocking the class is harder because it's not exported.
          // Let's try to mock the socket behavior.
        },
        write: async (p: Uint8Array) => {
          return p.length;
        },
        close: () => {},
        // We need to implement a stateful reader
      } as any;
    }
    throw new Error("Unexpected connection");
  };
}

// Actually, mocking the socket at the byte level is complex and brittle.
// A better approach for this unit test is to verify the 'seal' and 'open' logic
// assuming the key derivation works.
// However, 'deriveKey' is internal.
// Let's try to mock the SshAgentClient prototype if possible, or just mock Deno.env.get("SSH_AUTH_SOCK")
// and assert failure first.

Deno.test("RFC 0016: Crypto MUST fail if SSH_AUTH_SOCK is missing", async () => {
  const originalEnv = Deno.env.get;
  Deno.env.get = (key) => {
    if (key === "SSH_AUTH_SOCK") return undefined;
    return originalEnv(key);
  };

  try {
    await assertRejects(
      async () => await cryptoSyscall("os://", "seal", "secret"),
      Error,
      "SSH_AUTH_SOCK not defined"
    );
  } finally {
    Deno.env.get = originalEnv;
  }
});

// For the success path, since we cannot easily mock the internal SshAgentClient class
// or the complex socket interaction without a lot of boilerplate,
// we will skip the full end-to-end crypto test in this unit test suite.
// The logic is heavily dependent on the external SSH Agent.
// We can, however, test the 'open' validation logic for invalid inputs.

Deno.test("RFC 0016: Open MUST reject invalid pwenc format", async () => {
  await assertRejects(
    async () => await open("invalid_prefix"),
    Error,
    "Invalid format: missing pwenc:v1: prefix"
  );
});

Deno.test("RFC 0016: Open MUST reject invalid base64", async () => {
  await assertRejects(
    async () => await open("pwenc:v1:not_base64!"),
    Error,
    "Invalid format: payload is not base64url"
  );
});

Deno.test("RFC 0016: Open MUST reject invalid JSON payload", async () => {
  const badJson = encodeBase64Url(new TextEncoder().encode("{ bad: json }"));
  await assertRejects(
    async () => await open(`pwenc:v1:${badJson}`),
    Error,
    "Invalid format: payload is not JSON"
  );
});

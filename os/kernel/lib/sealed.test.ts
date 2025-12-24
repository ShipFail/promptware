import { assertEquals, assertRejects } from "jsr:@std/assert";
import { Sealed } from "./sealed.ts";

// Mock crypto.ts open function
// In a real unit test, we should mock the module, but for simplicity in this environment
// we will rely on the fact that Sealed calls 'open' from crypto.ts.
// However, since we can't easily mock module imports in Deno without a library like 'sinon' or 'testdouble'
// or using import maps to swap implementations, we will focus on the behavioral contracts
// that don't require the actual crypto syscall to succeed (e.g. validation, serialization).
// For the 'use' and 'revealUnsafe' tests, we would need integration tests or advanced mocking.

Deno.test("RFC 0017: Sealed.from() MUST validate pwenc prefix", () => {
  // Valid
  Sealed.from("pwenc:v1:valid");

  // Invalid
  try {
    Sealed.from("plaintext");
    throw new Error("Should have thrown");
  } catch (e: any) {
    assertEquals(e.message, "Invalid format: Sealed.from() requires a 'pwenc:v1:' string.");
  }
});

Deno.test("RFC 0017: Sealed.toString() MUST return ciphertext", () => {
  const ct = "pwenc:v1:secret";
  const s = Sealed.from(ct);
  assertEquals(s.toString(), ct);
});

Deno.test("RFC 0017: Sealed.toJSON() MUST return ciphertext", () => {
  const ct = "pwenc:v1:secret";
  const s = Sealed.from(ct);
  assertEquals(s.toJSON(), ct);
  assertEquals(JSON.stringify(s), `"${ct}"`);
});

Deno.test("RFC 0017: Sealed.revealUnsafe() MUST require explicit opt-in", async () => {
  const s = Sealed.from("pwenc:v1:secret");
  
  // Missing option
  await assertRejects(
    async () => await s.revealUnsafe(),
    Error,
    "Sealed.revealUnsafe() requires { unsafe: true }."
  );

  // False option
  await assertRejects(
    async () => await s.revealUnsafe({ unsafe: false }),
    Error,
    "Sealed.revealUnsafe() requires { unsafe: true }."
  );
});

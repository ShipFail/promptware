/**
 * os/kernel/core/id.test.ts
 *
 * Unit tests for ID generation utilities.
 */

import { assert, assertEquals, assertNotEquals } from "jsr:@std/assert";
import { shortId8 } from "./id8.ts";

Deno.test("shortId8 - generates 8-character string", () => {
  const id = shortId8();
  assertEquals(id.length, 8, "ID length should be exactly 8 characters");
});

Deno.test("shortId8 - uses URL-safe characters", () => {
  const id = shortId8();
  // Regex for Base64Url characters: A-Z, a-z, 0-9, -, _
  assert(/^[A-Za-z0-9\-_]+$/.test(id), `ID "${id}" contains invalid characters`);
});

Deno.test("shortId8 - generates unique values", () => {
  const id1 = shortId8();
  const id2 = shortId8();
  assertNotEquals(id1, id2, "Consecutive IDs should be unique");
});

Deno.test("shortId8 - collision check (small sample)", () => {
  const size = 1000;
  const ids = new Set<string>();
  for (let i = 0; i < size; i++) {
    ids.add(shortId8());
  }
  assertEquals(ids.size, size, "Should generate unique IDs in a small sample");
});

/**
 * os/kernel/core/id.ts
 *
 * ID Generation Utilities for the Kernel.
 *
 * Provides a function to generate short, cryptographically strong, URL-safe IDs.
 *
 * Size rationale (our use-case: <=10k IDs/day, expire after 1 day, local-only):
 * - 6 random bytes = 48 bits => 8 Base64URL chars (no padding).
 * - Collision risk per day (birthday bound):
 *     p ≈ n(n-1) / (2 * 2^48), with n = 10,000
 *       ≈ 10,000*9,999 / (2 * 281,474,976,710,656)
 *       ≈ 1.8e-7  (~1 in 5.6 million days, ~15k years).
 * - If collisions still worry you, handle them cheaply by "check-then-regenerate"
 *   when inserting into KV / map (retry loop).
 */

/**
 * Huan Jan 1, 2026
 *  use this in the prompt `b64url(rnd(6))` to ask AI generate id8().
 *  ChatGPT told me it is the shortest one with clear semantics:
 *     Very standard tokens: “random bytes” + “base64url”. Minimal ambiguity.
 */
import { encodeBase64Url } from "jsr:@std/encoding/base64url";

export function id8(): string {
  return encodeBase64Url(crypto.getRandomValues(new Uint8Array(6)));
}
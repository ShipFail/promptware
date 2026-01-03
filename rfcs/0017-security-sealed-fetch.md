---
rfc: 0017
title: Sealed Handling & sealedFetch Helper Specification
author: Huan Li, ChatGPT, GitHub Copilot
status: Draft
type: Standards Track
created: 2025-12-23
updated: 2025-12-23
version: 0.2
tags: [promptwareos, sealed, pwenc, fetch, sealedfetch, ergonomics]
---

# RFC 0017: Sealed Handling & sealedFetch Helper Specification

## Abstract

PromptWar̊e ØS is prompt-first. The PromptWare Kernel (Main Thread) is non-confidential; therefore plaintext secrets MUST be avoided in prompts, tool outputs, and logs.

This RFC defines the **developer ergonomics layer** for working with sealed secrets:

* **Sealed Handling (`Sealed`)**: a minimal abstraction that wraps ciphertext (`pwenc:v1:...`) and makes accidental plaintext exposure harder.
* **Sealed Networking (`sealedFetch`)**: a fetch-like helper that allows callers to place sealed values in request headers (commonly `Authorization`) and have them transparently unsealed *in-memory* just before the outbound request is sent.

**Compatibility note:** `sealedFetch` is **100% compatible with the W3C `fetch`** (same inputs, same `Response`, same errors), with exactly one extra behavior: it unseals `pwenc:v1:` values found in request headers in-memory right before dispatch.

This RFC intentionally does **not** define cryptography or sealed storage. Those are part of PromptWar̊e ØS security foundations and are specified elsewhere.

## Status of This Memo

This document is a PromptWar̊e ØS RFC-style specification and may change at any time.

The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**, **SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **MAY**, and **OPTIONAL** are to be interpreted as described in BCP 14 (RFC 2119, RFC 8174).

## Terminology

* **pwenc**: ciphertext string wrapper `pwenc:v1:...`.
* **Sealed**: a wrapper around pwenc ciphertext.
* **Plaintext**: unsealed secret material (e.g., OAuth token).
* **Sealed Handling**: patterns that reduce accidental plaintext disclosure in code.
* **Sealed Networking**: patterns that enable use of sealed credentials in HTTP requests.
* **Foundation RFCs**: the RFCs that define pwenc cryptography and sealed storage (referenced below).

## Design Goals

1. **Reduce accidental leaks**: discourage printing/logging plaintext secrets.
2. **Zero schema invention**: do not modify upstream API schemas.
3. **Fetch-compatible**: `sealedFetch` MUST behave identically to W3C `fetch`, except for header unsealing of `pwenc:v1:`.
4. **Minimalism**: small surface area; no allowlists; no storage.
5. **Composability**: works with ciphertext strings *and* `Sealed` objects.

## Non-Goals

1. Preventing a fully privileged program from obtaining plaintext after explicit opt-in.
2. Enforcing network destination restrictions.
3. Sealing token responses automatically (developers seal explicitly).
4. Providing UX flows (OAuth device flow UX is an app concern).

## Level Model

PromptWar̊e ØS uses simple “levels” to talk about security ergonomics:

* **Security foundations** (out of scope here): pwenc crypto + sealed storage rules.
* **Level: Sealed Handling** (this RFC): `Sealed` wrapper and disciplined plaintext access.
* **Level: Sealed Networking** (this RFC): `sealedFetch` for header unsealing.

This RFC focuses only on **Sealed Handling + Sealed Networking** because they are highly related in practice.

## The `Sealed` Abstraction

### Representation

* A `Sealed` MUST wrap a pwenc ciphertext string.
* A `Sealed` MUST serialize to its ciphertext string.

Concretely:

* `Sealed.toString()` MUST return the underlying pwenc string.
* `Sealed.toJSON()` MUST return the underlying pwenc string.

This aligns with sealed storage and CLI semantics: ciphertext is safe to copy/paste and safe to appear in prompts.

### Construction

* `Sealed.from(pwencString)` MUST validate that the input begins with `pwenc:v1:` and MUST throw if not.

### Plaintext Access

Implementations SHOULD provide a confined-use pattern:

* `await sealed.use(fn)`

Where:

* `fn(plaintext)` is invoked with plaintext secret material.
* `use(fn)` MUST NOT return plaintext.

Implementations MAY provide an unsafe escape hatch:

* `sealed.revealUnsafe()`

If provided, `revealUnsafe()`:

* MUST require explicit opt-in (e.g., `revealUnsafe({ unsafe: true })`).
* SHOULD be discouraged in documentation.

### Logging and Redaction

* `Sealed` MUST NOT expose plaintext via implicit coercions.
* Implementations SHOULD ensure error objects and debug representations do not include plaintext.

## The `Network.Fetch` Event

This RFC defines the `Network.Fetch` command, which performs the actual HTTP request.

### Command Schema

```typescript
/**
 * [Command] Network.Fetch
 * Performs a secure HTTP request, automatically unsealing 'pwenc:v1:' values 
 * found in headers just before transmission.
 */
type NetworkFetchCommand = {
  kind: "command";
  type: "Network.Fetch";
  data: {
    /** The URL to fetch. */
    url: string;
    
    /** HTTP method (GET, POST, etc.). Defaults to GET. */
    method?: string;
    
    /** 
     * HTTP headers. 
     * Values starting with 'pwenc:v1:' will be unsealed by the kernel.
     */
    headers?: Record<string, string>;
    
    /** Request body. */
    body?: string;
  };
}
```

### Response Schema

```typescript
/**
 * [Reply] Network.Fetch
 * The result of the HTTP request.
 */
type NetworkFetchReply = {
  kind: "reply";
  type: "Network.Fetch";
  data: {
    /** HTTP status code (e.g., 200, 404). */
    status: number;
    
    /** Response headers. */
    headers: Record<string, string>;
    
    /** 
     * Response body. 
     * If >16KB, this will be a BlobPointer (RFC 0025).
     */
    body: string | BlobPointer;
  };
}
```

### Kernel Handler Behavior (Normative)

When processing a `Network.Fetch` command, the Kernel Event Handler **MUST**:

1.  **Scan Headers**: Iterate through all keys in `data.headers`.
2.  **Detect Sealed Values**: Identify values starting with the `pwenc:v1:` prefix.
3.  **Unseal In-Memory**: Decrypt these values using the Foundation Crypto (RFC 0016) *immediately* before transmission.
4.  **Substitute**: Replace the ciphertext with plaintext in the outbound HTTP request.
5.  **Execute**: Perform the network request.
6.  **Sanitize**: Ensure the plaintext is **NEVER** logged, stored, or included in the `Network.Fetch` reply message.

**Constraints**:
*   The handler **MUST NOT** modify the response body.
*   The handler **MUST NOT** attempt to encrypt the response (unless explicitly requested by a future feature).
*   If unsealing fails (invalid ciphertext), the handler **MUST** emit an `error` message (Code 422) and **MUST NOT** send the request.

## Client-Side Adaptation (sealedFetch)

To maintain compatibility with existing ecosystems (e.g., W3C Fetch), client libraries SHOULD provide an adapter that maps standard function calls to `Network.Fetch` messages.

### Adaptation Behavior

When adapting a standard fetch-like interface (accepting `input` and `init` arguments) to the Kernel:

1.  **Normalization**: Convert the `input` (URL/Request) and `init` (options) into a `Network.Fetch` command data.
2.  **Dispatch**: Emit the `Network.Fetch` command via the system message bus.
3.  **Rehydration**: Convert the `Network.Fetch` reply data back into the host environment's standard Response object.

**Note**: The *unsealing* of headers happens inside the **Kernel Event Handler** for `Network.Fetch`, not in the client-side helper. This ensures the plaintext never exists in the client's memory space, only in the ephemeral kernel process.

## Rationale

### Why `sealedFetch` instead of a Proxy?

Early designs (RFC 0017 v0.1) proposed a "Kernel Space" proxy that enforced allowlists and automatically encrypted response tokens. This proved too rigid:
1.  **SDK Friction**: Developers use SDKs (e.g., OpenAI, AWS), which manage their own networking. A proxy requires rewriting SDK internals. `sealedFetch` is just a function that can be passed as a custom `fetch` implementation.
2.  **Magic is Harmful**: Automatic response encryption creates "magic" behavior that reduces trust and compatibility. Explicit `Sealed` handling is predictable.

### Why W3C Fetch Compatibility?

By strictly adhering to the `fetch` signature, `sealedFetch` reduces cognitive load. Developers do not need to learn a new API; they just use the standard one they already know, with the added benefit of safe secret handling.

## Examples

This section is non-normative.

### Example 1: Use ciphertext string directly in Authorization

```ts
import { sealedFetch } from "pwo/net/sealedFetch";
import { memory } from "pwo/syscalls/memory";

const tokenPwenc = await memory.get("/vault/google/access_token");

const res = await sealedFetch("https://www.googleapis.com/drive/v3/files?pageSize=5", {
  headers: {
    Authorization: `Bearer ${tokenPwenc}`,
    Accept: "application/json",
  },
});

const data = await res.json();
```

### Example 2: Use `Sealed` (serializes to ciphertext)

```ts
import { sealedFetch } from "pwo/net/sealedFetch";
import { Sealed } from "pwo/sealed";

const sealed = Sealed.from("pwenc:v1:...");

await sealedFetch("https://api.example.com/me", {
  headers: {
    Authorization: `Bearer ${sealed}`,
  },
});
```

### Example 3: Invalid pwenc throws

```ts
import { sealedFetch } from "pwo/net/sealedFetch";

await sealedFetch("https://api.example.com/me", {
  headers: {
    Authorization: "Bearer pwenc:v1:THIS_IS_NOT_BASE64URL_JSON",
  },
});
// => throws (invalid pwenc)
```

### Example 4: Confine plaintext with `Sealed.use(fn)`

```ts
import { Sealed } from "pwo/sealed";

const sealed = Sealed.from("pwenc:v1:...");

await sealed.use(async (token) => {
  // plaintext exists only inside this callback
  await fetch("https://api.example.com/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
});
```

## References

### PromptWar̊e ØS References

* [RFC 0016: Crypto Primitives Specification](0016-security-crypto-primitives.md)
* [RFC 0018: Kernel Memory Subsystem](0018-kernel-memory-subsystem.md)

### External References

* [RFC 2119: Key words for use in RFCs](https://www.rfc-editor.org/rfc/rfc2119)
* [RFC 8174: Ambiguity of Uppercase vs Lowercase in RFC 2119 Key Words](https://www.rfc-editor.org/rfc/rfc8174)

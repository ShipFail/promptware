---
rfc: 0018
title: Memory Subsystem Specification
author: Huan Li, ChatGPT
status: Draft
type: Standards Track
created: 2025-12-23
updated: 2025-12-23
version: 0.1
tags: [memory, deno, kv, vault, pwenc]
---

# RFC 0018: Memory Subsystem Specification

## Abstract

PromptWar̊e ØS is booted and operated through prompts. The prompt kernel (pRing 0) is non-confidential by design; therefore, the memory subsystem MUST support storing and retrieving values in a way that avoids accidental disclosure of sensitive material into prompts and logs.

This RFC defines the PromptWar̊e ØS **memory syscall** API and semantics. It includes a system-reserved namespace, **`/vault/*`**, which enforces **sealed-at-rest** storage by accepting only ciphertext values (`pwenc:v1:...`) as defined by **RFC 0016**.

A key design principle is **minimum cognitive load**: the memory syscall provides both a CLI surface and a module surface, and their parameter model and behaviors MUST be identical.

## Status of This Memo

This document is a PromptWar̊e ØS RFC-style specification and may change at any time.

The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**, **SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **MAY**, and **OPTIONAL** are to be interpreted as described in BCP 14 (RFC 2119, RFC 8174).

## Terminology

* **Memory syscall**: A pRing 1 primitive providing key/value storage and retrieval.
* **Path**: A string key interpreted as a hierarchical pathname.
* **Vault path**: Any path beginning with `/vault/`.
* **Ciphertext**: A `pwenc:v1:...` string per RFC 0016.
* **Plaintext**: Any value not encoded as `pwenc:v1:...`.
* **CLI surface**: The command-line interface form invoked by agents/tools.
* **Module surface**: The importable function interface used by other syscalls or pRing 3 code.
* **Origin**: The security principal for State (KV), as defined in **RFC 0015 Section 4.3.1**. The origin determines the storage namespace for isolation.

## Design Goals

1. **Identical CLI and module semantics**: same parameters, same behavior.
2. **Simple mental model**: `set` stores exactly what it is given; `get` returns exactly what was stored.
3. **Sealed-at-rest in `/vault/*`**: vault paths MUST store ciphertext only.
4. **Prompt-safe defaults**: values returned by CLI MUST be safe to appear in pRing 0.
5. **Pragmatic portability**: implementable on macOS/Linux/Windows.
6. **Storage Isolation**: Different origins MUST have separate storage namespaces, preventing cross-tenant data access.

## Non-Goals

1. Preventing a fully privileged program from accessing plaintext after explicit decryption.
2. Enforcing sandboxing/deny-lists for syscalls (out of scope for v1).
3. Defining application-level account selection or credential management.
4. Specifying HOW the origin parameter is passed to the memory syscall (implementation-defined - see **RFC 0023** for syscall bridge details).

## Origin and Storage Isolation

The memory syscall enforces storage isolation based on the `origin` parameter. The normative specification for origin semantics is defined in **RFC 0015 Section 4.3.1**.

### Origin Requirements

* **Normative Specification**: See **RFC 0015 Section 4.3.1** for complete origin requirements:
  - Provision (MUST be provided to all stateful syscalls)
  - Normalization (URL format, name format, fallback rules)
  - Isolation (cross-origin access prevention)
  - Immutability (no user-space override)
  - Security (trusted source, no injection)

* **Passing Mechanism**: Implementation-defined - see **RFC 0023** (Syscall Bridge) for how origin flows through the syscall invocation path

* **Reference Implementation**: In Deno, the origin is set via the `--location` flag when invoking syscalls. The memory syscall uses `Deno.openKv()`, which automatically respects the location for storage isolation.

### Implementation Behavior

* **Purpose**: The origin defines the storage namespace, ensuring multi-tenant isolation
* **Behavior**: Key-value operations within the same origin share storage. Operations with different origins access separate storage namespaces
* **Transparency**: The memory syscall implementation does NOT need to parse or validate the origin directly. It relies on the runtime's location-based isolation (e.g., W3C-standard location API)

### Security Guarantees

As specified in **RFC 0015 Section 4.3.1**:
* Origin MUST originate from trusted bootloader configuration (**RFC 0014**)
* User-space code MUST NOT override the origin parameter
* Runtime MUST enforce storage isolation based on the provided origin

## Rings and Trust Model (context)

* pRing 0 is non-confidential; any stdout/stderr from tools may be incorporated into the LLM context.
* This RFC therefore treats **printing plaintext secrets** as a primary failure mode.
* The `/vault/*` namespace is designed to make ciphertext copy/pasteable while discouraging plaintext exposure.

## API Surface

### Operations

The memory syscall MUST provide at minimum:

* `get(path) -> value | null`
* `set(path, value) -> ok`
* `delete(path) -> ok` (OPTIONAL for v1, but RECOMMENDED)
* `list(prefix) -> paths[]` (OPTIONAL for v1)

### Value Model

For v1, values SHOULD be treated as opaque bytes or strings.

If an implementation supports structured values (e.g., JSON), that is an extension and MUST preserve the vault rules defined in this RFC.

## Path Semantics

### Normalization

* Paths MUST be absolute and MUST begin with `/`.
* Implementations SHOULD reject empty paths and paths containing `\0`.
* Implementations MAY normalize repeated slashes (e.g., `//a///b` -> `/a/b`), but MUST do so consistently.

### Reserved Namespaces

The following namespaces are system-reserved:

* `/vault/*`: sealed-at-rest storage (defined in this RFC)

Additional reserved namespaces MAY be defined by future RFCs.

## Vault Namespace: `/vault/*`

### Core Rule

For any path `P` where `P` begins with `/vault/`:

* `set(P, value)` MUST accept **only** ciphertext values whose string representation begins with `pwenc:v1:`.
* `set(P, plaintext)` MUST be rejected.
* `get(P)` MUST return exactly what was stored (ciphertext).

This applies identically to the CLI surface and the module surface.

### Rationale

* Ciphertext is safe to include in prompts/logs and safe to copy/paste.
* Rejecting plaintext prevents a common footgun: pasting a real token into a tool call, which would then enter pRing 0.

### Vault Does Not Decrypt

The memory syscall MUST NOT decrypt values stored under `/vault/*`.

Decryption and plaintext use are handled by cryptographic primitives (RFC 0016) and any higher-level helper abstractions (e.g., `Secret`) that run in code, not by the memory syscall.

## CLI Surface

### CLI Contract

The CLI surface MUST be a faithful adapter of the module surface. In particular:

* CLI argument structure MUST map directly to the same `get/set/delete/list` semantics.
* CLI `get` MUST print the stored value to stdout (or a well-defined serialization).
* CLI `set` MUST not echo the value.

### Vault CLI Behavior

* `memory set /vault/x <value>` MUST reject `<value>` unless it begins with `pwenc:v1:`.
* `memory get /vault/x` returns ciphertext and is safe to appear in pRing 0.

## Module Surface

### Module Contract

The module surface MUST expose functions equivalent to the operations defined above.

The module surface MUST enforce the same vault rule:

* `/vault/*` accepts ciphertext only
* `/vault/*` returns ciphertext only

### Notes on “Secret” Helpers

This RFC does not define a `Secret` type. However, implementations MAY provide a helper library where:

* `Secret` wraps ciphertext and serializes to ciphertext (string).
* plaintext is only available via explicit opt-in patterns such as `Secret.use(fn)`.

Such helpers MUST NOT change the behavior of `memory.get/set`.

## Backend Storage

### Reference Implementation Note

A common implementation is Deno KV.

* The memory syscall MAY use Deno KV or another key/value backend.
* Backend choice MUST NOT affect vault semantics.

### Persistence

Implementations MUST document whether memory persists across runs.

If persistence is provided, implementations SHOULD:

* store data under user-owned directories with restrictive permissions (where applicable)
* avoid logging or telemetry that includes stored values

## Error Handling

* If a vault `set` receives a plaintext value, the syscall MUST return an error.
* Errors MUST NOT include plaintext secret material.
* Implementations SHOULD use stable error codes or error names.

Recommended errors:

* `E_PATH_INVALID`
* `E_VAULT_REQUIRES_PWENC`
* `E_NOT_FOUND` (for `get` returning null MAY be preferred)

## Security Considerations

* `/vault/*` prevents accidental disclosure in prompts by rejecting plaintext writes.
* `/vault/*` does not prevent a program from decrypting ciphertext if it has access to the crypto primitive and the local signing capability.
* Developers SHOULD avoid printing decrypted values to stdout/stderr.

## Privacy Considerations

* Storing ciphertext in memory may still leak metadata (key names, access patterns). This is acceptable for v1.

## IANA Considerations

This document has no IANA actions.

## References

* RFC 0016: Crypto Primitives Specification
* RFC 2119, RFC 8174 (BCP 14 key words)

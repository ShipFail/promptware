---
rfc: 0018
title: State Memory Key-Value
author: Huan Li, ChatGPT
status: Draft
type: Standards Track
created: 2025-12-23
updated: 2026-01-01
version: 0.5
tags: [state, memory, keyvalue, vault, persistence]
---

# RFC 0018: State Memory Key-Value

## Abstract

PromptWar̊e ØS is booted and operated through prompts. The prompt kernel (pRing 0) is non-confidential by design; therefore, the memory subsystem MUST support storing and retrieving values in a way that avoids accidental disclosure of sensitive material into prompts and logs.

This RFC defines the PromptWar̊e ØS **memory syscall** API for key-value storage.

The Memory subsystem provides one reserved namespace with special validation:

* **`vault/*`**: Key-value storage with ciphertext enforcement (values MUST be `pwenc:v1:*`)

**URI Notation**: In specifications, Memory paths are written as `memory:///vault/token`. In API calls, the `memory:///` prefix is omitted: `Memory.Get("vault/token")`.

**Note**: System control (`sys/*`) and belief surfaces (`proc/*`) are defined in RFC 0013 (VFS) as `os:///sys/*` and `os:///proc/*` paths, not Memory namespaces.

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
3. **Ciphertext enforcement in `vault/*`**: vault paths MUST store ciphertext only (values MUST be `pwenc:v1:*`).
4. **Minimal restrictions**: Only `vault/*` and `os/*` are reserved; all other paths are unrestricted.
5. **Prompt-safe defaults**: values returned by CLI MUST be safe to appear in pRing 0.
6. **Pragmatic portability**: implementable on macOS/Linux/Windows.
7. **Storage Isolation**: Different origins MUST have separate storage namespaces, preventing cross-tenant data access.

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

### API Convention: Path Parameters

Memory syscall operations accept path parameters **without** the `memory:///` URI prefix.

**Rationale**: Since Memory syscall only operates on memory paths, the `memory:///` prefix is redundant in API calls and would increase token usage unnecessarily.

**Usage:**

```typescript
// ✅ Correct API usage
Memory.Get("vault/token")
Memory.Set("proc/cmdline", value)
Memory.List("sys/")

// ❌ Incorrect - don't include memory:/// prefix
Memory.Get("memory:///vault/token")
Memory.Set("memory:///proc/cmdline", value)
```

**Documentation convention**: This RFC uses full URIs (`memory:///path`) in specifications for clarity when discussing URI schemes. API examples omit the prefix.

## Path Semantics

### Normalization

* Paths MUST NOT be empty
* Paths MAY begin with `/` (leading slash is optional and will be normalized)
* Implementations MUST normalize paths by removing leading `/` if present
* Both `vault/token` and `/vault/token` refer to the same key
* Implementations SHOULD reject paths containing `\0`
* Implementations MAY normalize repeated slashes (e.g., `sys//agents` → `sys/agents`), but MUST do so consistently

**Examples:**
```typescript
// These are equivalent (both valid):
await Memory.Get("vault/token");
await Memory.Get("/vault/token");

// These are equivalent (both valid):
await Memory.Set("sys/agents/shell/status", "active");
await Memory.Set("/sys/agents/shell/status", "active");
```

**Normalization algorithm:**
```typescript
function normalizePath(path: string): string {
  // Remove leading slash if present
  return path.startsWith("/") ? path.slice(1) : path;
}
```

### Reserved Namespaces

The following namespaces are system-reserved:

* **`vault/*`**: Key-value storage with ciphertext validation (values MUST be `pwenc:v1:*`)
* **`os/*`**: OS-reserved internal storage (kernel state, configuration)

**All other paths** are available for general use without restrictions.

**URI notation**: When referring to Memory paths in specifications:
- Full URI: `memory:///vault/token`
- API form: `vault/token` (omit `memory:///` prefix)
- NOT: `/vault/token` (leading slash is optional, will be normalized)

Correct examples:
- ✅ `memory:///vault/token` (specification)
- ✅ `vault/token` (API)
- ✅ `/vault/token` (API - will be normalized to `vault/token`)
- ❌ `memory:///vault/token` (in API calls - don't include prefix)

**Historical note**: In versions prior to v0.5, `sys/*` and `proc/*` were Memory namespaces. They have been moved to VFS as `os:///sys/*` and `os:///proc/*` (see RFC 0013 Section 4.7).

## Vault Namespace: `vault/*`

### Core Rule

For any path `P` where `P` begins with `vault/` (after normalization):

* `Memory.Set(P, value)` MUST accept **only** ciphertext values whose string representation begins with `pwenc:v1:`.
* `Memory.Set(P, plaintext)` MUST be rejected.
* `Memory.Get(P)` MUST return exactly what was stored (ciphertext).

This applies identically to the CLI surface and the module surface.

### Rationale

* Ciphertext is safe to include in prompts/logs and safe to copy/paste.
* Rejecting plaintext prevents a common footgun: pasting a real token into a tool call, which would then enter pRing 0.

### Vault Does Not Decrypt

The memory syscall MUST NOT decrypt values stored under `vault/*`.

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

### Notes on "Secret" Helpers

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

### Error Code References

Memory operations reference the following error codes (defined in RFC-24 Error Registry):

| Error Code | HTTP Number | Condition | Recovery |
|------------|-------------|-----------|----------|
| `BAD_REQUEST` | 400 | Path is malformed or empty | Check path format |
| `NOT_FOUND` | 404 | Path does not exist | Check key name |
| `UNPROCESSABLE_ENTITY` | 422 | `vault/*` requires `pwenc:v1:*` ciphertext | Fix value format |
| `INTERNAL_SERVER_ERROR` | 500 | Memory backend failure | Check backend health |

See RFC-24 for complete error code definitions and response format.

### Validation Order

When processing a `Memory.Set` operation, validation occurs in this order:

1. **Path validation**: Check path is valid (not empty, normalize leading slash)
2. **Namespace-specific validation**:
   - If `vault/*`: Check value is `pwenc:v1:*`
   - If `os/*`: Internal OS storage (no special restrictions)
   - Otherwise: No restrictions
3. **General validation**: Check value size limits, encoding, etc.

### Error Examples

```typescript
// Vault enforcement
await Memory.Set("vault/token", "plaintext");
// → Throws UNPROCESSABLE_ENTITY (422)
// details: { reason: "vault/* requires pwenc:v1:* ciphertext" }

// Path validation (leading slash is normalized, not an error)
await Memory.Set("/vault/token", "pwenc:v1:..."); // ✅ Works (normalized to vault/token)
await Memory.Set("vault/token", "pwenc:v1:...");  // ✅ Works (same key)

// General storage (unrestricted)
await Memory.Set("myapp/config", JSON.stringify({theme: "dark"})); // ✅ Works
await Memory.Set("cache/data", "multi\nline\nvalue"); // ✅ Works (no restrictions)
```

**Important**: Errors MUST NOT include plaintext secret material in error messages or details.

## Examples (Non-Normative)

### Memory Integration with Kernel Initialization

For complete kernel boot sequence including Memory initialization, see **RFC 0015 Section 9**.

The Memory-specific initialization steps are:

```typescript
// 1. Initialize Memory subsystem
await Memory.initialize();

// 2. Make cmdline accessible (implementation-defined storage)
await Memory.Set("os/kernel/boot-params", JSON.stringify(bootParams));
VFS.registerProc("cmdline", async () => {
  return await Memory.Get("os/kernel/boot-params");
});
```

**See RFC 0015 Section 9 for the complete kernel initialization sequence.**

### Example 1: Memory Path Operations

```typescript
// Memory API: Always omit memory:/// prefix

// Store application configuration (unrestricted)
await Memory.Set("myapp/config", JSON.stringify({
  theme: "dark"
}));

// Store secret in vault namespace (ciphertext enforcement)
await Memory.Set("vault/google/token", "pwenc:v1:..."); // ✅

await Memory.Set("vault/google/token", "secret123");
// ❌ Throws UNPROCESSABLE_ENTITY (422)

// Store multi-line data (allowed, no restrictions)
await Memory.Set("cache/results", "line1\nline2\nline3");
```

### Example 2: Incorrect Memory Usage (Anti-Patterns)

```typescript
// ❌ WRONG: Using Read tool on Memory path
await Read("memory:///vault/token");
// → Error: Read is for file://, not memory:///

// ❌ WRONG: Using Memory on VFS path
await Memory.Get("os:///promptware/agents/shell.md");
// → Error: VFS paths not valid for Memory

// ❌ WRONG: Including memory:/// prefix in Memory API calls
await Memory.Set("memory:///vault/token", "pwenc:v1:...");
// → Error: Don't include memory:/// prefix in API

// ❌ WRONG: Accessing sys/proc via Memory (use VFS instead)
await Memory.Get("sys/agents/shell/status");
// → Use VFS.read("os:///sys/agents/shell/status") instead

await Memory.Get("proc/cmdline");
// → Use VFS.read("os:///proc/cmdline") instead

// ✅ CORRECT: Each scheme has its own operations
await Memory.Get("myapp/config");                          // Memory → get (no prefix)
await VFS.read("os:///sys/agents/shell/status");           // VFS sys → read/write
await VFS.read("os:///proc/cmdline");                      // VFS proc → read
await pwosIngest("os:///ship-fail-crew/agents/shell.md");  // VFS code → ingest
await Read("file:///workspaces/project/src/index.ts");     // file:// → read/write
```

### Example 3: Multi-Namespace Usage

```typescript
// Vault: Store encrypted secrets
await Memory.Set("vault/api/github/token", "pwenc:v1:abc123...");
await Memory.Set("vault/db/password", "pwenc:v1:def456...");

// Application data: Unrestricted storage
await Memory.Set("myapp/notes", "Today's tasks:\n- Task 1\n- Task 2");
await Memory.Set("cache/results", JSON.stringify(largeObject));
await Memory.Set("session/user-123", sessionData);

// OS internal: Kernel state
await Memory.Set("os/kernel/boot-params", JSON.stringify(params));
```

## Security Considerations

* `/vault/*` prevents accidental disclosure in prompts by rejecting plaintext writes.
* `/vault/*` does not prevent a program from decrypting ciphertext if it has access to the crypto primitive and the local signing capability.
* Developers SHOULD avoid printing decrypted values to stdout/stderr.

## Privacy Considerations

* Storing ciphertext in memory may still leak metadata (key names, access patterns). This is acceptable for v1.

## IANA Considerations

This document has no IANA actions.

## References

### PromptWar̊e ØS References

* RFC 0013: Kernel VFS Specification (code addressing, mounts)
* RFC 0015: Kernel Dualmode Architecture (URI scheme taxonomy, origin specification)
* RFC 0016: Crypto Primitives Specification (pwenc ciphertext)
* RFC 0024: CQRS Event Schema (error code registry)

### External References

* RFC 2119, RFC 8174 (BCP 14 key words)

---

*End of RFC 0018*

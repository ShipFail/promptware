---
rfc: 0018
title: State Memory Key-Value
author: Huan Li, ChatGPT
status: Draft
type: Standards Track
created: 2025-12-23
updated: 2026-01-01
version: 0.4
tags: [state, memory, keyvalue, vault, persistence]
---

# RFC 0018: State Memory Key-Value

## Abstract

PromptWar̊e ØS is booted and operated through prompts. The prompt kernel (pRing 0) is non-confidential by design; therefore, the memory subsystem MUST support storing and retrieving values in a way that avoids accidental disclosure of sensitive material into prompts and logs.

This RFC defines the PromptWar̊e ØS **memory syscall** API and semantics. It includes three system-reserved namespaces:

* **`vault/*`**: Sealed-at-rest storage (ciphertext-only, per RFC 0016)
* **`sys/*`**: System control plane (writable, single-value attributes)
* **`proc/*`**: System belief surface (read-only, rich introspection views)

**URI Notation**: In specifications, Memory paths are written as `memory:///vault/token`. In API calls, the `memory:///` prefix is omitted: `Memory.Get("vault/token")`.

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

* **`vault/*`**: Sealed-at-rest storage (ciphertext-only)
* **`sys/*`**: System control plane (writable, single-value attributes)
* **`proc/*`**: System belief surface (read-only, rich views)
* **`os/*`**: OS-reserved internal storage (kernel, daemon state)
* **`user/*`**: User-space application data (unrestricted)

**URI notation**: When referring to Memory paths in specifications:
- Full URI: `memory:///vault/token`
- API form: `vault/token` (omit `memory:///` prefix)
- NOT: `/vault/token` (leading slash is optional, will be normalized)

Correct examples:
- ✅ `memory:///vault/token` (specification)
- ✅ `vault/token` (API)
- ✅ `/vault/token` (API - will be normalized to `vault/token`)
- ❌ `memory:///vault/token` (in API calls - don't include prefix)

Additional reserved namespaces MAY be defined by future RFCs.

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

## System Control Plane Namespace: `sys/*`

### Core Rule

For any path `P` where `P` begins with `sys/` (after normalization):

* `Memory.Set(P, value)` is allowed
* `Memory.Get(P)` is allowed
* `value` SHOULD be a single-value attribute (see below)

### Single-Value Attribute Semantics

A "single-value attribute" means the value MUST NOT contain newline characters (`\n`).

**Rationale**: This ensures each attribute represents exactly one semantic value, not multiple lines of data. This pattern is adopted from Linux sysfs for clarity and tooling simplicity.

**Examples**:
```typescript
// ✅ Correct: single value, no newlines
await Memory.Set("sys/agents/shell/status", "active");

// ❌ Incorrect: multi-line value
await Memory.Set("sys/agents/shell/status", "active\nstarted at 10:00");
// → Throws UNPROCESSABLE_ENTITY (422)

// ✅ Correct: structured single value (JSON on one line, no newlines)
await Memory.Set("sys/agents/shell/config", '{"theme":"dark","debug":true}');
```

**Note on terminology**: The term "newline-terminated" comes from Unix sysfs where attribute files are terminated by `\n`. In PromptWareOS Memory (a KV store), we enforce the constraint directly: values MUST NOT contain newlines. The newline is treated as a **separator** in file-based systems, not part of the value itself.

### Example Paths

**Canonical sys/* paths**:

```
sys/agents/{agent-id}/status
sys/agents/{agent-id}/lifecycle/desired_state
sys/agents/{agent-id}/skills/{skill-id}/enabled
sys/system/debug_mode
```

### CLI Examples

```bash
# Set agent status
memory set sys/agents/shell/status "active"

# Get agent status
memory get sys/agents/shell/status
# Output: active

# Toggle debug mode
memory set sys/system/debug_mode "1"
```

### Relationship to UNIX sysfs

* Inspired by Linux `/sys` (control plane attributes)
* Implements "single-value per attribute" pattern
* Unlike Linux, implemented as Memory namespace (not kernel filesystem)

## System Belief Surface Namespace: `proc/*`

### Core Rule

For any path `P` where `P` begins with `proc/` (after normalization):

* `Memory.Set(P, value)` MUST be rejected with error `FORBIDDEN` (403)
* `Memory.Get(P)` is allowed
* Values MAY be multi-line, rich formatted, human-readable
* Values MAY be dynamically generated (not pre-stored)

**No exceptions**: ALL `proc/*` paths are strictly read-only, including `proc/cmdline`.

### Rationale

The `proc/*` namespace is a **belief surface**: it reflects what the system believes about its state, not authoritative control. Key properties:

* **Read-only**: Prevents corruption of system state
* **Rich format**: Human-readable narratives, not just single values
* **Dynamic**: Can be generated on-demand (like Linux `/proc/cpuinfo`)
* **Viewpoint-relative**: May differ based on context (agent, origin)

### Example Paths

**Canonical proc/* paths**:

```
proc/cmdline                    # Kernel boot parameters
proc/system/summary             # System overview
proc/agents/{agent-id}/status   # Agent status view
proc/agents/{agent-id}/skills   # List of agent skills
```

### Dynamic Generation

**Concept**: `proc/*` values MAY be generated on-demand rather than pre-stored.

**Implementation** (non-normative example):

```typescript
// Register dynamic proc/* handler
Memory.registerDynamic("proc/system/summary", async () => {
  return `PromptWareOS v1.0
Uptime: ${getUptime()}
Agents: ${getAgentCount()}
Memory usage: ${getMemoryUsage()}`;
});

// Reading triggers handler
const summary = await Memory.Get("proc/system/summary");
// Handler executes, returns generated value
```

**Requirements for dynamic handlers**:

* Handlers MUST be deterministic OR include cache-busting metadata (timestamp)
* Handlers MUST NOT have side effects (reading `proc/*` should be safe)
* Handlers MAY cache results for performance

### Storage Implementation

How `proc/*` values are stored is implementation-defined.

**Example: proc/cmdline** (non-normative):

```typescript
// Option 1: Store in separate namespace
await Memory.Set("os/kernel/boot-params", JSON.stringify(cmdline));
Memory.registerDynamic("proc/cmdline", async () => {
  return await Memory.Get("os/kernel/boot-params");
});

// Option 2: Store in file
await Deno.writeTextFile("/tmp/pwos-cmdline.json", JSON.stringify(cmdline));
Memory.registerDynamic("proc/cmdline", async () => {
  return await Deno.readTextFile("/tmp/pwos-cmdline.json");
});

// Option 3: Keep in-memory only (ephemeral)
let cmdlineCache = JSON.stringify(cmdline);
Memory.registerDynamic("proc/cmdline", async () => cmdlineCache);
```

**Specification requirement**: Implementations MUST make `proc/*` values accessible via `Memory.Get()`, but HOW they are stored is left to implementation.

### CLI Examples

```bash
# Read kernel cmdline
memory get proc/cmdline
# Output: {"root":"https://...","origin":"my-os",...}

# Read system summary (multi-line)
memory get proc/system/summary
# Output:
# PromptWareOS v1.0
# Uptime: 3h 42m
# Agents: 2 active
# Memory: 42MB

# Attempt to write (fails)
memory set proc/system/summary "hacked"
# Error: FORBIDDEN (403)
```

### Relationship to UNIX procfs

* Inspired by Linux `/proc` (read-only system introspection)
* Unlike Linux, `proc/*` is explicitly a "belief surface" (what the system believes)
* Implemented as Memory namespace with dynamic generation capability

## User Namespace: `user/*`

### Core Rule

For any path `P` where `P` begins with `user/` (after normalization):

* `Memory.Set(P, value)` is allowed (no restrictions)
* `Memory.Get(P)` is allowed
* No format enforcement
* No ciphertext requirement

### Rationale

The `user/*` namespace is unrestricted storage for user-space applications. Unlike `vault/*` which enforces ciphertext, or `sys/*` which enforces single-value, `user/*` has no constraints.

### Example Paths

```
user/myapp/config
user/myapp/preferences
user/myapp/cache/data
```

### Examples

```typescript
// Store application configuration
await Memory.Set("user/myapp/config", JSON.stringify({
  theme: "dark",
  fontSize: 14
}));

// Store multi-line data (allowed in user/*)
await Memory.Set("user/myapp/notes", "Line 1\nLine 2\nLine 3");

// Retrieve data
const config = await Memory.Get("user/myapp/config");
const notes = await Memory.Get("user/myapp/notes");
```

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
| `FORBIDDEN` | 403 | Attempt to write to `proc/*` path | Use `sys/*` for writable state |
| `NOT_FOUND` | 404 | Path does not exist | Check key name |
| `UNPROCESSABLE_ENTITY` | 422 | `vault/*` requires `pwenc:v1:*` OR `sys/*` contains newlines | Fix value format |
| `INTERNAL_SERVER_ERROR` | 500 | Memory backend failure | Check backend health |

See RFC-24 for complete error code definitions and response format.

### Validation Order

When processing a `Memory.Set` operation, validation occurs in this order:

1. **Path validation**: Check path is valid (not empty, normalize leading slash)
2. **Namespace-specific validation**:
   - If `vault/*`: Check value is `pwenc:v1:*`
   - If `proc/*`: Reject write (403)
   - If `sys/*`: Check value has no newlines (if enforced)
3. **General validation**: Check value size limits, encoding, etc.

### Error Examples

```typescript
// Vault enforcement
await Memory.Set("vault/token", "plaintext");
// → Throws UNPROCESSABLE_ENTITY (422)
// details: { reason: "vault/* requires pwenc:v1:* ciphertext" }

// Proc read-only
await Memory.Set("proc/summary", "data");
// → Throws FORBIDDEN (403)
// details: { reason: "proc/* paths are read-only" }

// Sys single-value enforcement
await Memory.Set("sys/agents/shell/status", "line1\nline2");
// → Throws UNPROCESSABLE_ENTITY (422)
// details: { reason: "sys/* values must not contain newlines" }

// Path validation (leading slash is normalized, not an error)
await Memory.Set("/vault/token", "pwenc:v1:..."); // ✅ Works (normalized to vault/token)
await Memory.Set("vault/token", "pwenc:v1:...");  // ✅ Works (same key)
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
Memory.registerDynamic("proc/cmdline", async () => {
  return await Memory.Get("os/kernel/boot-params");
});
```

**See RFC 0015 Section 9 for the complete kernel initialization sequence.**

### Example 1: Memory Path Operations

```typescript
// Memory API: Always omit memory:/// prefix

// Store configuration in user namespace
await Memory.Set("user/myapp/config", JSON.stringify({
  theme: "dark"
}));

// Store secret in vault namespace (ciphertext enforcement)
await Memory.Set("vault/google/token", "pwenc:v1:..."); // ✅

await Memory.Set("vault/google/token", "secret123");
// ❌ Throws UNPROCESSABLE_ENTITY (422)

// Write to sys namespace (control plane)
await Memory.Set("sys/agents/shell/status", "active");

// Read from proc namespace (belief surface)
const summary = await Memory.Get("proc/system/summary");
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

// ✅ CORRECT: Each scheme has its own operations
await Memory.Get("user/config");                           // Memory → get (no prefix)
await pwosIngest("os:///ship-fail-crew/agents/shell.md");  // VFS → ingest
await Read("file:///workspaces/project/src/index.ts");     // file:// → read/write
```

### Example 3: Multi-Namespace Usage

```typescript
// Vault: Store encrypted secrets
await Memory.Set("vault/api/github/token", "pwenc:v1:abc123...");
await Memory.Set("vault/db/password", "pwenc:v1:def456...");

// Sys: Control plane attributes (single-value only)
await Memory.Set("sys/agents/shell/status", "active");
await Memory.Set("sys/agents/bridge/enabled", "true");

// User: Application data (unrestricted)
await Memory.Set("user/notes/daily", "Today's tasks:\n- Task 1\n- Task 2");
await Memory.Set("user/cache/results", JSON.stringify(largeObject));

// Proc: Read-only system introspection
const uptime = await Memory.Get("proc/system/uptime");
const agentList = await Memory.Get("proc/agents/list");
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

---
rfc: 0018
title: Memory VFS Driver Specification
author: Huan Li, ChatGPT
status: Draft
type: Standards Track
created: 2025-12-23
updated: 2026-01-01
version: 0.6
tags: [vfs, driver, memory, keyvalue, vault, persistence]
---

# RFC 0018: Memory VFS Driver Specification

## Abstract

This RFC defines the **Memory VFS Driver** for PromptWare OS: a key-value storage driver that implements the VFSDriver interface (RFC-26) to provide persistent storage under the `os:///memory/*` namespace.

The Memory driver provides:
- **Vault namespace** (`os:///memory/vault/*`): Ciphertext-only storage with `pwenc:v1:*` enforcement
- **General storage** (`os:///memory/*`): Unrestricted key-value storage
- **Origin isolation**: Multi-tenant storage separation
- **Persistence**: Durable storage across system restarts

**Key Architectural Change from v0.5**:
- **v0.5**: Memory was a separate subsystem with `memory:///` URI scheme and `Memory.get/set` API
- **v0.6**: Memory is a VFS driver under `os:///memory/*` namespace accessed via `VFS.read/write`

The Memory driver is **domain-agnostic** - it enforces vault ciphertext requirements but remains a general-purpose KV store.

## Status of This Memo

This document is a PromptWare OS RFC-style specification and may change at any time.

The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**, **SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **MAY**, and **OPTIONAL** are to be interpreted as described in BCP 14 (RFC 2119, RFC 8174).

## Terminology

* **Memory Driver**: A VFS driver implementing RFC-26 interface, handling `os:///memory/*` paths
* **Vault**: The `vault/*` namespace within Memory driver requiring ciphertext storage
* **Ciphertext**: A `pwenc:v1:...` string per RFC 0016
* **Plaintext**: Any value not encoded as `pwenc:v1:...`
* **Origin**: The security principal for storage isolation, as defined in RFC 0015 Section 4.3.1
* **Backend**: The underlying key-value storage mechanism (e.g., Deno KV)

## Design Goals

1. **VFSDriver compliance**: Implement RFC-26 interface fully
2. **Ciphertext enforcement**: Vault paths MUST store ciphertext only (values MUST be `pwenc:v1:*`)
3. **Minimal restrictions**: Only `vault/*` has special validation; all other paths are unrestricted
4. **Prompt-safe defaults**: Vault values are safe to appear in pRing 0 (LLM context)
5. **Origin isolation**: Different origins MUST have separate storage namespaces
6. **Simple semantics**: Set stores exactly what it's given; get returns exactly what was stored
7. **Pragmatic portability**: Implementable on macOS/Linux/Windows using standard KV backends

### Non-Goals

1. Preventing privileged programs from accessing plaintext after explicit decryption
2. Enforcing sandboxing or access control (out of scope for v1)
3. Defining application-level credential management
4. Specifying HOW origin parameter flows through syscalls (see RFC 0023)

## Driver Implementation

### 4.1. VFSDriver Interface Compliance

```typescript
class MemoryDriver implements VFSDriver {
  readonly name = "memory";

  readonly permissions = {
    readable: true,
    writable: true,
    executable: false
  };

  /**
   * Validation hook: Enforce vault ciphertext requirement
   */
  validate(operation: string, path: string, value?: string): void {
    if (operation === "write" && path.startsWith("vault/")) {
      if (!value || !value.startsWith("pwenc:v1:")) {
        throw new Error(
          "UNPROCESSABLE_ENTITY (422): vault/* requires pwenc:v1:* ciphertext"
        );
      }
    }
  }

  /**
   * Read a value from Memory storage
   */
  async read(path: string): Promise<string> {
    const value = await this.backend.get(path);
    if (value === null) {
      throw new Error("NOT_FOUND (404): Path does not exist");
    }
    return value;
  }

  /**
   * Write a value to Memory storage
   */
  async write(path: string, value: string): Promise<void> {
    await this.backend.set(path, value);
  }

  /**
   * List keys under a path prefix
   */
  async list(prefix: string): Promise<string[]> {
    const entries = await this.backend.list({ prefix });
    return entries.map(e => e.key);
  }

  /**
   * Delete a value from Memory storage
   */
  async delete(path: string): Promise<void> {
    const exists = await this.backend.get(path);
    if (exists === null) {
      throw new Error("NOT_FOUND (404): Path does not exist");
    }
    await this.backend.delete(path);
  }
}
```

**Key points**:
- **Path format**: Driver receives paths WITHOUT `os:///memory/` prefix (e.g., `vault/token`, not `os:///memory/vault/token`)
- **Validation**: `validate()` hook enforces vault ciphertext requirement BEFORE write
- **No decryption**: Driver stores/returns ciphertext as-is; decryption handled elsewhere (RFC 0016)

### 4.2. Path Semantics

**Path normalization** (inherited from VFS Core):
- VFS Core strips `os:///memory/` prefix before calling driver
- Driver operates on relative paths within its namespace
- Leading slashes are normalized by VFS Core

**Example**:
```typescript
// User calls
await VFS.write("os:///memory/vault/token", "pwenc:v1:...");

// VFS Core routing
// 1. Strip os:/// → "memory/vault/token"
// 2. Match "memory/" prefix → route to Memory Driver
// 3. Strip "memory/" → "vault/token"

// Memory Driver receives
path = "vault/token"  // Relative to memory namespace
value = "pwenc:v1:..."
```

### 4.3. Reserved Namespaces

The Memory driver recognizes these namespace prefixes:

* **`vault/*`**: Ciphertext-only storage (values MUST be `pwenc:v1:*`)
* **`os/*`**: OS-reserved internal storage (kernel state, configuration)

**All other paths** are available for general use without restrictions.

**URI notation examples**:
```
Full URI (specification):  os:///memory/vault/token
VFS API call:              VFS.read("os:///memory/vault/token")
Memory driver receives:    path = "vault/token"
```

## Vault Namespace: `vault/*`

### 5.1. Core Rule

For any path `P` where `P` begins with `vault/`:

* **Write validation**: `validate()` hook MUST reject values that don't start with `pwenc:v1:`
* **Read behavior**: Returns ciphertext exactly as stored
* **No decryption**: Driver MUST NOT decrypt vault values

**Rationale**:
- Ciphertext is safe to include in prompts/logs and safe to copy/paste
- Rejecting plaintext prevents footgun: pasting real token into prompt (pRing 0)

### 5.2. Validation Hook Implementation

```typescript
validate(operation: string, path: string, value?: string): void {
  // Vault enforcement
  if (operation === "write" && path.startsWith("vault/")) {
    if (!value || !value.startsWith("pwenc:v1:")) {
      throw new Error(
        "UNPROCESSABLE_ENTITY (422): vault/* requires pwenc:v1:* ciphertext"
      );
    }
  }
}
```

**VFS Core calls validate() BEFORE calling write()**:
```
VFS.write("os:///memory/vault/token", "plaintext")
  → Memory.validate("write", "vault/token", "plaintext")
  → Throws UNPROCESSABLE_ENTITY (422) ❌
  → write() never called
```

### 5.3. Vault Does Not Decrypt

The Memory driver MUST NOT decrypt values stored under `vault/*`.

Decryption and plaintext use are handled by:
- Cryptographic primitives (RFC 0016)
- Higher-level helper abstractions (e.g., `Secret` type - not defined in this RFC)

## Origin and Storage Isolation

The Memory driver enforces storage isolation based on the `origin` parameter.

### 6.1. Origin Requirements

* **Normative Specification**: See **RFC 0015 Section 4.3.1** for complete origin requirements:
  - Provision (MUST be provided to all stateful syscalls)
  - Normalization (URL format, name format, fallback rules)
  - Isolation (cross-origin access prevention)
  - Immutability (no user-space override)
  - Security (trusted source, no injection)

* **Passing Mechanism**: Implementation-defined - see **RFC 0023** (Syscall Bridge) for how origin flows through syscall invocation

* **Reference Implementation**: In Deno, origin is set via `--location` flag. Memory driver uses `Deno.openKv()`, which automatically respects location for storage isolation

### 6.2. Implementation Behavior

* **Purpose**: Origin defines the storage namespace, ensuring multi-tenant isolation
* **Behavior**: KV operations within same origin share storage. Operations with different origins access separate storage namespaces
* **Transparency**: Memory driver does NOT parse or validate origin directly. It relies on runtime's location-based isolation (e.g., W3C-standard location API)

### 6.3. Security Guarantees

As specified in **RFC 0015 Section 4.3.1**:
* Origin MUST originate from trusted bootloader configuration (RFC 0014)
* User-space code MUST NOT override origin parameter
* Runtime MUST enforce storage isolation based on provided origin

## Backend Storage

### 7.1. Backend Interface (Implementation-Defined)

The Memory driver backend is **implementation-defined**. Common implementations:

**Deno KV** (reference implementation):
```typescript
class MemoryDriver {
  private kv: Deno.Kv;

  async initialize() {
    this.kv = await Deno.openKv();  // Respects --location for isolation
  }

  async read(path: string): Promise<string> {
    const entry = await this.kv.get([path]);
    if (entry.value === null) throw new Error("NOT_FOUND (404)");
    return entry.value as string;
  }

  async write(path: string, value: string): Promise<void> {
    await this.kv.set([path], value);
  }

  async list(prefix: string): Promise<string[]> {
    const entries = [];
    for await (const entry of this.kv.list({ prefix: [prefix] })) {
      entries.push(entry.key.join("/"));
    }
    return entries;
  }

  async delete(path: string): Promise<void> {
    await this.kv.delete([path]);
  }
}
```

**Alternative backends**:
- SQLite database
- File-based storage (JSON files)
- In-memory Map (ephemeral, testing only)
- Redis or other KV stores

### 7.2. Persistence

Implementations MUST document whether Memory persists across runs.

If persistence is provided, implementations SHOULD:
- Store data under user-owned directories with restrictive permissions (where applicable)
- Avoid logging or telemetry that includes stored values
- Support atomic operations to prevent partial writes

## Error Handling

### 8.1. Error Code References

Memory driver operations reference the following error codes (defined in RFC-24):

| Error Code | HTTP | Condition | Recovery |
|------------|------|-----------|----------|
| `BAD_REQUEST` | 400 | Path is malformed or empty | Check path format |
| `NOT_FOUND` | 404 | Path does not exist | Check key name |
| `UNPROCESSABLE_ENTITY` | 422 | `vault/*` requires `pwenc:v1:*` ciphertext | Fix value format |
| `INTERNAL_SERVER_ERROR` | 500 | Backend failure | Check backend health |

### 8.2. Validation Order

When processing a write operation, validation occurs in this order:

1. **VFS Core validation**: Check path scheme (`os:///`), route to driver
2. **VFS Core capability check**: Ensure driver is writable
3. **Driver validation hook**: `MemoryDriver.validate("write", path, value)`
   - If `vault/*`: Check value is `pwenc:v1:*`
   - If `os/*`: No special restrictions (internal OS storage)
   - Otherwise: No restrictions
4. **Driver operation**: `MemoryDriver.write(path, value)`
5. **Backend operation**: `backend.set(path, value)`

### 8.3. Error Examples

```typescript
// Vault enforcement (validation hook failure)
await VFS.write("os:///memory/vault/token", "plaintext");
// → Memory.validate() throws UNPROCESSABLE_ENTITY (422)
// details: { reason: "vault/* requires pwenc:v1:* ciphertext" }

// Path not found (driver operation failure)
await VFS.read("os:///memory/nonexistent");
// → Memory.read() throws NOT_FOUND (404)

// General storage (unrestricted)
await VFS.write("os:///memory/myapp/config", JSON.stringify({theme: "dark"}));
// ✅ Works - no validation restrictions for non-vault paths

await VFS.write("os:///memory/cache/data", "multi\nline\nvalue");
// ✅ Works - newlines allowed in non-vault paths
```

**Important**: Errors MUST NOT include plaintext secret material in error messages or details.

## Examples (Non-Normative)

### Example 1: Vault Storage (Ciphertext Enforcement)

```typescript
// Store encrypted token in vault (correct)
await VFS.write("os:///memory/vault/google/token", "pwenc:v1:abc123...");
// ✅ Validation passes → stored

// Read encrypted token (returns ciphertext)
const cipher = await VFS.read("os:///memory/vault/google/token");
// Returns: "pwenc:v1:abc123..."

// Attempt to store plaintext in vault (incorrect)
await VFS.write("os:///memory/vault/google/token", "secret123");
// ❌ Memory.validate() throws UNPROCESSABLE_ENTITY (422)
// Error: "vault/* requires pwenc:v1:* ciphertext"
```

### Example 2: General Storage (Unrestricted)

```typescript
// Store application configuration
await VFS.write("os:///memory/myapp/config", JSON.stringify({
  theme: "dark",
  fontSize: 14
}));

// Store multi-line data (allowed)
await VFS.write("os:///memory/cache/results", "line1\nline2\nline3");

// Store session data
await VFS.write("os:///memory/session/user-123", JSON.stringify({
  authenticated: true,
  role: "admin"
}));

// All valid - no restrictions for non-vault paths
```

### Example 3: OS Internal Storage

```typescript
// Kernel stores boot parameters (internal use)
await VFS.write("os:///memory/os/kernel/boot-params", JSON.stringify({
  root: "https://github.com/.../os/",
  origin: "my-os"
}));

// OS internal paths have no special restrictions
// but SHOULD be used only by kernel/system code
```

### Example 4: List and Delete Operations

```typescript
// List all vault keys
const vaultKeys = await VFS.list("os:///memory/vault/");
// Returns: ["vault/google/token", "vault/github/token", "vault/db/password"]

// Delete a vault key
await VFS.delete("os:///memory/vault/old-token");
// ✅ Deleted

// Attempt to delete non-existent key
await VFS.delete("os:///memory/vault/nonexistent");
// ❌ Throws NOT_FOUND (404)
```

### Example 5: Migration from v0.5 API

```typescript
// v0.5 API (Memory subsystem)
await Memory.get("vault/token");
await Memory.set("vault/token", "pwenc:v1:...");
await Memory.list("vault/");
await Memory.delete("vault/old-token");

// v0.6 API (Memory VFS Driver)
await VFS.read("os:///memory/vault/token");
await VFS.write("os:///memory/vault/token", "pwenc:v1:...");
await VFS.list("os:///memory/vault/");
await VFS.delete("os:///memory/vault/old-token");

// Semantics are identical, only API surface changed
```

### Example 6: Incorrect Usage (Anti-Patterns)

```typescript
// ❌ WRONG: Using old memory:/// scheme
await VFS.read("memory:///vault/token");
// → Error: Use os:///memory/* paths

// ❌ WRONG: Using Read tool on Memory path
await Read("os:///memory/vault/token");
// → Should use VFS.read() instead

// ❌ WRONG: Using Memory driver for code
await VFS.ingest("os:///memory/agent-code");
// → BAD_REQUEST (400): Memory driver not executable

// ✅ CORRECT: Proper VFS usage
await VFS.read("os:///memory/vault/token");           // Memory KV read
await VFS.write("os:///memory/myapp/config", data);   // Memory KV write
await VFS.ingest("os:///agents/shell.md");            // Code ingest (Code driver)
```

## Integration with VFS Core

### 10.1. Registration

The Memory driver is registered with VFS Core at boot time:

```typescript
// VFS Core initialization (non-normative)
const memoryDriver = new MemoryDriver();
await memoryDriver.initialize();

vfs.registerDriver("memory/", memoryDriver);
```

### 10.2. Path Routing

VFS Core routes `os:///memory/*` paths to Memory driver:

```
User calls: VFS.write("os:///memory/vault/token", "pwenc:v1:...")
    │
    ▼
VFS Core strips os:/// → "memory/vault/token"
    │
    ▼
VFS Core matches "memory/" prefix → route to Memory Driver
    │
    ▼
VFS Core strips "memory/" → "vault/token"
    │
    ▼
VFS Core checks permissions.writable → ✅ true
    │
    ▼
VFS Core calls Memory.validate("write", "vault/token", "pwenc:v1:...")
    │
    ▼
Memory.validate checks vault/* prefix → ✅ ciphertext valid
    │
    ▼
VFS Core calls Memory.write("vault/token", "pwenc:v1:...")
    │
    ▼
Memory driver stores in backend KV
```

### 10.3. Kernel Initialization

For complete kernel boot sequence including Memory initialization, see **RFC 0015 Section 9**.

The Memory-specific initialization steps are:

```typescript
// 1. Initialize Memory driver backend
const memoryDriver = new MemoryDriver();
await memoryDriver.initialize();

// 2. Register with VFS
vfs.registerDriver("memory/", memoryDriver);

// 3. Memory is now accessible via VFS
await VFS.write("os:///memory/os/kernel/boot-params", JSON.stringify(bootParams));
```

**See RFC 0015 Section 9 for the complete kernel initialization sequence.**

## Security Considerations

* `vault/*` prevents accidental disclosure in prompts by rejecting plaintext writes
* `vault/*` does NOT prevent programs from decrypting ciphertext if they have access to crypto primitives (RFC 0016)
* Developers SHOULD avoid printing decrypted values to stdout/stderr
* Origin isolation prevents cross-tenant data access
* Backend storage SHOULD use encryption at rest where possible

## Privacy Considerations

* Storing ciphertext in Memory may still leak metadata (key names, access patterns). This is acceptable for v1
* Key names SHOULD NOT contain sensitive information (e.g., use `vault/service1` not `vault/john-doe-password`)

## Performance Considerations

* Backend KV operations are assumed to be fast (local disk or memory)
* List operations MAY be expensive for large keyspaces - use with care
* Caching MAY be implemented at VFS Core level (not specified in this RFC)

## Migration from v0.5 to v0.6

### 13.1. Breaking Changes

**URI Scheme**:
```
v0.5: memory:///vault/token (separate scheme)
v0.6: os:///memory/vault/token (unified scheme)
```

**API Surface**:
```typescript
// v0.5: Memory module
await Memory.get("vault/token");
await Memory.set("vault/token", "pwenc:v1:...");

// v0.6: VFS unified API
await VFS.read("os:///memory/vault/token");
await VFS.write("os:///memory/vault/token", "pwenc:v1:...");
```

### 13.2. Compatibility Layer

Implementations MAY provide backward-compatible Memory module:

```typescript
// Compatibility wrapper (non-normative)
export const Memory = {
  async get(path: string): Promise<string> {
    return await VFS.read(`os:///memory/${path}`);
  },

  async set(path: string, value: string): Promise<void> {
    await VFS.write(`os:///memory/${path}`, value);
  },

  async list(prefix: string): Promise<string[]> {
    const paths = await VFS.list(`os:///memory/${prefix}`);
    return paths.map(p => p.replace(/^memory\//, ""));
  },

  async delete(path: string): Promise<void> {
    await VFS.delete(`os:///memory/${path}`);
  }
};
```

### 13.3. Data Migration

**Storage location unchanged**: Deno KV storage path remains the same across v0.5 and v0.6.

**Key format unchanged**: Keys stored in backend KV are identical (no prefix changes at storage level).

**Migration steps**: None required for data. Only code needs API updates.

## Future Work

* **Transactions**: Atomic multi-key operations
* **Watchers**: Subscribe to key change notifications
* **Expiration**: Time-to-live for ephemeral keys
* **Compression**: Automatic compression for large values
* **Replication**: Multi-region data synchronization

## References

### PromptWare OS References

* RFC 0013: Kernel VFS Specification (VFS Core orchestration, driver routing)
* RFC 0015: Kernel Dualmode Architecture (URI scheme taxonomy, origin specification)
* RFC 0016: Crypto Primitives Specification (pwenc ciphertext format)
* RFC 0023: Syscall Bridge Specification (origin parameter passing)
* RFC 0024: CQRS Event Schema (error code registry)
* RFC 0026: VFS Driver Interface (contract this driver implements)

### External References

* RFC 2119, RFC 8174 (BCP 14 key words)
* Deno KV documentation

---

*End of RFC 0018 v0.6*

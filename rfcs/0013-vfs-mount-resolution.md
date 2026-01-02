---
rfc: 0013
title: Kernel VFS Specification
author: Huan Li, ChatGPT
status: Draft
type: Standards Track
created: 2025-12-20
updated: 2026-01-01
version: 0.6
tags: [vfs, kernel, mount, os, orchestration]
---

# RFC 0013: Kernel VFS Specification

## 1. Abstract

This RFC defines the **Virtual File System (VFS)** for PromptWar̊e ØS: a thin orchestration layer that routes `os:///` paths to pluggable driver backends.

The VFS Core is responsible for:
1. **Path routing**: Dispatching `os:///` paths to appropriate drivers
2. **Capability enforcement**: Ensuring drivers support requested operations
3. **Unified API**: Providing consistent `read/write/ingest/list/delete` operations
4. **Driver management**: Registering and coordinating VFS drivers

**Key Architectural Change from v0.5**:
- **v0.5**: VFS contained domain logic for code, sys, proc (mixed concerns)
- **v0.6**: VFS is THIN orchestration only; all domain logic moved to drivers (clean separation)

**All domain-specific logic is now in driver RFCs**:
- Memory operations: RFC-18 (Memory VFS Driver)
- System control: RFC-27 (Sys VFS Driver)
- System introspection: RFC-28 (Proc VFS Driver)
- Code ingestion: RFC-29 (Code VFS Driver)

## 2. Status of This Memo

This document is a PromptWar̊e ØS RFC-style specification and may change at any time.

The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**, **SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **MAY**, and **OPTIONAL** are to be interpreted as described in BCP 14 (RFC 2119, RFC 8174).

## 3. Motivation

### 3.1. The Separation Problem (v0.5)

In PromptWar̊e ØS v0.5, the VFS had mixed responsibilities:
- Path resolution for code (mount table logic)
- sys/* single-value enforcement (system control logic)
- proc/* read-only semantics (introspection logic)
- Memory was a separate subsystem with `memory:///` scheme

This violated separation of concerns and made extension difficult.

### 3.2. The Driver Solution (v0.6)

**Option D+ Architecture** (VFS Everything + Pluggable Drivers):

```
All resources under os:/// scheme, routed to pluggable drivers

os:///memory/vault/token           → Memory Driver (RFC-18)
os:///sys/agents/shell/status      → Sys Driver (RFC-27)
os:///proc/cmdline                 → Proc Driver (RFC-28)
os:///agents/shell.md              → Code Driver (RFC-29)
```

**Benefits**:
1. **Clean separation**: VFS Core has NO domain logic
2. **Pluggable backends**: Easy to add new storage drivers (S3, database, etc.)
3. **Encapsulation**: Each driver owns its validation rules
4. **Unified API**: Single interface (`VFS.read/write/ingest`) for all resources
5. **Pure UNIX philosophy**: Everything is a file under `os:///`

### 3.3. Lessons from UNIX VFS

UNIX VFS layers prove that:
- Kernel VFS provides routing and permission checks (thin orchestration)
- Filesystem drivers implement domain-specific logic (ext4, tmpfs, procfs, sysfs)
- Clean interface enables pluggability

PromptWar̊e ØS adopts this pattern:
- **VFS Core** (this RFC): Routing and capability enforcement
- **VFSDriver Interface** (RFC-26): Standard contract
- **Driver Implementations** (RFC-18, 27, 28, 29): Domain logic

## 4. Terminology

* **VFS Path**: A logical path starting with `os:///` (e.g., `os:///memory/vault/token`)
* **Driver**: A module implementing VFSDriver interface (RFC-26) that handles a path namespace
* **Path Namespace**: The set of paths a driver handles (e.g., `os:///memory/*`)
* **Driver Routing**: The process of selecting which driver handles a given path
* **Capability**: A permission declared by a driver (readable, writable, executable)
* **Backend**: The underlying storage mechanism used by a driver (implementation-defined)

## 5. Design Goals

### Goals

The VFS Core MUST:
1. **Route** `os:///` paths to appropriate drivers based on path prefix
2. **Enforce** driver capabilities before calling driver methods
3. **Validate** inputs via driver validation hooks
4. **Provide** unified API surface (`read/write/ingest/list/delete`)
5. **Support** driver registration and lookup
6. **Remain** thin and free of domain-specific logic

### Non-Goals

The VFS Core does NOT:
1. Implement storage backends (delegated to drivers)
2. Define domain-specific validation (delegated to drivers)
3. Handle error code definitions (see RFC-24)
4. Specify driver implementations (see driver RFCs)

## 6. VFS Architecture

### 6.1. Layered Design

```
┌─────────────────────────────────────┐
│   Application / Agent / Skill       │
│   (calls VFS.read/write/ingest)     │
└─────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│         VFS Core (RFC-13)           │
│  - Path routing                     │
│  - Capability enforcement           │
│  - Driver coordination              │
└─────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│    VFSDriver Interface (RFC-26)     │
│  - read/write/list/delete           │
│  - validate hook                    │
│  - capabilities declaration         │
└─────────────────────────────────────┘
              │
         ┌────┴────┬─────────┬──────────┐
         ▼         ▼         ▼          ▼
    ┌────────┐ ┌──────┐ ┌───────┐ ┌───────┐
    │ Memory │ │ Sys  │ │ Proc  │ │ Code  │
    │RFC-18  │ │RFC-27│ │RFC-28 │ │RFC-29 │
    └────────┘ └──────┘ └───────┘ └───────┘
         │         │         │          │
         ▼         ▼         ▼          ▼
    [Deno KV] [Deno KV] [Dynamic]  [HTTPS/file]
                                    [Mount Table]
```

**Key Principle**: VFS Core knows NOTHING about vault enforcement, single-value constraints, or mount tables. All domain logic lives in drivers.

### 6.2. Path Routing Algorithm

Given a VFS path `P` (e.g., `os:///memory/vault/token`):

1. **Validate scheme**: Ensure `P` starts with `os:///`
2. **Extract subpath**: Strip `os:///` → get subpath (e.g., `memory/vault/token`)
3. **Route to driver**: Find driver that handles the path namespace
   - If subpath starts with `memory/*`: Route to Memory Driver
   - If subpath starts with `sys/*`: Route to Sys Driver
   - If subpath starts with `proc/*`: Route to Proc Driver
   - Otherwise: Route to Code Driver (default)
4. **Return driver + driver-relative path**:
   - Driver: MemoryDriver
   - Driver path: `vault/token` (namespace prefix stripped)

**Routing table** (non-normative example):
```typescript
const driverRoutes = [
  { prefix: "memory/", driver: memoryDriver },
  { prefix: "sys/", driver: sysDriver },
  { prefix: "proc/", driver: procDriver },
  { prefix: "", driver: codeDriver }  // Default (catch-all)
];
```

**Driver receives path with both prefixes stripped**:
- VFS receives: `os:///memory/vault/token`
- Memory driver receives: `vault/token`

See RFC-26 Section 6.2 for path convention details.

### 6.3. Unified API Surface

```typescript
/**
 * VFS Core API - thin orchestration layer
 */
class VFS {
  /**
   * Read a resource from VFS
   * Routes to appropriate driver, enforces capabilities
   */
  async read(path: string): Promise<string>;

  /**
   * Write a resource to VFS
   * Routes to appropriate driver, enforces capabilities, validates
   */
  async write(path: string, value: string): Promise<void>;

  /**
   * Ingest code from VFS (special operation for Code driver)
   * Resolves to HTTPS/file:// URL and loads into execution context
   */
  async ingest(path: string): Promise<void>;

  /**
   * List resources under a path prefix
   * Routes to appropriate driver
   */
  async list(prefix: string): Promise<string[]>;

  /**
   * Delete a resource from VFS
   * Routes to appropriate driver, enforces capabilities
   */
  async delete(path: string): Promise<void>;
}
```

**Implementation pattern** (non-normative):
```typescript
async read(fullPath: string): Promise<string> {
  // 1. Route to driver
  const { driver, driverPath } = this.route(fullPath);

  // 2. Enforce capability
  if (!driver.permissions.readable) {
    throw new Error("FORBIDDEN (403): Driver does not support read");
  }

  // 3. Validate (if driver has validation hook)
  if (driver.validate) {
    await driver.validate("read", driverPath);
  }

  // 4. Call driver
  return await driver.read(driverPath);
}
```

### 6.4. Capability Enforcement

VFS Core MUST enforce driver capabilities before calling driver methods:

| Operation | Requires Capability | Error if Not Present |
|-----------|---------------------|----------------------|
| `read()` | `permissions.readable = true` | FORBIDDEN (403) |
| `write()` | `permissions.writable = true` | FORBIDDEN (403) |
| `ingest()` | `permissions.executable = true` | FORBIDDEN (403) |
| `list()` | `permissions.readable = true` | FORBIDDEN (403) |
| `delete()` | `permissions.writable = true` | FORBIDDEN (403) |

**Drivers declare capabilities** in their VFSDriver implementation (see RFC-26).

### 6.5. Validation Flow

VFS Core MUST call driver validation hooks before operations:

```
User calls VFS.write("os:///memory/vault/token", "plaintext")
    │
    ▼
VFS routes to Memory Driver
    │
    ▼
VFS checks writable capability ✅
    │
    ▼
VFS calls driver.validate("write", "vault/token", "plaintext")
    │
    ▼
Memory Driver checks: vault/* requires pwenc:v1:*
    │
    ▼
Throws UNPROCESSABLE_ENTITY (422) ❌
```

**VFS does NOT know about vault rules** - Memory Driver enforces them via validate().

## 7. Driver Registration

### 7.1. Driver Registration (Implementation-Defined)

How drivers are registered with VFS Core is **implementation-defined**. This RFC does NOT mandate a specific mechanism.

**Possible approaches** (non-normative):
```typescript
// Option 1: Constructor registration
const vfs = new VFS({
  drivers: {
    "memory": new MemoryDriver(),
    "sys": new SysDriver(),
    "proc": new ProcDriver(),
    "": new CodeDriver()  // Default driver
  }
});

// Option 2: Dynamic registration
vfs.registerDriver("memory/", memoryDriver);
vfs.registerDriver("sys/", sysDriver);
vfs.registerDriver("proc/", procDriver);
vfs.registerDriver("", codeDriver);

// Option 3: Auto-discovery via manifest
await vfs.loadDrivers([
  "drivers/memory.ts",
  "drivers/sys.ts",
  "drivers/proc.ts",
  "drivers/code.ts"
]);
```

**Requirements**:
- Drivers MUST be registered before VFS operations
- Driver path prefixes MUST NOT overlap (deterministic routing)
- Default driver (empty prefix) SHOULD handle unmatched paths

### 7.2. Built-in Drivers

VFS Core SHOULD include these built-in drivers (v0.6):

| Driver | Namespace | RFC | Purpose |
|--------|-----------|-----|---------|
| Memory | `os:///memory/*` | RFC-18 | Key-value storage (vault, general) |
| Sys | `os:///sys/*` | RFC-27 | System control attributes |
| Proc | `os:///proc/*` | RFC-28 | System introspection views |
| Code | `os:///agents/*`, `os:///skills/*`, etc. | RFC-29 | Code ingestion with mount table |

**Third-party drivers** (future):
- S3 driver: `os:///s3/*` (cloud storage)
- Database driver: `os:///db/*` (SQL/NoSQL)
- Network driver: `os:///net/*` (socket abstractions)

## 8. Integration with pwosIngest()

### 8.1. Ingest Operation

`pwosIngest()` is a **special operation** that:
1. Routes to Code Driver (typically)
2. Resolves VFS path to HTTPS/file:// URL via mount table
3. Fetches source code
4. Parses and validates code
5. Loads into execution context

**VFS.ingest() delegates to Code Driver**:
```typescript
async ingest(path: string): Promise<void> {
  const { driver, driverPath } = this.route(path);

  // Only Code driver should support ingest
  if (!driver.permissions.executable) {
    throw new Error("BAD_REQUEST (400): Driver does not support ingest");
  }

  // Code driver handles mount resolution and fetch
  await driver.ingest(driverPath);
}
```

**Mount table logic is in Code Driver (RFC-29)**, not VFS Core.

### 8.2. Path Restrictions for Ingest

VFS Core MUST reject ingest on non-code paths:

```typescript
// ❌ BAD_REQUEST (400): Memory is storage, not code
await VFS.ingest("os:///memory/vault/token");

// ❌ BAD_REQUEST (400): Sys is control, not code
await VFS.ingest("os:///sys/agents/shell/status");

// ❌ BAD_REQUEST (400): Proc is introspection, not code
await VFS.ingest("os:///proc/cmdline");

// ✅ Valid: Code driver handles agents/*
await VFS.ingest("os:///agents/shell.md");
```

**Enforcement**: Code driver has `executable = true`, others have `executable = false`.

## 9. Error Handling

### 9.1. Error Code References

VFS operations reference the following error codes (defined in RFC-24):

| Error Code | HTTP | Condition | Recovery |
|------------|------|-----------|----------|
| `BAD_REQUEST` | 400 | Invalid path format or scheme | Check path syntax |
| `FORBIDDEN` | 403 | Driver doesn't support operation | Check driver capabilities |
| `NOT_FOUND` | 404 | Path doesn't exist in driver | Check path spelling |
| `UNPROCESSABLE_ENTITY` | 422 | Validation failed | Fix value format |
| `INTERNAL_SERVER_ERROR` | 500 | Driver backend failure | Check backend health |
| `BAD_GATEWAY` | 502 | URL fetch failed (Code driver) | Check URL accessibility |

### 9.2. Error Flow

```
VFS.write("os:///memory/vault/token", "plaintext")
    │
    ▼
Route to Memory Driver
    │
    ▼
Check writable capability → ✅
    │
    ▼
Call driver.validate("write", "vault/token", "plaintext")
    │
    ▼
Memory Driver throws: UNPROCESSABLE_ENTITY (422)
"vault/* requires pwenc:v1:* ciphertext"
    │
    ▼
VFS propagates error to caller
```

**VFS Core does NOT modify error messages** - drivers own their error semantics.

## 10. Examples (Non-Normative)

### Example 1: Read Operation Routing

```typescript
// User calls
await VFS.read("os:///memory/vault/token");

// VFS Core execution:
// 1. Strip os:/// → "memory/vault/token"
// 2. Route to Memory Driver (matches "memory/" prefix)
// 3. Strip "memory/" → "vault/token"
// 4. Check permissions.readable → ✅ true
// 5. Call memoryDriver.read("vault/token")
// 6. Return ciphertext: "pwenc:v1:..."
```

### Example 2: Write Operation with Validation

```typescript
// User calls
await VFS.write("os:///memory/vault/token", "plaintext");

// VFS Core execution:
// 1. Route to Memory Driver
// 2. Check permissions.writable → ✅ true
// 3. Call memoryDriver.validate("write", "vault/token", "plaintext")
// 4. Memory Driver throws UNPROCESSABLE_ENTITY (422) ❌
// 5. VFS propagates error
```

### Example 3: Ingest Operation

```typescript
// User calls
await VFS.ingest("os:///agents/shell.md");

// VFS Core execution:
// 1. Route to Code Driver (default, no namespace match)
// 2. Check permissions.executable → ✅ true
// 3. Call codeDriver.ingest("agents/shell.md")
// 4. Code Driver resolves via mount table:
//    "agents/shell.md" → "https://github.com/.../os/agents/shell.md"
// 5. Code Driver fetches, parses, loads
```

### Example 4: Cross-Driver Operations

```typescript
// Memory storage
await VFS.write("os:///memory/config", JSON.stringify({theme: "dark"}));

// System control
await VFS.write("os:///sys/agents/shell/status", "active");

// System introspection
const cmdline = await VFS.read("os:///proc/cmdline");

// Code ingestion
await VFS.ingest("os:///agents/shell.md");

// All routed to different drivers, but unified API
```

### Example 5: Incorrect Usage (Anti-Patterns)

```typescript
// ❌ WRONG: Using Read tool on VFS path
await Read("os:///agents/shell.md");
// → Security violation! Must use VFS.ingest()

// ❌ WRONG: Wrong scheme
await VFS.read("memory:///vault/token");
// → BAD_REQUEST (400): Use os:/// scheme

// ❌ WRONG: Ingesting non-code
await VFS.ingest("os:///memory/vault/token");
// → BAD_REQUEST (400): Memory driver not executable

// ✅ CORRECT: Proper scheme and operations
await VFS.read("os:///memory/vault/token");     // Memory read
await VFS.write("os:///sys/agents/shell/status", "active");  // Sys write
await VFS.read("os:///proc/cmdline");           // Proc read
await VFS.ingest("os:///agents/shell.md");      // Code ingest
```

## 11. Migration from v0.5 to v0.6

### 11.1. Breaking Changes

**URI Scheme Changes**:
```typescript
// v0.5: Memory had separate scheme
await Memory.get("vault/token");  // memory:/// scheme

// v0.6: All under os:/// scheme
await VFS.read("os:///memory/vault/token");
```

**API Changes**:
```typescript
// v0.5: Domain-specific modules
await Memory.get("vault/token");
await VFS.read("os:///proc/cmdline");  // Already in VFS in v0.5

// v0.6: Unified VFS API
await VFS.read("os:///memory/vault/token");
await VFS.read("os:///proc/cmdline");
```

### 11.2. Migration Guide

**Step 1**: Update Memory calls
```typescript
// Before (v0.5)
await Memory.get("vault/token");
await Memory.set("vault/token", "pwenc:v1:...");

// After (v0.6)
await VFS.read("os:///memory/vault/token");
await VFS.write("os:///memory/vault/token", "pwenc:v1:...");
```

**Step 2**: sys/* and proc/* already use VFS (no change)
```typescript
// v0.5 and v0.6 (same)
await VFS.read("os:///sys/agents/shell/status");
await VFS.read("os:///proc/cmdline");
```

**Step 3**: Code ingestion unchanged
```typescript
// v0.5 and v0.6 (same)
await pwosIngest("os:///agents/shell.md");
```

### 11.3. Compatibility Layer (Optional)

Implementations MAY provide a compatibility layer:
```typescript
// Compatibility wrapper for v0.5 code
const Memory = {
  async get(path: string): Promise<string> {
    return await VFS.read(`os:///memory/${path}`);
  },
  async set(path: string, value: string): Promise<void> {
    await VFS.write(`os:///memory/${path}`, value);
  }
};
```

## 12. Security Considerations

- VFS Core MUST enforce capability checks before calling drivers
- VFS Core MUST NOT bypass driver validation hooks
- Drivers MUST NOT trust VFS Core to validate inputs (defense in depth)
- Error messages MUST NOT leak sensitive data

## 13. Performance Considerations

- Driver routing SHOULD use O(1) lookup (hash table) not O(n) iteration
- Path normalization SHOULD be cached where possible
- Driver instances SHOULD be singleton (avoid repeated instantiation)

## 14. Future Work

- **Driver versioning**: Allow multiple driver versions to coexist
- **Driver capabilities**: Extend with transactional, watchable, etc.
- **Third-party drivers**: Define packaging and distribution mechanism
- **Driver composition**: Allow drivers to delegate to other drivers

## 15. References

### PromptWar̊e ØS References

* RFC 0015: Kernel Dualmode Architecture (URI scheme taxonomy, kernel init)
* RFC 0018: Memory VFS Driver (vault enforcement, KV operations)
* RFC 0024: CQRS Event Schema (error code registry)
* RFC 0026: VFS Driver Interface (contract all drivers implement)
* RFC 0027: Sys VFS Driver (system control attributes)
* RFC 0028: Proc VFS Driver (system introspection)
* RFC 0029: Code VFS Driver (mount table, code ingestion)

### External References

* RFC 2119, RFC 8174 (BCP 14 key words)
* Linux VFS architecture documentation

---

*End of RFC 0013 v0.6*

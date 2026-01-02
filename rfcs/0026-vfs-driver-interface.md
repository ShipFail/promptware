---
rfc: 0026
title: VFS Driver Interface Specification
author: Huan Li, ChatGPT
status: Draft
type: Standards Track
created: 2026-01-01
updated: 2026-01-01
version: 0.1
tags: [vfs, driver, interface, contract]
---

# RFC 0026: VFS Driver Interface Specification

## 1. Abstract

This RFC defines the **VFSDriver interface contract** for PromptWare OS. All VFS drivers (Memory, Sys, Proc, Code, and future storage drivers) MUST implement this interface to integrate with the VFS subsystem.

The VFSDriver interface provides a standardized way to:
- Declare driver capabilities (readable, writable, executable)
- Implement resource operations (read, write, list, delete)
- Enforce domain-specific validation rules

This RFC is the **foundation** for the driver-based VFS architecture (Option D+). It defines the contract but NOT the implementation details of individual drivers.

## 2. Status of This Memo

This document is a PromptWare OS RFC-style specification and may change at any time.

The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**, **SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **MAY**, and **OPTIONAL** are to be interpreted as described in BCP 14 (RFC 2119, RFC 8174).

## 3. Motivation

### 3.1. The Driver Architecture Problem

PromptWare OS v0.5 mixed VFS orchestration with domain-specific logic:
- VFS knew about sys/* single-value enforcement
- VFS knew about proc/* read-only semantics
- Memory was a separate subsystem with different URI scheme

This violated separation of concerns and made the system harder to extend.

### 3.2. Solution: Pluggable Drivers

The VFSDriver interface separates:
- **VFS Core** (RFC-13): Thin orchestration layer that routes requests
- **Driver Interface** (RFC-26, this document): Standard contract all drivers implement
- **Driver Implementations** (RFC-18, 27, 28, 29): Domain-specific logic

**Benefits**:
- Clean separation of concerns
- Easy to add new storage backends (S3, database, etc.)
- Each driver owns its validation rules
- VFS remains simple and focused on routing

## 4. Terminology

* **Driver**: A module that implements the VFSDriver interface and handles operations for a specific path namespace
* **Path Namespace**: The set of paths a driver handles (e.g., `os:///memory/*`, `os:///sys/*`)
* **Capability**: A permission declared by a driver (readable, writable, executable)
* **Validation Hook**: An optional driver method that enforces domain-specific rules before operations
* **Backend**: The underlying storage mechanism used by a driver (implementation-defined)

## 5. Design Goals

1. **Simple Contract**: Minimal interface that covers all use cases
2. **Declarative Capabilities**: Drivers declare what they support (read/write/execute)
3. **Optional Operations**: Drivers only implement operations they support
4. **Validation Hooks**: Drivers enforce domain-specific rules via validate()
5. **Backend Agnostic**: Interface doesn't constrain storage implementation
6. **Future-Proof**: Easy to extend with new operations or capabilities

### Non-Goals

1. Defining how VFS routes to drivers (see RFC-13)
2. Specifying driver registration mechanisms (implementation-defined)
3. Implementing specific drivers (see RFC-18, 27, 28, 29)
4. Defining error codes (see RFC-24)

## 6. VFSDriver Interface

### 6.1. Core Interface

```typescript
interface VFSDriver {
  /**
   * Driver name for identification and logging
   */
  readonly name: string;

  /**
   * Declared capabilities - what operations this driver supports
   */
  readonly permissions: {
    /** Driver supports read operations */
    readonly readable: boolean;
    /** Driver supports write operations */
    readonly writable: boolean;
    /** Driver supports execute/ingest operations */
    readonly executable: boolean;
  };

  /**
   * Read a resource at the given path
   * @param path - Path relative to driver namespace (without os:/// prefix)
   * @returns Resource content as string
   * @throws NOT_FOUND (404) if path doesn't exist
   * @throws FORBIDDEN (403) if driver is not readable
   */
  read?(path: string): Promise<string>;

  /**
   * Write a resource at the given path
   * @param path - Path relative to driver namespace (without os:/// prefix)
   * @param value - Content to write
   * @throws FORBIDDEN (403) if driver is not writable
   * @throws UNPROCESSABLE_ENTITY (422) if validation fails
   */
  write?(path: string, value: string): Promise<void>;

  /**
   * List resources under a path prefix
   * @param prefix - Path prefix to list (without os:/// prefix)
   * @returns Array of paths relative to driver namespace
   * @throws NOT_FOUND (404) if prefix doesn't exist
   */
  list?(prefix: string): Promise<string[]>;

  /**
   * Delete a resource at the given path
   * @param path - Path relative to driver namespace (without os:/// prefix)
   * @throws NOT_FOUND (404) if path doesn't exist
   * @throws FORBIDDEN (403) if driver doesn't support deletion
   */
  delete?(path: string): Promise<void>;

  /**
   * Validate an operation before execution (optional hook)
   * Drivers use this to enforce domain-specific rules
   * @param operation - Operation type being validated
   * @param path - Path being operated on (without os:/// prefix)
   * @param value - Value for write operations (undefined for read)
   * @throws UNPROCESSABLE_ENTITY (422) if validation fails
   */
  validate?(
    operation: "read" | "write" | "delete",
    path: string,
    value?: string
  ): void | Promise<void>;
}
```

### 6.2. Path Convention

**CRITICAL**: All driver methods receive paths **without** the `os:///` prefix and **without** the driver namespace prefix.

**Example**:
```typescript
// VFS receives: "os:///memory/vault/token"
// VFS routes to Memory driver
// Memory driver receives: "vault/token" (both prefixes stripped)

// VFS receives: "os:///sys/agents/shell/status"
// VFS routes to Sys driver
// Sys driver receives: "agents/shell/status" (both prefixes stripped)
```

**Rationale**: Drivers should not need to parse or know about the VFS routing structure. They operate on paths within their own namespace.

### 6.3. Capability Enforcement

**VFS MUST enforce capabilities before calling driver methods**:

```typescript
// VFS enforcement (example - non-normative)
async function vfsRead(fullPath: string): Promise<string> {
  const driver = routeToDriver(fullPath);
  const driverPath = stripPrefixes(fullPath);

  // Enforce readable capability
  if (!driver.permissions.readable) {
    throw new Error("FORBIDDEN (403): Driver does not support read");
  }

  // Call driver
  return await driver.read(driverPath);
}
```

**Drivers SHOULD NOT check their own capabilities** - VFS does this.

### 6.4. Validation Hook Pattern

**Purpose**: Drivers use `validate()` to enforce domain-specific rules.

**Timing**: VFS calls `validate()` **before** calling the operation method.

**Example**:
```typescript
class MemoryDriver implements VFSDriver {
  readonly name = "memory";
  readonly permissions = { readable: true, writable: true, executable: false };

  // Validation hook enforces vault ciphertext requirement
  validate(operation: string, path: string, value?: string): void {
    if (operation === "write" && path.startsWith("vault/")) {
      if (!value || !value.startsWith("pwenc:v1:")) {
        throw new Error("UNPROCESSABLE_ENTITY (422): vault/* requires pwenc:v1:* ciphertext");
      }
    }
  }

  async read(path: string): Promise<string> {
    // No validation needed - VFS already called validate()
    return await this.backend.get(path);
  }

  async write(path: string, value: string): Promise<void> {
    // No validation needed - VFS already called validate()
    await this.backend.set(path, value);
  }
}
```

**VFS validation flow** (non-normative):
```typescript
async function vfsWrite(fullPath: string, value: string): Promise<void> {
  const driver = routeToDriver(fullPath);
  const driverPath = stripPrefixes(fullPath);

  // 1. Check capability
  if (!driver.permissions.writable) {
    throw new Error("FORBIDDEN (403)");
  }

  // 2. Call validation hook if present
  if (driver.validate) {
    await driver.validate("write", driverPath, value);
  }

  // 3. Call operation
  await driver.write(driverPath, value);
}
```

## 7. Driver Implementation Requirements

### 7.1. Capability Declaration

Drivers MUST declare accurate capabilities:

```typescript
// Read-only driver (Proc)
readonly permissions = { readable: true, writable: false, executable: false };

// Read-write driver (Memory, Sys)
readonly permissions = { readable: true, writable: true, executable: false };

// Execute-only driver (Code)
readonly permissions = { readable: false, writable: false, executable: true };
```

### 7.2. Optional Methods

Drivers SHOULD only implement methods they support:

```typescript
// Read-only driver - no write() method
class ProcDriver implements VFSDriver {
  readonly permissions = { readable: true, writable: false, executable: false };

  async read(path: string): Promise<string> { /* ... */ }
  // No write() method - not supported
}
```

**However**: If VFS enforces capabilities correctly, unimplemented methods should never be called.

### 7.3. Error Handling

Drivers MUST throw standard error codes (defined in RFC-24):

| Error Code | HTTP | When to Throw |
|------------|------|---------------|
| `NOT_FOUND` | 404 | Path doesn't exist |
| `FORBIDDEN` | 403 | Operation not allowed by driver semantics |
| `UNPROCESSABLE_ENTITY` | 422 | Validation failed (value format, constraints) |
| `INTERNAL_SERVER_ERROR` | 500 | Backend failure |

**Error messages MUST NOT include sensitive data** (e.g., plaintext secrets).

## 8. Driver Path Namespaces

Each driver handles a specific path namespace under `os:///`:

| Driver | Namespace | Handles | RFC |
|--------|-----------|---------|-----|
| **Code** | `os:///agents/*`, `os:///skills/*`, etc. | Code ingestion | RFC-29 |
| **Sys** | `os:///sys/*` | System control attributes | RFC-27 |
| **Proc** | `os:///proc/*` | System introspection views | RFC-28 |
| **Memory** | `os:///memory/*` | Key-value storage | RFC-18 |
| **S3** (future) | `os:///s3/*` | Cloud object storage | RFC-30 |

**Path routing** is defined in RFC-13 (VFS Core), not in this interface specification.

## 9. Examples (Non-Normative)

### Example 1: Minimal Read-Only Driver

```typescript
class SimpleProcDriver implements VFSDriver {
  readonly name = "proc";
  readonly permissions = { readable: true, writable: false, executable: false };

  async read(path: string): Promise<string> {
    if (path === "cmdline") {
      return JSON.stringify({ root: "https://..." });
    }
    throw new Error("NOT_FOUND (404)");
  }
}
```

### Example 2: Driver with Validation

```typescript
class SysDriver implements VFSDriver {
  readonly name = "sys";
  readonly permissions = { readable: true, writable: true, executable: false };

  // Enforce single-value constraint (no newlines)
  validate(operation: string, path: string, value?: string): void {
    if (operation === "write" && value?.includes("\n")) {
      throw new Error("UNPROCESSABLE_ENTITY (422): sys/* requires single-value (no newlines)");
    }
  }

  async read(path: string): Promise<string> {
    return await this.backend.get(path);
  }

  async write(path: string, value: string): Promise<void> {
    await this.backend.set(path, value);
  }
}
```

### Example 3: Driver with List Support

```typescript
class MemoryDriver implements VFSDriver {
  readonly name = "memory";
  readonly permissions = { readable: true, writable: true, executable: false };

  async read(path: string): Promise<string> {
    const value = await this.kv.get(path);
    if (value === null) throw new Error("NOT_FOUND (404)");
    return value;
  }

  async write(path: string, value: string): Promise<void> {
    await this.kv.set(path, value);
  }

  async list(prefix: string): Promise<string[]> {
    const entries = await this.kv.list({ prefix });
    return entries.map(e => e.key);
  }

  async delete(path: string): Promise<void> {
    await this.kv.delete(path);
  }
}
```

## 10. Extension Points

### 10.1. Future Capabilities

The `permissions` object can be extended with new capabilities:

```typescript
// Future extension (non-normative)
readonly permissions = {
  readable: true,
  writable: true,
  executable: false,
  watchable: true,  // New capability
  transactional: true  // New capability
};
```

### 10.2. Future Operations

New methods can be added to the interface:

```typescript
// Future extension (non-normative)
interface VFSDriver {
  // ... existing methods ...

  watch?(path: string, callback: (event: WatchEvent) => void): Promise<void>;
  transaction?(operations: Operation[]): Promise<void>;
}
```

Drivers that don't implement new methods continue to work (backward compatible).

## 11. Security Considerations

- Drivers MUST validate all inputs before operating on backend storage
- Drivers MUST NOT expose sensitive data in error messages
- Drivers SHOULD enforce least-privilege (declare minimal capabilities)
- VFS MUST enforce capability checks before calling driver methods

## 12. Implementation Notes

### 12.1. Driver Registration

How drivers are registered with VFS is **implementation-defined**. Possible approaches:

```typescript
// Option 1: Static registration
const vfs = new VFS({
  drivers: [
    new MemoryDriver(),
    new SysDriver(),
    new ProcDriver(),
    new CodeDriver()
  ]
});

// Option 2: Dynamic registration
vfs.registerDriver("memory", new MemoryDriver());
vfs.registerDriver("sys", new SysDriver());

// Option 3: Path-based routing table
vfs.mount("memory/*", new MemoryDriver());
vfs.mount("sys/*", new SysDriver());
```

This RFC does not prescribe a specific registration mechanism.

### 12.2. Backend Storage

Drivers choose their own backend storage:
- Memory driver: Deno KV
- Sys driver: Deno KV, files, or in-memory
- Proc driver: Dynamic generation
- Code driver: HTTPS fetch or file:// read

VFSDriver interface is **backend-agnostic**.

## 13. References

### PromptWare OS References

* RFC 0013: Kernel VFS Specification (VFS core orchestration, routing)
* RFC 0015: Kernel Dualmode Architecture (URI scheme taxonomy)
* RFC 0018: Memory VFS Driver (driver implementation example)
* RFC 0024: CQRS Event Schema (error code registry)
* RFC 0027: Sys VFS Driver (driver implementation example)
* RFC 0028: Proc VFS Driver (driver implementation example)
* RFC 0029: Code VFS Driver (driver implementation example)

### External References

* RFC 2119, RFC 8174 (BCP 14 key words)

---

*End of RFC 0026*

---
rfc: 0027
title: Sys VFS Driver Specification
author: Huan Li, ChatGPT
status: Draft
type: Standards Track
created: 2026-01-01
updated: 2026-01-01
version: 0.1
tags: [vfs, driver, sys, control, sysfs]
---

# RFC 0027: Sys VFS Driver Specification

## Abstract

This RFC defines the **Sys VFS Driver** for PromptWare OS: a system control plane driver that implements the VFSDriver interface (RFC-26) to provide writable control attributes under the `os:///sys/*` namespace.

The Sys driver is inspired by Linux sysfs and provides:
- **Writable control attributes**: Single-value parameters that control system behavior
- **Single-value enforcement**: Values MUST NOT contain newlines (each attribute = one semantic value)
- **Dynamic system configuration**: Runtime control without code changes

**Design inspiration**: Linux `/sys` filesystem (sysfs) - hierarchical, attribute-based system control.

## Status of This Memo

This document is a PromptWare OS RFC-style specification and may change at any time.

The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**, **SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **MAY**, and **OPTIONAL** are to be interpreted as described in BCP 14 (RFC 2119, RFC 8174).

## Terminology

* **Sys Driver**: A VFS driver implementing RFC-26 interface, handling `os:///sys/*` paths
* **Attribute**: A single-value control parameter (e.g., `status`, `debug_mode`)
* **Single-value**: A string value containing NO newline characters (`\n`)
* **Control plane**: The writable interface for system configuration
* **Backend**: The underlying storage mechanism for attributes (implementation-defined)

## Motivation

### 3.1. The System Control Problem

PromptWare OS needs a way to:
- Control runtime system behavior (enable/disable features)
- Configure agent lifecycle states (active/inactive/terminated)
- Adjust system parameters without restarting

Traditional approaches:
- **Environment variables**: Static, set at boot, can't change at runtime
- **Configuration files**: Require parsing, not atomic, harder to validate
- **Memory KV store**: Too general, no semantic constraints

### 3.2. The Sysfs Solution

Linux sysfs (`/sys`) proves that:
- Hierarchical attribute files are intuitive
- Single-value per file is simple and predictable
- Writable attributes enable runtime control
- Filesystem semantics are familiar to developers

PromptWare Sys driver adopts these principles:
- Each attribute is a single value (no newlines)
- Hierarchical paths organize related attributes
- Read/write operations are atomic
- Values are plain strings (no complex parsing)

## Design Goals

### Goals

The Sys driver MUST:
1. **Implement RFC-26 interface**: Full VFSDriver compliance
2. **Enforce single-value**: Reject values containing newlines
3. **Provide read/write access**: Both read and write operations supported
4. **Support hierarchical paths**: Organize attributes in tree structure
5. **Be backend-agnostic**: Don't prescribe storage mechanism

### Non-Goals

The Sys driver does NOT:
1. Implement complex validation beyond single-value check
2. Define specific attribute schemas (application-defined)
3. Provide transactional multi-attribute updates
4. Support binary values (strings only for v1)

## Driver Implementation

### 5.1. VFSDriver Interface Compliance

```typescript
class SysDriver implements VFSDriver {
  readonly name = "sys";

  readonly permissions = {
    readable: true,
    writable: true,
    executable: false
  };

  /**
   * Validation hook: Enforce single-value constraint
   */
  validate(operation: string, path: string, value?: string): void {
    if (operation === "write") {
      if (!value) {
        throw new Error("BAD_REQUEST (400): Value cannot be empty");
      }
      if (value.includes("\n")) {
        throw new Error(
          "UNPROCESSABLE_ENTITY (422): sys/* requires single-value (no newlines)"
        );
      }
    }
  }

  /**
   * Read a system attribute
   */
  async read(path: string): Promise<string> {
    const value = await this.backend.get(path);
    if (value === null) {
      throw new Error("NOT_FOUND (404): Attribute does not exist");
    }
    return value;
  }

  /**
   * Write a system attribute
   */
  async write(path: string, value: string): Promise<void> {
    await this.backend.set(path, value);
  }

  /**
   * List attributes under a path prefix
   */
  async list(prefix: string): Promise<string[]> {
    const entries = await this.backend.list({ prefix });
    return entries.map(e => e.key);
  }

  /**
   * Delete a system attribute
   */
  async delete(path: string): Promise<void> {
    const exists = await this.backend.get(path);
    if (exists === null) {
      throw new Error("NOT_FOUND (404): Attribute does not exist");
    }
    await this.backend.delete(path);
  }
}
```

**Key points**:
- **Path format**: Driver receives paths WITHOUT `os:///sys/` prefix
- **Validation**: `validate()` hook enforces single-value constraint (no newlines)
- **Simplicity**: No complex parsing - values are plain strings

### 5.2. Path Semantics

**Path normalization** (inherited from VFS Core):
- VFS Core strips `os:///sys/` prefix before calling driver
- Driver operates on relative paths within sys namespace
- Leading slashes normalized by VFS Core

**Example**:
```typescript
// User calls
await VFS.write("os:///sys/agents/shell/status", "active");

// VFS Core routing
// 1. Strip os:/// → "sys/agents/shell/status"
// 2. Match "sys/" prefix → route to Sys Driver
// 3. Strip "sys/" → "agents/shell/status"

// Sys Driver receives
path = "agents/shell/status"  // Relative to sys namespace
value = "active"
```

### 5.3. Hierarchical Path Organization

Sys attributes SHOULD be organized hierarchically:

```
os:///sys/
├── agents/
│   ├── shell/
│   │   ├── status            (active|inactive|terminated)
│   │   └── lifecycle/
│   │       └── desired_state (running|stopped)
│   └── manager/
│       └── status
├── system/
│   ├── debug_mode            (0|1)
│   ├── log_level             (info|debug|error)
│   └── telemetry_enabled     (true|false)
└── features/
    ├── experimental_mode     (enabled|disabled)
    └── strict_validation     (on|off)
```

**Conventions** (non-normative):
- Use lowercase, underscores for multi-word names
- Group related attributes under common prefix
- Use semantic paths (e.g., `agents/shell/status` not `a/s/s`)

## Single-Value Enforcement

### 6.1. Core Rule

For ALL `sys/*` paths:

* **Write validation**: `validate()` hook MUST reject values containing `\n` (newline)
* **Read behavior**: Returns single-value string exactly as stored
* **Rationale**: Each attribute represents exactly ONE semantic value

### 6.2. Validation Hook Implementation

```typescript
validate(operation: string, path: string, value?: string): void {
  if (operation === "write") {
    // Empty value check
    if (!value) {
      throw new Error("BAD_REQUEST (400): Value cannot be empty");
    }

    // Single-value enforcement
    if (value.includes("\n")) {
      throw new Error(
        "UNPROCESSABLE_ENTITY (422): sys/* requires single-value (no newlines)"
      );
    }
  }
}
```

**VFS Core calls validate() BEFORE calling write()**:
```
VFS.write("os:///sys/agents/shell/status", "active\nstarted")
  → Sys.validate("write", "agents/shell/status", "active\nstarted")
  → Throws UNPROCESSABLE_ENTITY (422) ❌
  → write() never called
```

### 6.3. Allowed Value Formats

**Valid values** (examples):
```typescript
"active"                    // Simple word
"1"                         // Number as string
"true"                      // Boolean as string
"debug"                     // Enum-like value
"2026-01-01T00:00:00Z"      // Timestamp
"/path/to/resource"         // Path (no newlines)
"key=value"                 // Simple key-value (if needed)
```

**Invalid values** (rejected):
```typescript
"active\nstarted"           // ❌ Contains newline
"line1\nline2\nline3"       // ❌ Multi-line
"{\n  \"key\": \"value\"\n}" // ❌ JSON with newlines
```

**For multi-value data**: Use JSON without newlines or comma-separated values:
```typescript
// ✅ Valid: JSON on single line
await VFS.write("os:///sys/config/params", '{"key":"value","num":42}');

// ✅ Valid: Comma-separated
await VFS.write("os:///sys/allowed/users", "alice,bob,charlie");
```

## Backend Storage

### 7.1. Backend Interface (Implementation-Defined)

The Sys driver backend is **implementation-defined**. Common implementations:

**Option 1: Deno KV** (share with Memory driver):
```typescript
class SysDriver {
  private kv: Deno.Kv;

  async initialize() {
    this.kv = await Deno.openKv();  // Same KV as Memory
  }

  async read(path: string): Promise<string> {
    const key = `sys/${path}`;  // Prefix to avoid collision
    const entry = await this.kv.get([key]);
    if (entry.value === null) throw new Error("NOT_FOUND (404)");
    return entry.value as string;
  }

  async write(path: string, value: string): Promise<void> {
    const key = `sys/${path}`;
    await this.kv.set([key], value);
  }
}
```

**Option 2: File-based storage**:
```typescript
class SysDriver {
  private basePath = "/tmp/pwos-sys";

  async read(path: string): Promise<string> {
    const filePath = `${this.basePath}/${path}`;
    try {
      return await Deno.readTextFile(filePath);
    } catch {
      throw new Error("NOT_FOUND (404)");
    }
  }

  async write(path: string, value: string): Promise<void> {
    const filePath = `${this.basePath}/${path}`;
    await Deno.mkdir(dirname(filePath), { recursive: true });
    await Deno.writeTextFile(filePath, value);
  }
}
```

**Option 3: In-memory Map** (ephemeral, testing):
```typescript
class SysDriver {
  private store = new Map<string, string>();

  async read(path: string): Promise<string> {
    const value = this.store.get(path);
    if (value === undefined) throw new Error("NOT_FOUND (404)");
    return value;
  }

  async write(path: string, value: string): Promise<void> {
    this.store.set(path, value);
  }
}
```

### 7.2. Persistence

Implementations MUST document whether Sys attributes persist across restarts.

**Recommended behavior**:
- **Ephemeral attributes**: In-memory only (e.g., `agents/*/status`)
- **Persistent attributes**: Stored in KV or files (e.g., `system/debug_mode`)
- **Mixed approach**: Some paths persistent, others ephemeral

**Rationale**: Runtime state (agent status) shouldn't persist, but configuration (debug mode) should.

## Error Handling

### 8.1. Error Code References

Sys driver operations reference the following error codes (defined in RFC-24):

| Error Code | HTTP | Condition | Recovery |
|------------|------|-----------|----------|
| `BAD_REQUEST` | 400 | Value is empty | Provide non-empty value |
| `NOT_FOUND` | 404 | Attribute doesn't exist | Check attribute path |
| `UNPROCESSABLE_ENTITY` | 422 | Value contains newlines | Remove newlines from value |
| `INTERNAL_SERVER_ERROR` | 500 | Backend failure | Check backend health |

### 8.2. Validation Order

When processing a write operation, validation occurs in this order:

1. **VFS Core validation**: Check path scheme (`os:///`), route to driver
2. **VFS Core capability check**: Ensure driver is writable
3. **Driver validation hook**: `SysDriver.validate("write", path, value)`
   - Check value is not empty
   - Check value contains no newlines
4. **Driver operation**: `SysDriver.write(path, value)`
5. **Backend operation**: `backend.set(path, value)`

### 8.3. Error Examples

```typescript
// Single-value enforcement (validation hook failure)
await VFS.write("os:///sys/agents/shell/status", "active\nstarted");
// → Sys.validate() throws UNPROCESSABLE_ENTITY (422)
// Error: "sys/* requires single-value (no newlines)"

// Empty value (validation hook failure)
await VFS.write("os:///sys/agents/shell/status", "");
// → Sys.validate() throws BAD_REQUEST (400)
// Error: "Value cannot be empty"

// Attribute not found (driver operation failure)
await VFS.read("os:///sys/nonexistent/attribute");
// → Sys.read() throws NOT_FOUND (404)

// Valid write (single-value)
await VFS.write("os:///sys/agents/shell/status", "active");
// ✅ Works
```

## Examples (Non-Normative)

### Example 1: Agent Lifecycle Control

```typescript
// Set agent status
await VFS.write("os:///sys/agents/shell/status", "active");

// Read agent status
const status = await VFS.read("os:///sys/agents/shell/status");
// Returns: "active"

// Change desired state
await VFS.write("os:///sys/agents/shell/lifecycle/desired_state", "stopped");

// Invalid: Multi-line status
await VFS.write("os:///sys/agents/shell/status", "active\nstarted");
// ❌ Throws UNPROCESSABLE_ENTITY (422)
```

### Example 2: System Configuration

```typescript
// Enable debug mode
await VFS.write("os:///sys/system/debug_mode", "1");

// Set log level
await VFS.write("os:///sys/system/log_level", "debug");

// Enable telemetry
await VFS.write("os:///sys/system/telemetry_enabled", "true");

// Read configuration
const debugMode = await VFS.read("os:///sys/system/debug_mode");
// Returns: "1"
```

### Example 3: Feature Flags

```typescript
// Enable experimental features
await VFS.write("os:///sys/features/experimental_mode", "enabled");

// Toggle strict validation
await VFS.write("os:///sys/features/strict_validation", "on");

// Query feature flag
const experimental = await VFS.read("os:///sys/features/experimental_mode");
if (experimental === "enabled") {
  // Use experimental features
}
```

### Example 4: List Attributes

```typescript
// List all agent attributes
const agentAttrs = await VFS.list("os:///sys/agents/");
// Returns: ["agents/shell/status", "agents/shell/lifecycle/desired_state", "agents/manager/status"]

// List system attributes
const systemAttrs = await VFS.list("os:///sys/system/");
// Returns: ["system/debug_mode", "system/log_level", "system/telemetry_enabled"]
```

### Example 5: Complex Values (Workarounds)

```typescript
// ❌ WRONG: Multi-line JSON
await VFS.write("os:///sys/config/settings", `{
  "key": "value",
  "num": 42
}`);
// → Throws UNPROCESSABLE_ENTITY (422)

// ✅ CORRECT: Single-line JSON
await VFS.write("os:///sys/config/settings", '{"key":"value","num":42}');

// ✅ CORRECT: Comma-separated list
await VFS.write("os:///sys/allowed/users", "alice,bob,charlie");

// ✅ CORRECT: Colon-separated key-value
await VFS.write("os:///sys/config/param", "timeout:30");
```

### Example 6: Incorrect Usage (Anti-Patterns)

```typescript
// ❌ WRONG: Using Sys for storage (use Memory instead)
await VFS.write("os:///sys/data/large-payload", JSON.stringify(bigObject));
// → Sys is for control, not data storage

// ❌ WRONG: Using Sys for code (use Code driver)
await VFS.ingest("os:///sys/agents/shell/status");
// → BAD_REQUEST (400): Sys driver not executable

// ❌ WRONG: Multi-line values
await VFS.write("os:///sys/config/readme", "Line 1\nLine 2\nLine 3");
// → UNPROCESSABLE_ENTITY (422)

// ✅ CORRECT: Proper Sys usage
await VFS.write("os:///sys/agents/shell/status", "active");     // Control
await VFS.write("os:///memory/data/payload", bigData);          // Storage
await VFS.ingest("os:///agents/shell.md");                      // Code
```

## Integration with VFS Core

### 10.1. Registration

The Sys driver is registered with VFS Core at boot time:

```typescript
// VFS Core initialization (non-normative)
const sysDriver = new SysDriver();
await sysDriver.initialize();

vfs.registerDriver("sys/", sysDriver);
```

### 10.2. Path Routing

VFS Core routes `os:///sys/*` paths to Sys driver:

```
User calls: VFS.write("os:///sys/agents/shell/status", "active")
    │
    ▼
VFS Core strips os:/// → "sys/agents/shell/status"
    │
    ▼
VFS Core matches "sys/" prefix → route to Sys Driver
    │
    ▼
VFS Core strips "sys/" → "agents/shell/status"
    │
    ▼
VFS Core checks permissions.writable → ✅ true
    │
    ▼
VFS Core calls Sys.validate("write", "agents/shell/status", "active")
    │
    ▼
Sys.validate checks for newlines → ✅ no newlines
    │
    ▼
VFS Core calls Sys.write("agents/shell/status", "active")
    │
    ▼
Sys driver stores in backend
```

## Use Cases

### 11.1. Agent Lifecycle Management

**Problem**: Need to control agent states at runtime

**Solution**: Sys attributes for status and desired state
```typescript
// Agent reports current status
await VFS.write("os:///sys/agents/shell/status", "active");

// User requests agent shutdown
await VFS.write("os:///sys/agents/shell/lifecycle/desired_state", "stopped");

// Agent reads desired state and acts
const desiredState = await VFS.read("os:///sys/agents/shell/lifecycle/desired_state");
if (desiredState === "stopped") {
  // Graceful shutdown
}
```

### 11.2. Runtime Configuration Changes

**Problem**: Need to adjust system behavior without restart

**Solution**: Sys attributes for configuration
```typescript
// Developer enables debug mode
await VFS.write("os:///sys/system/debug_mode", "1");

// Code checks debug mode
const debugMode = await VFS.read("os:///sys/system/debug_mode");
if (debugMode === "1") {
  console.log("[DEBUG] Detailed logging enabled");
}
```

### 11.3. Feature Flag Management

**Problem**: Need to enable/disable features dynamically

**Solution**: Sys attributes for feature flags
```typescript
// Enable experimental feature
await VFS.write("os:///sys/features/experimental_llm_routing", "enabled");

// Code checks feature flag
const experimentalRouting = await VFS.read("os:///sys/features/experimental_llm_routing");
if (experimentalRouting === "enabled") {
  // Use experimental routing algorithm
}
```

## Security Considerations

* Sys attributes control system behavior - access SHOULD be restricted to privileged code
* Malicious attribute changes can affect system stability
* Implementations SHOULD log all Sys write operations for audit
* Sensitive configuration SHOULD be stored in Memory vault, not Sys

## Performance Considerations

* Sys attributes are assumed to be small and infrequently changed
* Reads MAY be cached (with expiration) to reduce backend load
* Writes SHOULD be atomic to prevent partial updates
* List operations MAY be expensive - use with care

## Future Work

* **Attribute schemas**: Define schemas for common attributes (validation beyond single-value)
* **Notifications**: Notify watchers when attributes change
* **Permissions**: Fine-grained access control per attribute
* **Transactions**: Atomic multi-attribute updates

## References

### PromptWare OS References

* RFC 0013: Kernel VFS Specification (VFS Core orchestration, driver routing)
* RFC 0024: CQRS Event Schema (error code registry)
* RFC 0026: VFS Driver Interface (contract this driver implements)

### External References

* RFC 2119, RFC 8174 (BCP 14 key words)
* Linux sysfs documentation

---

*End of RFC 0027*

---
rfc: 0028
title: Proc VFS Driver Specification
author: Huan Li, ChatGPT
status: Draft
type: Standards Track
created: 2026-01-01
updated: 2026-01-01
version: 0.1
tags: [vfs, driver, proc, introspection, procfs]
---

# RFC 0028: Proc VFS Driver Specification

## Abstract

This RFC defines the **Proc VFS Driver** for PromptWare OS: a system introspection driver that implements the VFSDriver interface (RFC-26) to provide read-only views of system state under the `os:///proc/*` namespace.

The Proc driver is inspired by Linux procfs and provides:
- **Read-only introspection**: System state views (NO writes allowed)
- **Dynamic generation**: Values MAY be generated on-demand, not pre-stored
- **Multi-line output**: Rich, human-readable formatted views
- **Belief surface**: Reflects what the system believes about its state

**Design inspiration**: Linux `/proc` filesystem (procfs) - dynamic, read-only system introspection.

## Status of This Memo

This document is a PromptWare OS RFC-style specification and may change at any time.

The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**, **SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **MAY**, and **OPTIONAL** are to be interpreted as described in BCP 14 (RFC 2119, RFC 8174).

## Terminology

* **Proc Driver**: A VFS driver implementing RFC-26 interface, handling `os:///proc/*` paths
* **Belief surface**: A view of system state that MAY differ from ground truth (represents system's belief)
* **Dynamic generation**: Values computed at read time, not stored persistently
* **Introspection view**: A read-only snapshot of system state
* **Backend**: The mechanism for generating proc views (implementation-defined)

## Motivation

### 3.1. The System Introspection Problem

PromptWare OS needs a way to:
- Expose kernel boot parameters (`proc/cmdline`)
- Provide system status summaries (`proc/system/summary`)
- Show runtime statistics (`proc/stats/uptime`)
- Display agent states (`proc/agents/{id}/status`)

Traditional approaches:
- **Sys attributes** (`os:///sys/*`): Writable control, not introspection
- **Memory KV** (`os:///memory/*`): General storage, not specifically for views
- **Dedicated APIs**: Fragmented, inconsistent interfaces

### 3.2. The Procfs Solution

Linux procfs (`/proc`) proves that:
- Read-only filesystem interface for introspection is intuitive
- Dynamic generation (no storage overhead) is efficient
- Multi-line output allows rich formatting
- Familiar `/proc` convention is developer-friendly

PromptWare Proc driver adopts these principles:
- Read-only by design (writes FORBIDDEN)
- Values MAY be generated dynamically
- Multi-line output supported (unlike Sys driver)
- Hierarchical organization for related views

## Design Goals

### Goals

The Proc driver MUST:
1. **Implement RFC-26 interface**: Full VFSDriver compliance
2. **Enforce read-only**: Write operations MUST be FORBIDDEN (403)
3. **Support dynamic generation**: Values MAY be computed at read time
4. **Allow multi-line output**: No single-value constraint (unlike Sys driver)
5. **Provide system introspection**: Expose kernel and runtime state

### Non-Goals

The Proc driver does NOT:
1. Provide writable control (use Sys driver instead)
2. Store persistent data (use Memory driver instead)
3. Guarantee real-time accuracy (values are snapshots)
4. Define specific proc paths (application-defined)

## Driver Implementation

### 5.1. VFSDriver Interface Compliance

```typescript
class ProcDriver implements VFSDriver {
  readonly name = "proc";

  readonly permissions = {
    readable: true,
    writable: false,  // Read-only
    executable: false
  };

  /**
   * Validation hook: Reject all write operations
   */
  validate(operation: string, path: string, value?: string): void {
    if (operation === "write") {
      throw new Error(
        "FORBIDDEN (403): proc/* is read-only"
      );
    }
  }

  /**
   * Read a proc view (may be dynamically generated)
   */
  async read(path: string): Promise<string> {
    // Check if generator exists for this path
    const generator = this.generators.get(path);
    if (generator) {
      return await generator();  // Dynamic generation
    }

    // Fallback to stored value (if any)
    const value = await this.backend.get(path);
    if (value === null) {
      throw new Error("NOT_FOUND (404): Proc path does not exist");
    }
    return value;
  }

  /**
   * Write operation (always rejected)
   */
  async write(path: string, value: string): Promise<void> {
    throw new Error("FORBIDDEN (403): proc/* is read-only");
  }

  /**
   * List proc paths under a prefix
   */
  async list(prefix: string): Promise<string[]> {
    const generatorPaths = Array.from(this.generators.keys())
      .filter(p => p.startsWith(prefix));
    const storedPaths = await this.backend.list({ prefix });
    return [...generatorPaths, ...storedPaths.map(e => e.key)];
  }
}
```

**Key points**:
- **Read-only**: `writable = false`, `validate()` rejects writes
- **Dynamic generation**: `read()` MAY call generator functions
- **No write method**: `write()` always throws FORBIDDEN

### 5.2. Path Semantics

**Path normalization** (inherited from VFS Core):
- VFS Core strips `os:///proc/` prefix before calling driver
- Driver operates on relative paths within proc namespace
- Leading slashes normalized by VFS Core

**Example**:
```typescript
// User calls
await VFS.read("os:///proc/cmdline");

// VFS Core routing
// 1. Strip os:/// → "proc/cmdline"
// 2. Match "proc/" prefix → route to Proc Driver
// 3. Strip "proc/" → "cmdline"

// Proc Driver receives
path = "cmdline"  // Relative to proc namespace
```

### 5.3. Hierarchical Path Organization

Proc views SHOULD be organized hierarchically:

```
os:///proc/
├── cmdline                       # Kernel boot parameters (JSON)
├── system/
│   ├── summary                   # Human-readable system overview
│   ├── uptime                    # System uptime
│   └── version                   # PromptWareOS version
├── stats/
│   ├── vfs/operations            # VFS operation counters
│   ├── memory/usage              # Memory usage stats
│   └── syscalls/count            # Syscall counters
└── agents/
    ├── {agent-id}/
    │   ├── status                # Agent status view
    │   ├── uptime                # Agent uptime
    │   └── stats                 # Agent-specific stats
    └── list                      # List of all agents
```

**Conventions** (non-normative):
- Use lowercase, underscores for multi-word names
- Group related views under common prefix
- Use semantic paths (e.g., `system/summary` not `sys/sum`)

## Read-Only Enforcement

### 6.1. Core Rule

For ALL `proc/*` paths:

* **Read operations**: Allowed
* **Write operations**: FORBIDDEN (403) - enforced via `validate()` and `permissions.writable = false`
* **Rationale**: Proc is a belief surface, not a control plane

### 6.2. Validation Hook Implementation

```typescript
validate(operation: string, path: string, value?: string): void {
  if (operation === "write") {
    throw new Error("FORBIDDEN (403): proc/* is read-only");
  }
  // Reads don't need validation
}
```

**VFS Core enforces capability check first**:
```
VFS.write("os:///proc/cmdline", "{}")
  → VFS checks permissions.writable → ❌ false
  → Throws FORBIDDEN (403)
  → validate() may not be called (capability check fails first)
```

**Validation hook provides defense in depth** (if capability check bypassed).

## Dynamic Generation

### 7.1. Generator Functions

Proc driver MAY register generator functions for dynamic views:

```typescript
class ProcDriver {
  private generators = new Map<string, () => string | Promise<string>>();

  registerGenerator(path: string, generator: () => string | Promise<string>) {
    this.generators.set(path, generator);
  }

  async read(path: string): Promise<string> {
    const generator = this.generators.get(path);
    if (generator) {
      return await generator();  // Generate on demand
    }
    // ... fallback to backend storage
  }
}
```

**Example registrations** (non-normative):
```typescript
// Kernel cmdline (read from Memory backing storage)
procDriver.registerGenerator("cmdline", async () => {
  return await Memory.Get("os/kernel/boot-params");
});

// System uptime (computed dynamically)
procDriver.registerGenerator("system/uptime", () => {
  const uptimeSeconds = (Date.now() - bootTime) / 1000;
  return `${Math.floor(uptimeSeconds)}s`;
});

// System summary (formatted view)
procDriver.registerGenerator("system/summary", async () => {
  const uptime = await VFS.read("os:///proc/system/uptime");
  const agentCount = (await VFS.list("os:///proc/agents/")).length;
  return `PromptWareOS v1.0\nUptime: ${uptime}\nAgents: ${agentCount} active`;
});
```

### 7.2. Benefits of Dynamic Generation

**Advantages**:
- No storage overhead (computed on demand)
- Always current (no stale data)
- Can aggregate from multiple sources
- Can format output dynamically

**Trade-offs**:
- Computation cost on every read
- Consistency not guaranteed across reads (values may change)

**Recommendation**: Use dynamic generation for:
- Computed stats (uptime, counters)
- Aggregated views (summaries)
- Formatted output (reports)

Use backend storage for:
- Static configuration (cmdline)
- Expensive-to-compute views (cache them)

## Backend Storage

### 8.1. Backend Interface (Implementation-Defined)

The Proc driver backend is **implementation-defined**. Common approaches:

**Option 1: Hybrid (generators + storage)**:
```typescript
class ProcDriver {
  private generators = new Map<string, () => Promise<string>>();
  private kv: Deno.Kv;

  async read(path: string): Promise<string> {
    // Check generator first
    const generator = this.generators.get(path);
    if (generator) {
      return await generator();
    }

    // Fallback to KV storage
    const key = `proc/${path}`;
    const entry = await this.kv.get([key]);
    if (entry.value === null) throw new Error("NOT_FOUND (404)");
    return entry.value as string;
  }
}
```

**Option 2: Pure generators** (no storage):
```typescript
class ProcDriver {
  private generators = new Map<string, () => string>();

  async read(path: string): Promise<string> {
    const generator = this.generators.get(path);
    if (!generator) throw new Error("NOT_FOUND (404)");
    return generator();
  }
}
```

**Option 3: Delegate to Memory driver**:
```typescript
class ProcDriver {
  async read(path: string): Promise<string> {
    if (path === "cmdline") {
      return await VFS.read("os:///memory/os/kernel/boot-params");
    }
    // ... other paths
  }
}
```

### 8.2. Persistence

Proc views are generally **ephemeral** (not persisted across restarts), except:
- `cmdline`: Backed by kernel boot parameters (persisted in Memory driver)
- Cached views: MAY be persisted for performance

**Recommendation**: Proc driver SHOULD NOT persist most views. Use dynamic generation.

## Error Handling

### 9.1. Error Code References

Proc driver operations reference the following error codes (defined in RFC-24):

| Error Code | HTTP | Condition | Recovery |
|------------|------|-----------|----------|
| `FORBIDDEN` | 403 | Attempt to write to proc/* | Use Sys driver for control |
| `NOT_FOUND` | 404 | Proc path doesn't exist | Check path spelling |
| `INTERNAL_SERVER_ERROR` | 500 | Generator failure | Check generator implementation |

### 9.2. Validation Order

When processing operations:

**Read operation**:
1. **VFS Core validation**: Check path scheme (`os:///`), route to driver
2. **VFS Core capability check**: Ensure driver is readable
3. **Driver operation**: `ProcDriver.read(path)`
   - Check generator registry
   - Call generator OR fetch from backend
   - Return value

**Write operation**:
1. **VFS Core validation**: Check path scheme
2. **VFS Core capability check**: Ensure driver is writable → ❌ FAILS (writable = false)
3. **Throws FORBIDDEN** (403)

### 9.3. Error Examples

```typescript
// Attempt to write (forbidden)
await VFS.write("os:///proc/cmdline", "{}");
// → VFS checks permissions.writable → ❌ false
// → Throws FORBIDDEN (403)

// Read non-existent path
await VFS.read("os:///proc/nonexistent");
// → Proc.read() throws NOT_FOUND (404)

// Valid read (dynamic generation)
const cmdline = await VFS.read("os:///proc/cmdline");
// ✅ Returns kernel parameters JSON

// Valid read (multi-line output)
const summary = await VFS.read("os:///proc/system/summary");
// ✅ Returns multi-line system overview
```

## Examples (Non-Normative)

### Example 1: Kernel Cmdline

```typescript
// Read kernel boot parameters
const cmdline = await VFS.read("os:///proc/cmdline");
const params = JSON.parse(cmdline);
// Returns:
// {
//   "root": "https://github.com/.../os/",
//   "origin": "my-os",
//   "init": "os:///agents/shell.md",
//   "mounts": { ... }
// }

// Attempt to modify cmdline (forbidden)
await VFS.write("os:///proc/cmdline", "{}");
// ❌ Throws FORBIDDEN (403)
```

### Example 2: System Summary (Multi-Line)

```typescript
// Read system summary (formatted, multi-line)
const summary = await VFS.read("os:///proc/system/summary");
console.log(summary);
// Output:
// PromptWareOS v1.0
// Uptime: 3h 42m
// Agents: 2 active
// Memory: 128MB used
// VFS Operations: 1,542 total
```

### Example 3: Agent Status View

```typescript
// Read agent status view
const agentStatus = await VFS.read("os:///proc/agents/shell/status");
// Returns: "active" (or multi-line formatted view)

// List all agents
const agents = await VFS.list("os:///proc/agents/");
// Returns: ["agents/shell/status", "agents/manager/status", ...]
```

### Example 4: System Stats

```typescript
// Read uptime
const uptime = await VFS.read("os:///proc/system/uptime");
// Returns: "13572s"

// Read VFS operation count
const vfsOps = await VFS.read("os:///proc/stats/vfs/operations");
// Returns: "1542"

// Read memory usage
const memUsage = await VFS.read("os:///proc/stats/memory/usage");
// Returns: "128MB" (or multi-line breakdown)
```

### Example 5: Dynamic Generation Example

```typescript
// Generator registered at initialization
procDriver.registerGenerator("system/summary", async () => {
  const uptime = await VFS.read("os:///proc/system/uptime");
  const agents = await VFS.list("os:///proc/agents/");
  const vfsOps = await VFS.read("os:///proc/stats/vfs/operations");

  return `PromptWareOS v1.0
Uptime: ${uptime}
Agents: ${agents.length} active
VFS Operations: ${vfsOps} total`;
});

// Each read generates fresh view
const summary1 = await VFS.read("os:///proc/system/summary");
// ... time passes, stats change ...
const summary2 = await VFS.read("os:///proc/system/summary");
// summary2 reflects updated stats
```

### Example 6: Incorrect Usage (Anti-Patterns)

```typescript
// ❌ WRONG: Attempting to write to proc
await VFS.write("os:///proc/system/summary", "hacked");
// → FORBIDDEN (403)

// ❌ WRONG: Using Proc for storage (use Memory)
await VFS.write("os:///proc/data/cache", bigData);
// → FORBIDDEN (403) - Proc is read-only

// ❌ WRONG: Using Proc for control (use Sys)
await VFS.write("os:///proc/agents/shell/status", "stopped");
// → FORBIDDEN (403) - use os:///sys/* for control

// ✅ CORRECT: Proper usage
await VFS.read("os:///proc/cmdline");                          // Introspection
await VFS.write("os:///sys/agents/shell/status", "active");    // Control (Sys)
await VFS.write("os:///memory/data/cache", bigData);           // Storage (Memory)
```

## Integration with VFS Core

### 11.1. Registration

The Proc driver is registered with VFS Core at boot time:

```typescript
// VFS Core initialization (non-normative)
const procDriver = new ProcDriver();
await procDriver.initialize();

// Register generators for built-in views
procDriver.registerGenerator("cmdline", async () => {
  return await VFS.read("os:///memory/os/kernel/boot-params");
});

procDriver.registerGenerator("system/uptime", () => {
  return `${Math.floor((Date.now() - bootTime) / 1000)}s`;
});

vfs.registerDriver("proc/", procDriver);
```

### 11.2. Path Routing

VFS Core routes `os:///proc/*` paths to Proc driver:

```
User calls: VFS.read("os:///proc/cmdline")
    │
    ▼
VFS Core strips os:/// → "proc/cmdline"
    │
    ▼
VFS Core matches "proc/" prefix → route to Proc Driver
    │
    ▼
VFS Core strips "proc/" → "cmdline"
    │
    ▼
VFS Core checks permissions.readable → ✅ true
    │
    ▼
VFS Core calls Proc.read("cmdline")
    │
    ▼
Proc driver checks generators → Found "cmdline"
    │
    ▼
Proc driver calls generator()
    │
    ▼
Generator fetches from Memory → returns kernel params JSON
```

### 11.3. Kernel Initialization

For complete kernel boot sequence, see **RFC 0015 Section 9**.

The Proc-specific initialization steps are:

```typescript
// 1. Initialize Proc driver
const procDriver = new ProcDriver();

// 2. Register generators for kernel views
procDriver.registerGenerator("cmdline", async () => {
  return await VFS.read("os:///memory/os/kernel/boot-params");
});

// 3. Register with VFS
vfs.registerDriver("proc/", procDriver);

// 4. Proc views now accessible
const cmdline = await VFS.read("os:///proc/cmdline");
```

## Use Cases

### 12.1. Kernel Parameter Introspection

**Problem**: Need to read kernel boot parameters at runtime

**Solution**: `proc/cmdline` view
```typescript
const cmdline = await VFS.read("os:///proc/cmdline");
const params = JSON.parse(cmdline);
console.log(`Root URL: ${params.root}`);
console.log(`Origin: ${params.origin}`);
```

### 12.2. System Status Dashboard

**Problem**: Need human-readable system overview

**Solution**: `proc/system/summary` view (multi-line formatted)
```typescript
const summary = await VFS.read("os:///proc/system/summary");
console.log(summary);
// PromptWareOS v1.0
// Uptime: 3h 42m
// Agents: 2 active
// Memory: 128MB used
```

### 12.3. Debugging and Diagnostics

**Problem**: Need to inspect runtime statistics for debugging

**Solution**: `proc/stats/*` views
```typescript
const vfsOps = await VFS.read("os:///proc/stats/vfs/operations");
const memUsage = await VFS.read("os:///proc/stats/memory/usage");
const syscalls = await VFS.read("os:///proc/stats/syscalls/count");
console.log(`VFS Ops: ${vfsOps}, Memory: ${memUsage}, Syscalls: ${syscalls}`);
```

## Security Considerations

* Proc views expose system internals - implementations MAY restrict access to sensitive views
* Generators MUST NOT modify system state (read-only principle)
* Dynamic generation MAY reveal timing information through performance
* Sensitive data SHOULD NOT be exposed in proc views (use access control if needed)

## Performance Considerations

* Dynamic generation has computation cost on every read
* Generators SHOULD be fast (avoid expensive computations)
* Caching MAY be implemented for expensive views
* List operations over many generators MAY be slow

## Relationship to Sys Driver

| Aspect | Proc Driver | Sys Driver |
|--------|-------------|------------|
| **Purpose** | Introspection (belief surface) | Control (command interface) |
| **Operations** | Read-only | Read-write |
| **Multi-line** | Allowed | Forbidden (single-value only) |
| **Dynamic generation** | Encouraged | Rare |
| **Use case** | "What is the system state?" | "Change the system state" |

**Example**:
```typescript
// Proc: Read agent status view (introspection)
const statusView = await VFS.read("os:///proc/agents/shell/status");

// Sys: Control agent status (command)
await VFS.write("os:///sys/agents/shell/status", "active");
```

## Future Work

* **Permissions**: Fine-grained access control per proc path
* **Streaming**: Support for long-running generators (e.g., logs)
* **Subscriptions**: Notify watchers when generated values change
* **Caching**: Automatic caching layer for expensive generators

## References

### PromptWare OS References

* RFC 0013: Kernel VFS Specification (VFS Core orchestration, driver routing)
* RFC 0015: Kernel Dualmode Architecture (kernel parameters, boot sequence)
* RFC 0024: CQRS Event Schema (error code registry)
* RFC 0026: VFS Driver Interface (contract this driver implements)
* RFC 0027: Sys VFS Driver (comparison: control vs introspection)

### External References

* RFC 2119, RFC 8174 (BCP 14 key words)
* Linux procfs documentation

---

*End of RFC 0028*

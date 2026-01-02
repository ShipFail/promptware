---
rfc: 0029
title: Code VFS Driver Specification
author: Huan Li, ChatGPT
status: Draft
type: Standards Track
created: 2026-01-01
updated: 2026-01-01
version: 0.1
tags: [vfs, driver, code, mount, ingestion]
---

# RFC 0029: Code VFS Driver Specification

## Abstract

This RFC defines the **Code VFS Driver** for PromptWare OS: a code ingestion driver that implements the VFSDriver interface (RFC-26) to provide mount-based code loading under the `os:///` namespace.

The Code driver provides:
- **Mount table resolution**: Maps VFS paths to HTTPS/file:// URLs
- **Code ingestion**: Special `ingest()` operation for loading agent/skill code
- **Catch-all routing**: Handles all paths not matching reserved prefixes (`memory/`, `sys/`, `proc/`)
- **Read support**: Allows reading source code as text (not just ingestion)

**Key Design**: Code driver uses mount table from kernel parameters to resolve VFS paths to physical URLs, enabling portable code references across deployments.

## Status of This Memo

This document is a PromptWare OS RFC-style specification and may change at any time.

The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**, **SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **MAY**, and **OPTIONAL** are to be interpreted as described in BCP 14 (RFC 2119, RFC 8174).

## Terminology

* **Code Driver**: A VFS driver implementing RFC-26 interface, handling code paths under `os:///`
* **Mount Table**: A mapping from VFS path prefixes to base URLs (HTTPS or file://)
* **Root Mount**: The default base URL (from kernel parameter `root`) used when no specific mount matches
* **Mount Resolution**: The process of converting a VFS path to a physical URL
* **Ingest Operation**: Loading code into execution context (special operation beyond read)
* **Catch-all Driver**: Default driver that handles paths not matching other drivers' prefixes

## Motivation

### 3.1. The Code Portability Problem

PromptWare OS needs a way to reference code without hardcoding URLs:

**Without mount table** (brittle):
```typescript
await pwosIngest("https://raw.githubusercontent.com/ShipFail/promptware/main/os/agents/shell.md");
```

**With mount table** (portable):
```typescript
await pwosIngest("os:///promptware/agents/shell.md");
// VFS resolves → https://raw.githubusercontent.com/.../agents/shell.md
```

### 3.2. Requirements

1. **Portable code references**: VFS paths work across dev/staging/prod
2. **Multi-repository support**: Mount multiple code sources
3. **Local development**: Mount `file://` paths for testing
4. **Flexible sourcing**: Change URLs without changing code

### 3.3. Linux Analogy: /etc/fstab

Linux mounts filesystems via `/etc/fstab`:
```
/dev/sda1  /       ext4  defaults  0 0
/dev/sda2  /home   ext4  defaults  0 0
```

PromptWare mounts code repositories via kernel parameters:
```typescript
{
  root: "https://github.com/.../promptware/os/",
  mounts: {
    "/ship-fail-crew/": "https://github.com/.../crew/"
  }
}
```

## Design Goals

### Goals

The Code driver MUST:
1. **Implement RFC-26 interface**: Full VFSDriver compliance
2. **Resolve VFS paths to URLs**: Use mount table + root fallback
3. **Support HTTPS and file:// URLs**: Production and development
4. **Provide ingest operation**: Special code loading beyond read
5. **Be the catch-all driver**: Handle all non-reserved paths
6. **Support read operations**: Allow reading source code as text

### Non-Goals

The Code driver does NOT:
1. Own the mount table (kernel owns it, driver uses it)
2. Implement code parsing (delegated to pwosIngest implementation)
3. Provide write operations (code is immutable)
4. Handle memory, sys, or proc paths (other drivers)

## Driver Implementation

### 5.1. VFSDriver Interface Compliance

```typescript
class CodeDriver implements VFSDriver {
  readonly name = "code";

  readonly permissions = {
    readable: true,      // Can read source code as text
    writable: false,     // Code is immutable
    executable: true     // Primary purpose: ingest for execution
  };

  private root: string;               // From kernel params
  private mounts: Record<string, string>;  // From kernel params

  constructor(root: string, mounts: Record<string, string>) {
    this.root = root;
    this.mounts = mounts;
  }

  /**
   * Read source code as text
   */
  async read(path: string): Promise<string> {
    const url = this.resolve(path);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`BAD_GATEWAY (502): Failed to fetch ${url}`);
    }
    return await response.text();
  }

  /**
   * Ingest code (load into execution context)
   * This is the primary operation for code
   */
  async ingest(path: string): Promise<void> {
    const url = this.resolve(path);
    // Fetch source code
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`BAD_GATEWAY (502): Failed to fetch ${url}`);
    }
    const source = await response.text();

    // Parse and load (implementation-defined)
    // See RFC 0020 for pwosIngest pipeline details
    await this.parseAndLoad(source, url);
  }

  /**
   * Resolve VFS path to physical URL
   */
  private resolve(path: string): string {
    // Normalize path (remove leading slash if present)
    const normalized = path.startsWith("/") ? path.slice(1) : path;

    // Find longest matching mount
    const mountEntries = Object.entries(this.mounts)
      .sort((a, b) => b[0].length - a[0].length);  // Longest first

    for (const [prefix, baseUrl] of mountEntries) {
      const normalizedPrefix = prefix.startsWith("/")
        ? prefix.slice(1)
        : prefix;

      if (normalized.startsWith(normalizedPrefix)) {
        // Match found - strip prefix and append to base URL
        const relativePath = normalized.slice(normalizedPrefix.length);
        return this.joinUrl(baseUrl, relativePath);
      }
    }

    // No mount match - use root
    return this.joinUrl(this.root, normalized);
  }

  /**
   * Join base URL with relative path
   */
  private joinUrl(base: string, relative: string): string {
    // Ensure base ends with / and relative doesn't start with /
    const normalizedBase = base.endsWith("/") ? base : `${base}/`;
    const normalizedRelative = relative.startsWith("/")
      ? relative.slice(1)
      : relative;
    return `${normalizedBase}${normalizedRelative}`;
  }
}
```

**Key points**:
- **Readable + Executable**: Can read source text AND ingest for execution
- **Mount table**: Passed via constructor from kernel parameters
- **Resolution**: Longest-prefix matching, fallback to root
- **No write**: Code is immutable (writable = false)

### 5.2. Path Semantics

**Path normalization** (inherited from VFS Core):
- VFS Core strips `os:///` prefix before calling driver
- Code driver receives relative paths within os namespace
- Code driver handles catch-all (no additional prefix stripping needed)

**Example**:
```typescript
// User calls
await VFS.ingest("os:///agents/shell.md");

// VFS Core routing
// 1. Strip os:/// → "agents/shell.md"
// 2. Check prefixes: not memory/, sys/, proc/
// 3. Route to Code Driver (catch-all)

// Code Driver receives
path = "agents/shell.md"  // No prefix to strip
```

### 5.3. Catch-All Routing

Code driver is the **default driver** - handles all paths not matching reserved prefixes:

**Reserved prefixes** (handled by other drivers):
- `memory/` → Memory Driver (RFC-18)
- `sys/` → Sys Driver (RFC-27)
- `proc/` → Proc Driver (RFC-28)

**Everything else** → Code Driver:
- `agents/*`
- `skills/*`
- `kernel/*`
- `ship-fail-crew/*`
- Any custom path

**Rationale**: Simpler routing, no need to enumerate code path patterns.

## Mount Table Resolution

### 6.1. Mount Table Schema

Mount table is part of kernel parameters:

```typescript
interface KernelParameters {
  root: string;  // Default base URL (fallback)
  mounts?: Record<string, string>;  // Optional additional mounts
  // ... other parameters
}
```

**Example**:
```typescript
{
  root: "https://github.com/ShipFail/promptware/raw/main/os/",
  mounts: {
    "/ship-fail-crew/": "https://github.com/ship-fail/crew/raw/main/",
    "/local-dev/": "file:///workspaces/promptware/dev/"
  }
}
```

### 6.2. Resolution Algorithm

Given a VFS path `P` (e.g., `ship-fail-crew/agents/bridge.md`):

1. **Normalize path**: Strip leading `/` if present
2. **Find longest prefix match**: Iterate mount table entries, sorted by prefix length (longest first)
3. **If match found**:
   - Base URL = matched mount's base URL
   - Relative path = strip matched prefix from path
   - Result = base URL + relative path
4. **If no match**:
   - Base URL = root parameter
   - Relative path = full path
   - Result = root + full path

**Examples**:

```typescript
// Mount table
const config = {
  root: "https://github.com/ShipFail/promptware/raw/main/os/",
  mounts: {
    "/ship-fail-crew/": "https://github.com/ship-fail/crew/raw/main/"
  }
};

// Resolution examples
resolve("agents/shell.md")
// → No mount match → use root
// → "https://github.com/ShipFail/promptware/raw/main/os/agents/shell.md"

resolve("ship-fail-crew/agents/bridge.md")
// → Match "/ship-fail-crew/" mount
// → Strip prefix → "agents/bridge.md"
// → "https://github.com/ship-fail/crew/raw/main/agents/bridge.md"

resolve("/ship-fail-crew/agents/bridge.md")
// → Normalized to "ship-fail-crew/agents/bridge.md"
// → Same as above
```

### 6.3. Root Fallback

The `root` parameter acts as the **default mount** (equivalent to `/` mount).

**Design principle**: DRY - root should NOT be duplicated in mounts table.

**Example** (correct):
```typescript
{
  root: "https://github.com/.../os/",
  mounts: {
    "/extensions/": "https://github.com/.../extensions/"
  }
}
```

**Example** (incorrect - duplication):
```typescript
{
  root: "https://github.com/.../os/",
  mounts: {
    "/": "https://github.com/.../os/",  // ❌ Redundant
    "/extensions/": "https://github.com/.../extensions/"
  }
}
```

### 6.4. URL Schemes

Code driver MUST support:
- **HTTPS URLs**: Production deployments (e.g., `https://github.com/...`)
- **file:// URLs**: Local development (e.g., `file:///workspaces/...`)

Code driver MUST reject:
- **http:// URLs**: Insecure (unless explicitly allowed for dev)
- **Other schemes**: Not applicable to code fetching

## Integration with VFS Core

### 7.1. Initialization

Code driver is initialized by kernel during boot:

```typescript
// Kernel initialization (after Memory is ready)
const bootParams: KernelParameters = {
  root: "https://github.com/.../os/",
  origin: "my-os",
  mounts: {
    "/ship-fail-crew/": "https://github.com/.../crew/"
  }
};

// Store boot params in Memory
await Memory.Set("os/kernel/boot-params", JSON.stringify(bootParams));

// Initialize Code driver with mount config
const codeDriver = new CodeDriver(bootParams.root, bootParams.mounts || {});

// Register Code driver as catch-all (empty prefix = default)
vfs.registerDriver("", codeDriver);
```

**Key points**:
- Code driver initialized BEFORE registration
- Mount table from kernel parameters (not from Proc driver - avoids circular dependency)
- Registered with empty prefix (`""`) = catch-all / default driver

### 7.2. Path Routing

VFS Core routes to Code driver when no other driver matches:

```
User calls: VFS.ingest("os:///agents/shell.md")
    │
    ▼
VFS Core strips os:/// → "agents/shell.md"
    │
    ▼
VFS Core checks prefixes:
  - memory/? No
  - sys/? No
  - proc/? No
  - Default driver (Code)? YES
    │
    ▼
VFS Core routes to Code Driver (no prefix to strip)
    │
    ▼
Code Driver receives: "agents/shell.md"
    │
    ▼
Code Driver resolves via mount table
    │
    ▼
Code Driver fetches from HTTPS/file:// URL
```

## Read vs Ingest Operations

### 8.1. Read Operation

**Purpose**: Read source code as text (useful for debugging, inspection)

**Example**:
```typescript
// Read source code as text
const sourceCode = await VFS.read("os:///agents/shell.md");
console.log(sourceCode);  // Raw markdown content
```

**Use cases**:
- Debugging: Inspect code before ingestion
- Tooling: Code analysis, linting
- Documentation: Extract metadata from source

### 8.2. Ingest Operation

**Purpose**: Load code into execution context (primary operation)

**Example**:
```typescript
// Ingest code (load capability)
await VFS.ingest("os:///agents/shell.md");
// Code is now loaded, agent adopted
```

**Lifecycle** (see RFC 0020 for details):
1. Fetch source code (via URL resolution)
2. Parse source (extract metadata, validate)
3. Load into execution context
4. Update context register (`__filename`)

### 8.3. Semantic Difference

**Read**: Returns source text, no side effects
**Ingest**: Loads code, updates execution context, side effects

**Both use same URL resolution** - difference is what happens after fetch.

## Error Handling

### 9.1. Error Code References

Code driver operations reference the following error codes (defined in RFC-24):

| Error Code | HTTP | Condition | Recovery |
|------------|------|-----------|----------|
| `BAD_REQUEST` | 400 | Invalid VFS path format | Check path syntax |
| `NOT_FOUND` | 404 | No mount matches AND root undefined | Check mount table |
| `BAD_GATEWAY` | 502 | URL fetch failed (network, 404) | Check URL accessibility |
| `INTERNAL_SERVER_ERROR` | 500 | Mount table misconfiguration | Check kernel parameters |

### 9.2. Validation Order

When processing an ingest operation:

1. **VFS Core validation**: Check path scheme (`os:///`), route to driver
2. **VFS Core capability check**: Ensure driver is executable
3. **Driver operation**: `CodeDriver.ingest(path)`
4. **Mount resolution**: Find matching mount or use root
5. **URL validation**: Ensure resolved URL is HTTPS or file://
6. **Fetch**: Retrieve source code from URL
7. **Parse and load**: Process source code (RFC 0020)

### 9.3. Error Examples

```typescript
// URL fetch failed (network error)
await VFS.ingest("os:///agents/nonexistent.md");
// → Code driver resolves to https://.../agents/nonexistent.md
// → fetch() fails with 404
// → Throws BAD_GATEWAY (502)

// No mount match and no root (misconfiguration)
// Should never happen in practice - root is always present
await VFS.ingest("os:///agents/shell.md");
// → No mount matches "agents/"
// → Try to use root → root is undefined
// → Throws NOT_FOUND (404)

// Valid ingest (production)
await VFS.ingest("os:///agents/shell.md");
// ✅ Resolves → https://.../agents/shell.md
// ✅ Fetches source
// ✅ Loads into context

// Valid read (debugging)
const source = await VFS.read("os:///agents/shell.md");
// ✅ Returns source text
```

## Examples (Non-Normative)

### Example 1: Production Mount Configuration

```typescript
// Production kernel parameters
const prodParams = {
  root: "https://github.com/ShipFail/promptware/raw/v1.0.0/os/",
  origin: "production",
  mounts: {
    "/ship-fail-crew/": "https://github.com/ship-fail/crew/raw/v1.0.0/"
  }
};

// Ingest core agent
await VFS.ingest("os:///agents/shell.md");
// Resolves to: https://github.com/ShipFail/promptware/raw/v1.0.0/os/agents/shell.md

// Ingest crew extension
await VFS.ingest("os:///ship-fail-crew/agents/bridge.md");
// Resolves to: https://github.com/ship-fail/crew/raw/v1.0.0/agents/bridge.md
```

**Note**: Uses pinned version tags (`v1.0.0`) for immutability.

### Example 2: Development Mount Configuration

```typescript
// Development kernel parameters
const devParams = {
  root: "file:///workspaces/promptware/os/",
  origin: "dev",
  mounts: {
    "/ship-fail-crew/": "file:///workspaces/crew/"
  }
};

// Ingest from local filesystem
await VFS.ingest("os:///agents/shell.md");
// Resolves to: file:///workspaces/promptware/os/agents/shell.md

// Ingest from local crew directory
await VFS.ingest("os:///ship-fail-crew/agents/bridge.md");
// Resolves to: file:///workspaces/crew/agents/bridge.md
```

### Example 3: Multi-Repository Setup

```typescript
// Multi-repo configuration
const multiRepoParams = {
  root: "https://github.com/ShipFail/promptware/raw/main/os/",
  mounts: {
    "/ship-fail-crew/": "https://github.com/ship-fail/crew/raw/main/",
    "/extensions/": "https://github.com/my-org/extensions/raw/main/",
    "/local-dev/": "file:///workspaces/local-dev/"
  }
};

// Core OS code
await VFS.ingest("os:///agents/shell.md");
// → https://github.com/ShipFail/promptware/raw/main/os/agents/shell.md

// Crew extension
await VFS.ingest("os:///ship-fail-crew/agents/bridge.md");
// → https://github.com/ship-fail/crew/raw/main/agents/bridge.md

// Third-party extension
await VFS.ingest("os:///extensions/analytics/tracker.md");
// → https://github.com/my-org/extensions/raw/main/analytics/tracker.md

// Local development code
await VFS.ingest("os:///local-dev/experimental/feature.md");
// → file:///workspaces/local-dev/experimental/feature.md
```

### Example 4: Read vs Ingest

```typescript
// Read source code as text (debugging)
const shellSource = await VFS.read("os:///agents/shell.md");
console.log("Source code:", shellSource);
// Returns: "# Shell Agent\n\n..."
// No execution context changes

// Ingest code (load capability)
await VFS.ingest("os:///agents/shell.md");
// Fetches same source
// Parses and loads into execution context
// Updates __filename context register
// Agent now active
```

### Example 5: Version Pinning

```typescript
// ✅ RECOMMENDED: Pinned commits/tags (production)
{
  root: "https://github.com/ShipFail/promptware/raw/abc123def456/os/",
  // OR
  root: "https://github.com/ShipFail/promptware/raw/v1.0.0/os/"
}

// ⚠️ ALLOWED: Branch references (development)
{
  root: "https://github.com/ShipFail/promptware/raw/main/os/"
}

// ❌ DISCOURAGED: No version (latest)
{
  root: "https://github.com/ShipFail/promptware/raw/HEAD/os/"
}
```

**Recommendation**: Production deployments SHOULD use pinned commits or tags to ensure immutability.

### Example 6: Relative Path Resolution

```typescript
// In os:///agents/shell.md, reference relative skill
// ../skills/terminal.md resolves to os:///skills/terminal.md

// Context register: __filename = "os:///agents/shell.md"
await VFS.ingest("../skills/terminal.md");
// Resolves to: os:///skills/terminal.md
// Then resolves via mount table to HTTPS URL
```

**Note**: Relative path resolution uses context register (`__filename`) - see RFC 0015 for details.

### Example 7: Incorrect Usage (Anti-Patterns)

```typescript
// ❌ WRONG: Using Read tool on VFS path (should use VFS.read)
await Read("os:///agents/shell.md");
// → Should use VFS.read() or VFS.ingest()

// ❌ WRONG: Attempting to write code (immutable)
await VFS.write("os:///agents/shell.md", updatedSource);
// → FORBIDDEN (403): Code driver not writable

// ❌ WRONG: Using Code driver for data storage
await VFS.write("os:///data/cache.json", bigData);
// → FORBIDDEN (403): Use Memory driver for storage

// ✅ CORRECT: Proper Code driver usage
await VFS.ingest("os:///agents/shell.md");           // Ingest code
const source = await VFS.read("os:///agents/shell.md"); // Read source
await VFS.write("os:///memory/cache", bigData);      // Storage (Memory)
```

## Mount Table Ownership

### 10.1. Kernel Ownership (Linux fstab Analogy)

**Linux**: `/etc/fstab` owned by system, mounted by kernel

**PromptWare**: Mount table in kernel parameters, used by Code driver

**NOT owned by**:
- Code driver (driver uses it, doesn't own it)
- Proc driver (proc exposes view, doesn't own source)
- VFS Core (VFS routes, doesn't own config)

**Owned by**: Kernel (via bootloader parameters)

### 10.2. Configuration Source

Mount table comes from:
1. **Bootloader**: Provides kernel parameters (RFC 0014)
2. **Kernel**: Stores in internal storage (Memory)
3. **Code driver**: Reads from kernel during initialization

**Flow**:
```
Bootloader provides params
    ↓
Kernel stores params in Memory
    ↓
Kernel initializes Code driver with mount table
    ↓
Code driver uses mount table for resolution
    ↓
Proc driver exposes params view (read-only)
```

### 10.3. Future: Dynamic Remounting

**v0.6**: Mount table is static (initialized at boot)

**Future**: May support dynamic remounting:
```typescript
// Future API (non-normative)
await VFS.remount("/new-extension/", "https://github.com/.../");
```

Similar to Linux `mount` command after boot.

## Security Considerations

* HTTPS URLs SHOULD use pinned versions (commits/tags) in production
* `file://` mounts should be restricted to development environments
* Code driver MUST validate resolved URLs are HTTPS or file:// only
* URL fetch failures SHOULD be logged for security monitoring

## Performance Considerations

* Mount resolution is O(n) where n = number of mounts (typically small)
* Longest-prefix matching requires sorting (cache sorted order)
* URL fetches are network-dependent (HTTPS) or fast (file://)
* Code driver MAY implement caching (not specified in this RFC)

## Relationship to Other Drivers

| Driver | Namespace | Relationship |
|--------|-----------|--------------|
| **Memory** | `os:///memory/*` | Separate - handles KV storage |
| **Sys** | `os:///sys/*` | Separate - handles control attributes |
| **Proc** | `os:///proc/*` | Separate - exposes cmdline view of mount config |
| **Code** | Everything else | Catch-all - default driver |

**No overlap**: Each driver has distinct namespace, Code is catch-all for remainder.

## Future Work

* **Caching**: Cache fetched source code for performance
* **Signed code**: Cryptographic verification before ingest
* **Dynamic remounting**: Change mounts at runtime
* **Mount metadata**: Versioning, checksums in mount table
* **Lazy loading**: Fetch code on-demand vs preload

## References

### PromptWare OS References

* RFC 0013: Kernel VFS Specification (VFS Core orchestration, driver routing)
* RFC 0014: Bootloader Specification (kernel parameter provision)
* RFC 0015: Kernel Dualmode Architecture (kernel init sequence, context register)
* RFC 0020: Dependency Metadata Hydration (pwosIngest pipeline details)
* RFC 0024: CQRS Event Schema (error code registry)
* RFC 0026: VFS Driver Interface (contract this driver implements)

### External References

* RFC 2119, RFC 8174 (BCP 14 key words)
* Linux mount(2) and fstab(5) documentation

---

*End of RFC 0029*

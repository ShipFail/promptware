---
rfc: 0013
title: Kernel VFS Specification
author: Huan Li, ChatGPT 5.2 Thinking
status: Draft
type: Standards Track
created: 2025-12-20
updated: 2026-01-01
version: 0.5
tags: [vfs, kernel, mount, os]
---

# RFC 0013: Kernel VFS Specification

## 1. Abstract

This RFC defines the **Virtual File System (VFS)** for PromptWar̊e ØS: a mount-based abstraction layer that maps logical VFS paths (`os:///`) to physical URLs (HTTPS or file://) for code ingestion.

The VFS provides mount-based resolution for three categories of `os:///` paths:
1. **Immutable code** (agents, skills, kernel) - resolved to HTTPS/file:// URLs
2. **System control plane** (`os:///sys/*`) - writable single-value attributes
3. **System belief surface** (`os:///proc/*`) - read-only introspection views

Runtime key-value storage uses `memory:///` (see RFC 0018).

**Scope:**
- Mount table definition and resolution algorithm
- VFS path (`os:///`) to URL translation
- Integration with `pwosIngest()` syscall
- Security constraints (HTTPS pinning, read-only enforcement)

**Out of scope:**
- Runtime key-value storage (see RFC 0018: Memory Subsystem for vault and general KV)

---

## 2. Motivation

### 2.1. The Code vs State Separation Problem

PromptWar̊e ØS enforces a strict separation between:
- **Code** (immutable system resources: agents, skills, kernel)
- **State** (mutable runtime data: configuration, secrets, control state)

In traditional operating systems, both live in filesystems. In PromptWar̊e ØS:
- **Code** lives at HTTPS URLs (GitHub repos, CDNs) or local files
- **State** lives in the Memory subsystem (RFC 0018)

However, hardcoding URLs like `https://github.com/.../agents/shell.md` in every ingest call is brittle and non-composable.

### 2.2. The VFS Solution

The VFS provides a **logical-to-physical mapping layer**:

```typescript
// Without VFS (brittle)
await pwosIngest("https://raw.githubusercontent.com/ShipFail/promptware/main/os/agents/shell.md");

// With VFS (composable)
await pwosIngest("os:///promptware/agents/shell.md");
// VFS resolves → https://raw.githubusercontent.com/.../agents/shell.md
```

This enables:
1. **Portable code**: VFS paths work across deployments
2. **Flexible sourcing**: Change mount URLs without changing code
3. **Multi-tenant**: Different origins can mount different repositories
4. **Local development**: Mount `file://` paths for testing

### 2.3. Lessons from UNIX mount(2)

UNIX mount(2) has proven that:
- Mount tables are powerful abstraction layers
- Path-based resolution is intuitive for developers
- Read-only mounts prevent accidental writes to code

PromptWar̊e ØS adopts these principles but simplifies:
- **No filesystem drivers**: VFS resolves to URLs, not block devices
- **No write operations**: VFS is read-only by design
- **No complex permissions**: HTTPS/file:// handle access control

---

## 3. Goals & Non-Goals

### Goals

The VFS MUST:
1. Map logical path prefixes to physical URLs (HTTPS or file://)
2. Support deterministic path resolution (same path → same URL)
3. Integrate with `pwosIngest()` for code loading
4. Enforce read-only semantics (no writes to VFS paths)
5. Support multi-repository mounting (main OS + user extensions)
6. Store mount table in `memory:///proc/cmdline` (as part of kernel parameters)

### Non-Goals

The VFS does NOT:
1. Handle runtime key-value storage (use `memory:///` for vault and general KV)
2. Implement filesystem operations (stat, readdir) for code paths - URL fetch only
3. Provide sandboxing or access control (delegated to HTTPS/file:// transport)
4. Support symbolic links, hardlinks, or other filesystem features

---

## 4. Detailed Design

### 4.1. Terminology

* **VFS Path**: A logical path used in `pwosIngest()` calls (e.g., `os:///promptware/agents/shell.md`)
* **Mount Point**: A path prefix that maps to a base URL (e.g., `/promptware/` → `https://github.com/.../`)
* **Mount Table**: A mapping of mount points to base URLs, stored in `memory:///proc/cmdline`
* **Resolution**: The process of translating a VFS path to a physical URL
* **Ingest**: The operation of fetching and loading code via `pwosIngest()`

### 4.2. Mount Table Schema

The mount table is stored as part of the kernel parameters in `memory:///proc/cmdline`.

**Schema (within KernelParameters):**

```typescript
interface KernelParameters {
  // ... other fields ...

  /** VFS mount table: path prefix → base URL */
  readonly mounts: Record<string, string>;
}
```

**Mount table keys**: VFS path prefixes without `os:///` scheme (context is implicit)

**Example mount table:**

```json
{
  "mounts": {
    "/ship-fail-crew/": "https://raw.githubusercontent.com/ShipFail/crew/main/bridge/",
    "/user-data/": "file:///home/user/data/",
    "/extensions/": "https://cdn.example.com/extensions/"
  }
}
```

**Implicit mapping:**
- `/ship-fail-crew/` in mount table → `os:///ship-fail-crew/` in VFS namespace
- `/extensions/` → `os:///extensions/` (VFS subpath)

**Requirements:**

* Mount points MUST end with `/` (directory-style)
* Base URLs MUST use `https://` or `file://` scheme
* Mount table MUST be initialized during kernel init from `KernelParameters.mounts`
* Mount table is read-only after initialization (no dynamic mounting in v1)
* The `root` parameter from KernelParameters is equivalent to the `/` mount

**Root mount:**

The `root` parameter in KernelParameters defines the default base URL for VFS resolution. It acts as an implicit `/` mount and SHOULD NOT be duplicated in the mount table (DRY principle).

### 4.3. Path Resolution Algorithm

Given a VFS path `P` (e.g., `os:///ship-fail-crew/agents/bridge.md`):

1. **Validate scheme**: Ensure `P` starts with `os:///`
2. **Check for special paths**:
   - If `P` starts with `os:///sys/*`: Use sys backend (see Section 4.8)
   - If `P` starts with `os:///proc/*`: Use proc backend (see Section 4.8)
   - Otherwise: Continue to step 3 (normal code resolution)
3. **Extract subpath**: Strip `os:///` → get subpath (e.g., `/ship-fail-crew/agents/bridge.md`)
4. **Normalize path**: Ensure path is properly formatted
5. **Find longest prefix match**: Find longest matching mount point `M` in mount table
6. **If no match in mount table**:
   - Check if `root` parameter exists in kernel parameters
   - If `root` exists: Use `root` as base URL (fallback to root mount)
   - If `root` does not exist: Throw `NOT_FOUND` (404)

   **Note**: In practice, `root` is always present in kernel parameters, so this error should never occur.

7. **If match found**:
   - Base URL is `U` (from mount table or root)
   - Strip `M` from subpath → relative path `R`
   - Concatenate `U + R` → physical URL
   - Return URL

**Resolution is deterministic**: Same VFS path + same mount table → same URL

**Example resolutions:**

| VFS Path | Subpath | Mount Match | Fallback | Base URL | Result URL |
|----------|---------|-------------|----------|----------|------------|
| `os:///promptware/agents/shell.md` | `/promptware/agents/shell.md` | (none) | Use `root` | `https://github.com/.../os/` | `https://github.com/.../os/promptware/agents/shell.md` |
| `os:///ship-fail-crew/skills/nav.md` | `/ship-fail-crew/skills/nav.md` | `/ship-fail-crew/` | - | `https://github.com/.../bridge/` | `https://github.com/.../bridge/skills/nav.md` |
| `os:///user-data/config.json` | `/user-data/config.json` | `/user-data/` | - | `file:///home/user/data/` | `file:///home/user/data/config.json` |

**Relative path handling:**

When a resource at `os:///agents/shell.md` references a relative path `../skills/nav.md`:

1. Resolve relative to parent: `os:///agents/` + `../skills/nav.md` → `os:///skills/nav.md`
2. Apply VFS resolution as normal

### 4.4. Integration with pwosIngest

The `pwosIngest()` syscall MUST use VFS for path resolution:

```typescript
// Pseudo-code for pwosIngest
async function pwosIngest(vfsPath: string): Promise<void> {
  // 1. Resolve VFS path to URL
  const url = await VFS.resolve(vfsPath);

  // 2. Fetch code from URL
  const code = await fetch(url).then(r => r.text());

  // 3. Parse and validate code (markdown frontmatter, etc.)
  const parsed = parseAgentOrSkill(code);

  // 4. Load into execution context
  loadIntoContext(parsed);
}
```

**Requirements:**

* `pwosIngest()` MUST reject `memory:///` paths (error: `BAD_REQUEST` 400)
* `pwosIngest()` MUST reject `os:///sys/*` paths (error: `BAD_REQUEST` 400) - control data, not code
* `pwosIngest()` MUST reject `os:///proc/*` paths (error: `BAD_REQUEST` 400) - view data, not code
* `pwosIngest()` MUST reject `file://` paths outside mounted prefixes
* `pwosIngest()` MUST support both HTTPS and file:// URLs after resolution

### 4.5. Security Constraints

**Read-Only Enforcement:**

* VFS paths MUST NOT support write operations
* Any attempt to write to a VFS path MUST fail with `FORBIDDEN` (403)

**HTTPS Pinning (Advisory):**

* Production deployments SHOULD use HTTPS URLs with commit hashes or tags
* Example: `https://raw.githubusercontent.com/.../os@v1.2.3/agents/shell.md`

**file:// Security:**

* `file://` mounts SHOULD only be used in development environments
* `file://` mounts MUST be restricted to mounted prefixes (no arbitrary filesystem access)

### 4.6. Error Codes

VFS operations reference the following error codes (defined in RFC-24 Error Registry):

| Error Code | HTTP Number | Condition | Recovery |
|------------|-------------|-----------|----------|
| `BAD_REQUEST` | 400 | pwosIngest called with non-VFS path | Use VFS path (`os:///`), not `memory:///` or bare URL |
| `FORBIDDEN` | 403 | Attempt to write to VFS path | Use `memory:///` for state instead |
| `NOT_FOUND` | 404 | VFS path has no matching mount and root is undefined | Check mount table configuration |
| `BAD_GATEWAY` | 502 | URL fetch failed (404, network error) | Check URL accessibility |

See RFC-24 for complete error code definitions.

### 4.7. Special VFS Paths: System and Process Surfaces

The VFS defines two special path prefixes with filesystem semantics inspired by UNIX sysfs and procfs.

#### os:///sys/* - System Control Plane

Provides writable control attributes (inspired by Linux `/sys`).

**Semantics**:
- **Operations**: read, write
- **Values**: MUST be single-value attributes (no newline characters `\n`)
- **Writable**: YES (unlike other VFS paths which are read-only)
- **Backend**: Implementation-defined

**Rationale**: Single-value enforcement ensures each attribute represents exactly one semantic value, matching Linux sysfs design.

**Example paths**:
```
os:///sys/agents/{agent-id}/status
os:///sys/agents/{agent-id}/lifecycle/desired_state
os:///sys/system/debug_mode
```

**Example usage**:
```typescript
// Read agent status
const status = await VFS.read("os:///sys/agents/shell/status");

// Write control attribute
await VFS.write("os:///sys/agents/shell/status", "active");

// Error: multi-line value
await VFS.write("os:///sys/agents/shell/status", "active\nstarted");
// → Throws UNPROCESSABLE_ENTITY (422)
```

**Error codes**:
- `UNPROCESSABLE_ENTITY` (422): Value contains newlines

#### os:///proc/* - System Belief Surface

Provides read-only system introspection (inspired by Linux `/proc`).

**Semantics**:
- **Operations**: read only (writes FORBIDDEN)
- **Values**: MAY be multi-line, rich formatted, human-readable
- **Dynamic**: MAY be generated on-demand (not pre-stored)
- **Viewpoint-relative**: May differ based on context (agent, origin)
- **Backend**: Implementation-defined

**Rationale**: `proc/*` is a "belief surface" - it reflects what the system believes about its state, not authoritative control.

**Example paths**:
```
os:///proc/cmdline                    # Kernel boot parameters
os:///proc/system/summary             # System overview (multi-line)
os:///proc/agents/{agent-id}/status   # Agent status view
```

**Example usage**:
```typescript
// Read kernel cmdline
const cmdline = await VFS.read("os:///proc/cmdline");
// Returns: {"root":"https://...","origin":"my-os",...}

// Read system summary (multi-line allowed)
const summary = await VFS.read("os:///proc/system/summary");
// Returns:
// PromptWareOS v1.0
// Uptime: 3h 42m
// Agents: 2 active

// Attempt to write (fails)
await VFS.write("os:///proc/system/summary", "hacked");
// → Throws FORBIDDEN (403)
```

**Error codes**:
- `FORBIDDEN` (403): Attempt to write to proc/* path

#### Implementation Notes

**Storage backend** is implementation-defined. Implementations MAY:
- Store `sys/*` in Memory backend (`memory:///os/sys/*`)
- Store `sys/*` in files (`file:///tmp/pwos-sys/*`)
- Keep `sys/*` in-memory only (ephemeral)
- Generate `proc/*` dynamically (recommended)
- Store `proc/*` backing data in Memory or files

The only requirement is:
- `VFS.read("os:///sys/path")` and `VFS.write("os:///sys/path", value)` MUST work
- `VFS.read("os:///proc/path")` MUST work
- `VFS.write("os:///proc/path", ...)` MUST reject with FORBIDDEN (403)

**Example implementation** (non-normative):
```typescript
// Option 1: Memory-backed sys
async function vfsWrite(path: string, value: string) {
  if (path.startsWith("os:///sys/")) {
    const key = path.replace("os:///sys/", "os/sys/");
    await Memory.Set(key, value); // Internal Memory storage
  }
  // ...
}

// Option 2: Dynamic proc generation
async function vfsRead(path: string) {
  if (path === "os:///proc/cmdline") {
    const params = await Memory.Get("os/kernel/boot-params");
    return params; // Dynamically fetch from internal storage
  }
  // ...
}
```

### 4.8. Relationship to Memory Subsystem

**Clear separation:**

* VFS handles **all `os:///` paths**:
  - Code (immutable): `os:///agents/*`, `os:///skills/*` → HTTPS/file:// URLs
  - System control: `os:///sys/*` → writable attributes
  - System views: `os:///proc/*` → read-only introspection
* Memory handles **key-value storage** (`memory:///`):
  - Vault: `memory:///vault/*` (ciphertext-only KV)
  - General: `memory:///os/*` (OS internal), and unrestricted paths

**No overlap:**

* VFS paths (e.g., `os:///promptware/agents/shell.md`) are NOT valid for `Memory.Get/Set`
* Memory paths (e.g., `memory:///vault/token` or `vault/token` in API) are NOT valid for `pwosIngest`

**Implementation note:**

* VFS backends for `os:///sys/*` and `os:///proc/*` MAY use Memory for storage internally, but this is an implementation detail
* From the API perspective, these are VFS paths, not Memory paths
* Configuration storage (mount table, boot params) may be stored in Memory but accessed via VFS

---

## 5. Examples (Non-Normative)

### VFS Integration with Kernel Initialization

For complete kernel boot sequence including VFS initialization, see **RFC 0015 Section 9**.

The VFS-specific initialization step is:

```typescript
// 3. Initialize VFS from cmdline (after Memory is ready)
const cmdline = await VFS.read("os:///proc/cmdline");
const params = JSON.parse(cmdline);
VFS.initialize(params.mounts, params.root);
```

**See RFC 0015 Section 9 for the complete kernel initialization sequence.**

### Example 1: VFS Path Resolution

```typescript
// VFS path → HTTPS URL
const vfsPath = "os:///ship-fail-crew/agents/bridge-operator.md";
const url = await VFS.resolve(vfsPath);
// Lookup: "/ship-fail-crew/" in mount table
// → "https://github.com/.../crew/bridge/agents/bridge-operator.md"

// VFS path → file:// URL
const localPath = "os:///user-data/config.json";
const url = await VFS.resolve(localPath);
// Lookup: "/user-data/" in mount table
// → "file:///home/user/data/config.json"

// Ingest fetches and loads the code
const agent = await pwosIngest(vfsPath);
```

### Example 2: Development with Local Files

```typescript
// Development mount configuration
const devMounts = {
  "/": "file:///workspaces/promptware/os/",
  "/my-skills/": "file:///workspaces/my-skills/"
};

// Ingest from local filesystem
await pwosIngest("os:///my-skills/debug-skill.md");
// VFS resolves → file:///workspaces/my-skills/debug-skill.md
```

### Example 3: Multi-Repository Setup

```typescript
// Production mount configuration
const prodMounts = {
  "/plugins/": "https://cdn.example.com/plugins/",
  "/internal/": "https://github.com/company/internal/main/"
};

// Ingest agent from root (uses root parameter as fallback)
await pwosIngest("os:///agents/production.md");
// VFS resolves → root + "agents/production.md"

// Ingest plugin from CDN
await pwosIngest("os:///plugins/monitoring.md");
// VFS resolves → https://cdn.example.com/plugins/monitoring.md

// Ingest internal skill
await pwosIngest("os:///internal/skills/proprietary.md");
// VFS resolves → https://github.com/company/internal/main/skills/proprietary.md
```

### Example 4: Relative Path Resolution

```typescript
// In os:///promptware/agents/shell.md:
// References relative path: ../skills/terminal.md
// Resolves to: os:///promptware/skills/terminal.md

// In os:///promptware/agents/shell.md:
// References relative path: skills/terminal.md
// Resolves to: os:///promptware/agents/skills/terminal.md
```

### Example 5: Incorrect VFS Usage (Anti-Patterns)

```typescript
// ❌ WRONG: Using Read tool on VFS path
await Read("os:///ship-fail-crew/agents/shell.md");
// → Security violation! Must use pwosIngest()

// ❌ WRONG: Using Memory on VFS path
await Memory.Get("os:///ship-fail-crew/agents/shell.md");
// → Error: VFS paths not valid for Memory

// ❌ WRONG: Using pwosIngest on Memory path
await pwosIngest("memory:///user/config");
// → Error: Memory paths not valid for ingest

// ✅ CORRECT: VFS is for code ingestion only
await pwosIngest("os:///ship-fail-crew/agents/shell.md");  // VFS → ingest
await Read("file:///workspaces/project/src/index.ts");     // file:// → read/write
```

### Example 6: System Control and Introspection

```typescript
// System control via os:///sys/*
await VFS.write("os:///sys/agents/shell/status", "active");
await VFS.write("os:///sys/system/debug_mode", "1");

const status = await VFS.read("os:///sys/agents/shell/status");
// Returns: "active"

// System introspection via os:///proc/*
const cmdline = await VFS.read("os:///proc/cmdline");
const summary = await VFS.read("os:///proc/system/summary");

// Error: Cannot write to proc
await VFS.write("os:///proc/cmdline", "{}");
// → FORBIDDEN (403)

// Error: Cannot ingest sys/proc
await pwosIngest("os:///sys/agents/shell/status");
// → BAD_REQUEST (400): sys/* is control data, not code

await pwosIngest("os:///proc/cmdline");
// → BAD_REQUEST (400): proc/* is view data, not code
```

---

## 6. Implementation Plan

1. **Define mount table schema** in KernelParameters (RFC 0015)
2. **Implement VFS.resolve()**:
   - Longest prefix matching
   - Root fallback logic
   - URL concatenation
   - Error handling for unmounted paths
3. **Update pwosIngest()** to use VFS.resolve()
4. **Store mount table** in `memory:///proc/cmdline` during kernel init
5. **Add validation**:
   - Mount points must end with `/`
   - Base URLs must be `https://` or `file://`
6. **Document error codes** (reference RFC-24)
7. **Add integration tests** for resolution algorithm

---

## 7. Compatibility

**Breaking changes from v0.4 to v0.5:**
- `sys/*` and `proc/*` moved from Memory (RFC-0018) back to VFS
- Now accessed as `os:///sys/*` and `os:///proc/*` (not `memory:///sys/*` or `memory:///proc/*`)
- VFS expanded from code-only to include system control and belief surfaces

**Migration from v0.4:**
- Replace `Memory.Get("proc/cmdline")` → `VFS.read("os:///proc/cmdline")`
- Replace `Memory.Set("sys/path", value)` → `VFS.write("os:///sys/path", value)`
- Replace `Memory.Get("sys/path")` → `VFS.read("os:///sys/path")`

**Historical changes:**
- v0.1: `/sys` and `/proc` were in VFS specification
- v0.2-v0.4: `/sys` and `/proc` moved to RFC-0018 (Memory Subsystem)
- v0.5: `/sys` and `/proc` returned to VFS as `os:///sys/*` and `os:///proc/*`

---

## 8. Security Considerations

* VFS paths are read-only by design
* HTTPS URLs SHOULD use pinned versions (tags/commits) in production
* `file://` mounts should be restricted to development environments
* No access control is enforced at VFS layer (delegated to URL transport)

---

## 9. Future Directions

* Dynamic mount operations (mount/unmount at runtime)
* VFS namespace isolation per origin
* Content addressing (IPFS, git://, etc.)
* Caching layer for frequently accessed resources

---

## 10. References

### PromptWar̊e ØS References

* RFC 0015: Kernel Dualmode Architecture (URI scheme taxonomy, kernel parameters)
* RFC 0018: Memory Subsystem Specification (sys/proc namespaces)
* RFC 0024: CQRS Event Schema (error code registry)

### External References

* [RFC 2119: Key words for use in RFCs](https://www.rfc-editor.org/rfc/rfc2119)
* [UNIX mount(2) system call](https://man7.org/linux/man-pages/man2/mount.2.html)

---

*End of RFC 0013*

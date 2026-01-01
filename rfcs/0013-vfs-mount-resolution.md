---
rfc: 0013
title: Kernel VFS Specification
author: Huan Li, ChatGPT 5.2 Thinking
status: Draft
type: Standards Track
created: 2025-12-20
updated: 2026-01-01
version: 0.4
tags: [vfs, kernel, mount, os]
---

# RFC 0013: Kernel VFS Specification

## 1. Abstract

This RFC defines the **Virtual File System (VFS)** for PromptWar̊e ØS: a mount-based abstraction layer that maps logical VFS paths (`os:///`) to physical URLs (HTTPS or file://) for code ingestion.

The VFS is **exclusively for immutable code addressing**. It is not a general-purpose filesystem and does not handle runtime state (use `memory:///` for state per RFC 0018).

**Scope:**
- Mount table definition and resolution algorithm
- VFS path (`os:///`) to URL translation
- Integration with `pwosIngest()` syscall
- Security constraints (HTTPS pinning, read-only enforcement)

**Out of scope:**
- Runtime state storage (see RFC 0018: Memory Subsystem)
- System control surfaces (`sys/*`) and belief surfaces (`proc/*`) - these are Memory namespaces (RFC 0018)

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
1. Handle runtime state storage (use `memory:///` for state)
2. Implement filesystem operations (stat, readdir, write) - URL fetch only
3. Define `sys/*` or `proc/*` semantics (see RFC 0018)
4. Provide sandboxing or access control (delegated to HTTPS/file:// transport)
5. Support symbolic links, hardlinks, or other filesystem features

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
2. **Extract subpath**: Strip `os:///` → get subpath (e.g., `/ship-fail-crew/agents/bridge.md`)
3. **Normalize path**: Ensure path is properly formatted
4. **Find longest prefix match**: Find longest matching mount point `M` in mount table
5. **If no match in mount table**:
   - Check if `root` parameter exists in kernel parameters
   - If `root` exists: Use `root` as base URL (fallback to root mount)
   - If `root` does not exist: Throw `NOT_FOUND` (404)

   **Note**: In practice, `root` is always present in kernel parameters, so this error should never occur.

6. **If match found**:
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

### 4.7. Relationship to Memory Subsystem

**Clear separation:**

* VFS handles **code** (immutable, addressed by `os:///`, resolved to URL)
* Memory handles **state** (mutable, addressed by `memory:///`, stored in KV)

**No overlap:**

* VFS paths (e.g., `os:///promptware/agents/shell.md`) are NOT valid for `Memory.Get/Set`
* Memory paths (e.g., `memory:///vault/token` or `vault/token` in API) are NOT valid for `pwosIngest`

**Configuration storage:**

* Mount table is stored IN Memory (`memory:///proc/cmdline`)
* But VFS itself does not use Memory for code storage

---

## 5. Examples (Non-Normative)

### VFS Integration with Kernel Initialization

For complete kernel boot sequence including VFS initialization, see **RFC 0015 Section 9**.

The VFS-specific initialization step is:

```typescript
// 3. Initialize VFS from cmdline (after Memory is ready)
const cmdline = await Memory.Get("proc/cmdline");
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

This RFC replaces the previous "Sysfs and Procfs" specification (RFC 0013 v0.1) with a pure VFS specification.

**Breaking changes from v0.1:**
- `/sys` and `/proc` are no longer defined in this RFC (moved to RFC-0018: Memory Subsystem)
- VFS is now explicitly code-only (state is handled by Memory subsystem)

**Migration:**
- Code using VFS for code ingestion: No changes needed
- Code expecting `/sys` and `/proc` from VFS: Update to use Memory subsystem (RFC-0018)

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

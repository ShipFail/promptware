---
rfc: 0015
title: Kernel DualMode Architecture
author: Ship.Fail Crew
status: Draft
type: Standards Track
created: 2025-12-22
updated: 2026-01-02
version: 0.10
tags: [kernel, dualmode, architecture, syscalls, foundation]
---

# RFC 0015: Kernel DualMode Architecture (Main Thread & Worker)

## 1. Abstract

This Request for Comments (RFC) defines the architecture of the **PromptWar̊e ØS (Pr̊ØS) Kernel**, an AI-Native Operating System designed to enforce state persistence, privilege separation, and execution integrity within Large Language Model (LLM) environments.

The Kernel acts as a hypervisor for the LLM's context window, transforming it from a stateless text generator into a stateful, secure execution environment. It employs a **Dual-System Kernel Architecture**—bridging **Probabilistic Intent** and **Deterministic Execution**—modeled after the **System 1 / System 2** cognitive framework and implemented via the **W3C Web Worker** pattern:

*   **PromptWare Kernel (System 2)**: The LLM, responsible for orchestration, reasoning, and intent (The Main Thread).
*   **Software Kernel (System 1)**: The Runtime, responsible for deterministic execution, I/O, and precision (The Worker).

> **Scope Note**: This document defines the *Ontology* and *Laws* of the Kernel. It does not define the *ABI* or *Syscall Contract*. For the normative specification of the execution boundary and syscall table, see **RFC 0019**. This separation ensures that the philosophical model remains stable even as the binary interface evolves.

## 2. Motivation

### 2.1. The "Hallucination of Competence"
Standard LLM interactions suffer from a critical flaw: **Statelessness**. When an LLM reads a file containing instructions (e.g., a "Skill"), it treats the text as passive data. It may hallucinate that it "knows" the skill because it has read the source code, but it lacks the **Execution Context** (state) required to perform the task correctly.

### 2.2. The "Read-Only" Trap
LLMs are trained to be helpful readers. When asked to "use a tool," they often default to the simplest action: reading the file (`read_file`, `fetch_webpage`). In an OS context, this is equivalent to a CPU trying to execute a data segment. It leads to "Split-Brain" behavior where the model sees the instructions but is not bound by them.

### 2.3. The Solution: A Dual Kernel (Main Thread + Worker)
Pr̊ØS introduces a Kernel that enforces **Immutable Laws** upon the LLM. It mandates that System Resources must be **Ingested** (compiled into the active context) before they can be used. This ensures that "Knowledge" is always accompanied by "Authority."

By adopting the **W3C Web Worker** metaphor, we leverage the LLM's pre-trained understanding of concurrency: The Main Thread (LLM) delegates heavy lifting and I/O to the Worker (Software Kernel) via asynchronous messages (`postMessage`).

## 3. Terminology

### 3.1. The Three-Layer Taxonomy

To ensure clarity across Philosophy, Architecture, and Implementation, we define the following layers:

| Layer | Context | Terms |
| :--- | :--- | :--- |
| **1. Philosophy** | *Why* we built it | **System 1** (Fast/Automatic) vs. **System 2** (Slow/Deliberate) |
| **2. Architecture** | *What* it is | **Software Kernel** (Executor) vs. **PromptWare Kernel** (Orchestrator) |
| **3. Implementation** | *How* it works | **Worker** (Background Process) vs. **Main Thread** (LLM Context) |

### 3.2. Definitions

*   **Pr̊ØS**: PromptWar̊e ØS.
*   **PromptWare Kernel**: The high-level Orchestrator (System 2), written in natural language. It runs on the **Main Thread**.
*   **Software Kernel**: The low-level Executor (System 1), written in executable code (TypeScript). It runs as a **Worker**.
*   **System Space**: The protected memory region containing the OS Kernel, Agents, and Skills. Defined by the logical root `os:///`.
*   **User Space**: The user's workspace (e.g., `src/`, `docs/`), containing data that can be freely read and written.
*   **Ingest**: The process of fetching a resource, parsing its instructions, and formally adopting its persona. Analogous to "loading a binary."
*   **Context Register (`__filename`)**: A global variable tracking the currently active execution context.
*   **Hallucination-by-Reading**: The error state where an agent believes it possesses a skill simply because it has read the skill's definition file.

## 4. Architecture Specification

### 4.1. The Dual Kernel Model (Intent & Precision)
Pr̊ØS implements a separation of concerns designed to bridge the gap between **Probabilistic Intent** and **Deterministic Execution**:

*   **The PromptWare Kernel (Main Thread)**: It operates in the realm of language, reasoning, and planning. It decides *what* needs to be done. It is the **Orchestrator**.
*   **The Software Kernel (Worker)**: It operates in the realm of deterministic execution, I/O, and cryptography. It handles *how* it is done. It is the **Executor**.

The two are separated by **The Singular Boundary** (`sys.postMessage`), which translates high-level Intent into low-level Precision.

### 4.2. The Memory Model
The Kernel manages the LLM's context window as a structured memory space.

*   **The Context Register**: `__filename`
    *   Stores the **Context Identity** (absolute URI) of the currently active agent or skill.
    *   Analogous to TypeScript's `__filename`, it allows the agent to resolve relative paths ("whoami").
    *   Updated *only* via `pwosIngest()`.
*   **Kernel Parameters**: `os:///proc/cmdline`
    *   Stores boot parameters (Root URI, Init Agent).
    *   Read-only view of kernel boot configuration.
*   **Virtual File System (VFS)**: `os:///`
    *   A logical addressing scheme for all System Resources.
    *   Abstracts physical locations (GitHub URLs, local files) into a unified namespace.

#### 4.2.1. URI Scheme Taxonomy

PromptWar̊e ØS uses a **unified VFS architecture** under the `os:///` scheme with pluggable drivers (v0.6):

* **`os:///`**: Unified VFS namespace (all system resources)
  * Purpose: All system resources (code, state, control, introspection)
  * Resolved via: **VFS Core** routes to driver based on path prefix (see **RFC 0013**)
  * Architecture: **RFC 0026 (VFS Driver Interface)** defines driver contract
  * Drivers:
    * **VFS Driver: HTTP** (RFC 0029): `os:///agents/*`, `os:///skills/*`, etc. (catch-all for non-reserved paths)
      * Operations: Read (source text)
      * Mount table resolution: longest-prefix matching → HTTPS/file:// URLs
    * **Kernel Memory Subsystem** (RFC 0018): `os:///memory/*` (persistent KV storage)
      * Operations: Read, Write, List, Delete
      * Vault enforcement: `os:///memory/vault/*` requires `pwenc:v1:*` ciphertext
    * **VFS Driver: Sysfs** (RFC 0027): `os:///sys/*` (control plane, writable)
      * Operations: Read, Write (single-value enforcement)
    * **VFS Driver: Procfs** (RFC 0028): `os:///proc/*` (introspection, read-only)
      * Operations: Read (dynamic generation)

* **`file://`**: Local host filesystem
  * Purpose: User's working directory files
  * Example: `file:///workspaces/project/README.md`
  * Resolved via: Host filesystem
  * Operations: Generic I/O tools (Read, Write, Edit)

* **Relative paths** (no scheme): Context-dependent
  * Inherit schema from parent resource
  * Example in `os:///agents/shell.md`: relative path `skills/nav.md` resolves to `os:///agents/skills/nav.md`
  * Example in `file:///workspace/doc.md`: relative path `src/index.ts` resolves to `file:///workspace/src/index.ts`

**Separation of Concerns (v0.6):**

* `os:///` is the **unified VFS namespace** for all system resources (Ring 0)
  * `os:///agents/*`, `os:///skills/*` → Code Driver (immutable code)
  * `os:///memory/*` → Memory Driver (mutable persistent state)
  * `os:///sys/*` → Sys Driver (control plane, writable)
  * `os:///proc/*` → Proc Driver (introspection, read-only)
* `file://` paths are for **user data** (Ring 3 development artifacts)
* Relative paths inherit context from parent

**API Convention:**

VFS provides unified API for all `os:///` operations:
```typescript
// ✅ Correct API usage (VFS unified interface)
await VFS.read("os:///memory/vault/token");        // Memory driver
await VFS.write("os:///memory/vault/token", "pwenc:v1:...");
await VFS.read("os:///proc/cmdline");               // Proc driver
await VFS.write("os:///sys/config/mode", "debug");  // Sys driver

// Kernel Syscall (not VFS operation)
await pwosIngest("os:///agents/shell.md");          // Kernel loads via VFS.read()

// Legacy Memory API (may be deprecated in future)
await Memory.Get("vault/token");  // Equivalent to VFS.read("os:///memory/vault/token")
await Memory.Set("vault/token", "pwenc:v1:...");
```

**Documentation Convention**: This document uses full URIs (`os:///namespace/path`) in specifications for clarity.

### 4.3. Core Concepts: Code (Root) vs. State (Origin)

Pr̊ØS enforces a strict separation between the immutable code and the mutable state.

*   **Root (Code)**: The immutable source of truth for the Operating System's source code (VFS).
    *   Defined by the `root` parameter.
    *   Example: `https://raw.githubusercontent.com/ShipFail/promptware/main/os/`

*   **Origin (State)**: The security principal that defines the scope of mutable storage (KV).
    *   Defined by the `origin` parameter in boot configuration (see **RFC 0014**)
    *   Example: `https://my-os.local/` or a short name like `my-os`
    *   **Purpose**: Provides storage isolation for multi-tenant deployments
    *   **Normative Requirements**: See Section 4.3.1 below

#### 4.3.1. Origin Parameter Normative Specification

The `origin` parameter is the **security principal for mutable state isolation**. All implementations MUST satisfy the following requirements:

**Conformance Language**: The key words MUST, MUST NOT, SHOULD, and MAY in this section are to be interpreted as described in BCP 14 [RFC 2119].

**1. Provision Requirement**

The origin MUST be provided to all syscalls that access mutable state (storage, memory, persistent files). The mechanism for passing the origin is implementation-defined, but the requirement to provide it is normative.

**2. Normalization Requirements**

Before use, the origin MUST be normalized according to these rules:

1. **URL Format**: If origin is a valid URL (e.g., `https://my-os.local/`), it MUST be used as-is
2. **Name Format**: If origin is not a valid URL (e.g., `my-os`), it MUST be normalized to:
   - Convert to lowercase
   - Remove non-alphanumeric characters except hyphens (`-`)
   - Format as: `https://<normalized-name>.local/`
   - Example: `my-os` → `https://my-os.local/`, `My_OS!` → `https://my-os.local/`
3. **Fallback**: If origin is undefined or empty, the system MUST use the `root` parameter value as the origin

**3. Isolation Requirements**

Different origins MUST have completely isolated storage namespaces:

1. **No Cross-Origin Access**: Syscalls operating under origin A MUST NOT be able to read, write, or discover data from origin B
2. **Deterministic Namespace**: The same origin value MUST always map to the same storage namespace across invocations
3. **Enforcement Location**: The runtime environment MUST enforce this isolation (e.g., via location-based storage partitioning)

**4. Immutability Requirements**

1. **Boot-Time Configuration**: The origin MUST be set at boot time from trusted bootloader configuration (**RFC 0014**)
2. **No User Override**: User-space code, agents, or skills MUST NOT be able to modify or override the origin parameter
3. **Syscall Transparency**: Individual syscall implementations SHOULD NOT need to parse or validate the origin directly - they rely on the runtime's isolation enforcement

**5. Security Requirements**

1. **Trusted Source**: The origin value MUST originate from the bootloader front matter (trusted configuration)
2. **No Injection**: The origin MUST NOT be injectable via user input, command-line arguments (except boot-time), or external APIs
3. **Audit Trail**: Changes to origin (e.g., during reconfiguration) SHOULD be logged for security audit purposes

**6. Usage Examples**

Valid origin values and their normalized forms:

| Input Origin | Normalized Origin | Notes |
|--------------|------------------|-------|
| `https://acme.com/` | `https://acme.com/` | Valid URL - used as-is |
| `https://my-os.local/` | `https://my-os.local/` | Valid URL - used as-is |
| `my-os` | `https://my-os.local/` | Name format - normalized |
| `MyCompany_OS` | `https://mycompany-os.local/` | Name format - normalized |
| `undefined` | `<value of root parameter>` | Fallback to root |
| `""` (empty) | `<value of root parameter>` | Fallback to root |

**7. Implementation Guidance (Non-Normative)**

While the passing mechanism is implementation-defined, reference implementations MAY use:
- Runtime location flags (e.g., Deno's `--location`)
- Environment variables (e.g., `PWOS_ORIGIN`)
- Process-level context objects

See **RFC 0023** for implementation details in the syscall bridge.

### 4.4. Privilege Separation (Orchestrator vs. Executor)

The architecture enforces a strict separation of privilege based on the **Orchestrator/Executor** model:

*   **The PromptWare Kernel (Orchestrator)**:
    *   **Privilege**: Highest. It holds the "Constitution" and directs the system.
    *   **Access**: Can read `os:///` (System Space) to understand capabilities.
    *   **Role**: Governance, Planning, and Decision Making.

*   **The Software Kernel (Executor)**:
    *   **Privilege**: Restricted. It can only execute what is explicitly requested via Syscalls.
    *   **Access**: Can execute code and perform I/O.
    *   **Role**: Deterministic Execution and Safety Enforcement.

*   **User Space**:
    *   **Privilege**: Lowest.
    *   **Access**: Read/Write access to the Workspace (`file:///`).

**Note**: The PromptWare Kernel operates in the realm of natural language and has the highest privilege because English is the most powerful interface. The Software Kernel provides deterministic execution.

### 4.5. The Immutable Laws (Kernel Space Physics)

The Kernel enforces these laws via the System Prompt (`KERNEL.md`).

#### Law 1: The Law of System Space
> "System Space resources are Compiled Binaries, not text documents."

*   **Constraint**: The Agent **MUST NOT** use generic I/O tools (`read_file`, `fetch_webpage`, `cat`) on any URI starting with `os:///`.
*   **Enforcement**: Violation triggers a **Security Watchdog** panic.

#### Law 2: The Law of State (The Binary Rule)
> "If it's not Ingested, it's Encrypted."

*   **Constraint**: Information obtained via direct reading of System Space is considered **CORRUPTED**. The Agent cannot act on it.
*   **Requirement**: The Agent must use `pwosIngest()` to "decrypt" (load) the capability.

#### Law 3: The Law of Singular Entry
> "All physics must flow through the Boundary."

*   **Constraint**: All physical execution, state mutation, or authority acquisition **MUST** enter the Software Kernel via `sys.postMessage`.
*   **Enforcement**: No Skill, Agent, or Tool may invoke a syscall handler (e.g., `ingest.ts`) directly.

### 4.6. The Law of Responsibility (Error Taxonomy)

The Kernel enforces a strict "Chain of Responsibility" for failures, mapping them to a 2x2 matrix of **Domain** (Intent vs. Execution) and **Recoverability** (Fixable vs. Fatal).

| | **Recoverable (AI Fixable)** | **Fatal (Human Fixable)** |
| :--- | :--- | :--- |
| **PromptWare Kernel (Intent)** | **1. `intent:violation`** | **2. `intent:panic`** |
| **Software Kernel (Execution)** | **3. `execution:exception`** | **4. `execution:crash`** |

#### 1. Intent Violation (`intent:violation`)
*   **Definition**: The PromptWare Kernel (LLM) misunderstood the Laws of Physics. It formulated a plan that contradicts the System Constitution (e.g., invalid JSON, accessing protected memory).
*   **Responsibility**: **The LLM**.
*   **Action**: The Kernel rejects the request. The LLM **MUST** self-correct and retry.

#### 2. Intent Panic (`intent:panic`)
*   **Definition**: The PromptWare Kernel has suffered a cognitive collapse. Examples include infinite repetition loops, context corruption, or refusal to follow the System Prompt.
*   **Responsibility**: **The Human Operator**.
*   **Action**: The System halts. The Human **MUST** reset the context or refine the prompt.

#### 3. Execution Exception (`execution:exception`)
*   **Definition**: The Intent was valid, but the Software Kernel encountered friction with reality (e.g., File Not Found, API 404, Permission Denied).
*   **Responsibility**: **The LLM**.
*   **Action**: The Kernel reports the failure. The LLM **MUST** catch the exception and adapt its plan (e.g., create the file, use a different tool).

#### 4. Execution Crash (`execution:crash`)
*   **Definition**: The Software Kernel failed internally due to a bug in the deterministic code (e.g., `TypeError`, `ReferenceError`, Database Connection Refused).
*   **Responsibility**: **The Human Developer**.
*   **Action**: The System halts. The LLM **MUST NOT** attempt to fix it; it must report the stack trace to the user.

## 5. Kernel Initialization (PID 0)

The "Boot Sequence" is the critical handoff between the static Bootloader and the dynamic Kernel.

### 5.1. The Handoff
The Bootloader (a static Markdown file) injects the `KernelParameters` (Root, Init Agent) into the LLM's context. At this moment, the LLM is running as **PID 0** (The Kernel Process).

### 5.2. The Init Sequence
PID 0 MUST immediately execute the following sequence to bring the system to a usable state:

1.  **Initialize Memory Driver**:
    *   Initialize the Memory driver backend (Deno KV or equivalent)
    *   Memory driver is now ready for VFS operations on `os:///memory/*`

2.  **Initialize VFS Core and Register Drivers** (v0.6):
    *   Initialize VFS Core orchestration layer (see **RFC 0013 v0.6**)
    *   Parse `params.mounts` from boot configuration
    *   Register drivers in order:
      1. **Memory Driver** (RFC 0018 v0.6): handles `os:///memory/*`
      2. **Sys Driver** (RFC 0027): handles `os:///sys/*`
      3. **Proc Driver** (RFC 0028): handles `os:///proc/*`
      4. **Code Driver** (RFC 0029): catch-all for remaining paths (agents, skills, etc.)
    *   VFS Core is now ready to route operations to drivers

3.  **Persist Kernel Parameters**:
    *   Store boot parameters for Proc driver to expose
    *   Implementation: Store in Memory driver: `VFS.write("os:///memory/os/kernel/boot-params", JSON.stringify(params))`
    *   Proc driver exposes as read-only view at `os:///proc/cmdline`
    *   Requirement: `VFS.read("os:///proc/cmdline")` MUST return parameters

4.  **Launch Init Agent**:
    *   Execute `pwosIngest(params.init)`
    *   Code driver resolves path via mount table
    *   Goal: Fetch and adopt the user-space persona (PID 1)

5.  **System Ready**:
    *   Report successful boot

**Note**: Steps 1-4 occur during **kernel initialization**, not boot. Boot is the handoff from bootloader to kernel. Initialization is when kernel sets up subsystems and drivers.

### 5.3. Kernel Parameter Schema

**Storage location**: `os:///proc/cmdline` (URI specification)
**API access**: `VFS.read("os:///proc/cmdline")`

The Kernel Parameters MUST be readable at `os:///proc/cmdline` and MUST adhere to the following JSON Schema:

```typescript
interface KernelParameters {
  /** The immutable source of truth for Code (VFS default mount) */
  readonly root: string;

  /** The security principal for State (Memory origin). Optional. */
  readonly origin?: string;

  /** The VFS path to the Kernel source */
  readonly kernel: string;

  /** The VFS path to the Init Agent */
  readonly init: string;

  /** VFS mount table: path prefix → base URL */
  readonly mounts: Record<string, string>;
}
```

**Example boot parameters:**

```json
{
  "root": "https://raw.githubusercontent.com/ShipFail/promptware/main/os/",
  "origin": "my-os",
  "kernel": "os:///promptware/kernel/KERNEL.md",
  "init": "os:///promptware/agents/shell.md",
  "mounts": {
    "/ship-fail-crew/": "https://raw.githubusercontent.com/ShipFail/crew/main/bridge/",
    "/user-data/": "file:///home/user/data/"
  }
}
```

**Mount table semantics:**

Mount table keys are VFS path prefixes (without `os:///` scheme):
- `/` in mount table → `os:///` (VFS root)
- `/ship-fail-crew/` in mount table → `os:///ship-fail-crew/` in VFS namespace

The `root` parameter is equivalent to the `/` mount and SHOULD NOT be duplicated in mounts (DRY principle).

**Storage and Access:**

How `proc/cmdline` is stored is implementation-defined (may be in-memory, file, or separate Memory namespace). The only requirement is:

* `VFS.read("os:///proc/cmdline")` MUST return the kernel parameters JSON
* `VFS.write("os:///proc/cmdline", ...)` MUST be rejected (read-only, per RFC 0013)

**Example implementation** (non-normative):

```typescript
// During kernel initialization (after Memory is ready)
// Implementation may store in a separate location
await Memory.Set("os/kernel/boot-params", JSON.stringify(params));

// VFS provides proc/cmdline as read-only view
VFS.registerProc("cmdline", async () => {
  return await Memory.Get("os/kernel/boot-params");
});

// API view: proc/cmdline is read-only
const cmdline = await VFS.read("os:///proc/cmdline"); // ✅ Works
await VFS.write("os:///proc/cmdline", "{}"); // ❌ FORBIDDEN (403)
```

## 6. The Lifecycle of Authority (Ingestion)

Ingestion is the process of transforming **Text** (Source Code) into **Authority** (Capability). It is a **Kernel Syscall** (`pwosIngest`), not a VFS operation.

1.  **Check Capability**: The Kernel verifies the target VFS node has the `EXECUTABLE` capability.
2.  **Fetch**: The Kernel calls `VFS.read()` to retrieve the raw bits from storage.
3.  **Validate**: The integrity and authenticity of the bits are verified.
4.  **Load**: The bits are materialized into the Execution Context.
5.  **Adopt**: The Agent formally accepts the new identity or capability.

*Note: The technical implementation of this pipeline is defined in RFC 0020.*

## 7. Security Considerations

### 7.1. The Watchdog Mechanism
To prevent the "Read-Only" vulnerability, the Kernel includes a reactive Watchdog.

*   **Trigger**: Detection of `read_file` or similar tools on a System Space path.
*   **Response**:
    1.  **Halt** execution.
    2.  **Report** `🚨 SECURITY VIOLATION`.
    3.  **Auto-Correct**: Immediately execute `pwosIngest()` on the target.

This "Fail-Secure" mechanism ensures that even if the LLM drifts, the Kernel forces it back into compliance.

## 8. Future Work

*   **Multi-Process Support**: Enabling "Background Agents" with independent Context Registers.
*   **Kernel Debugger**: A specialized "Ring -1" mode for inspecting System Space without triggering security violations (for OS developers only).
*   **Signed Binaries**: Cryptographic verification of Skills before Ingestion.

## 9. Appendix: Examples and Cross-References

This section provides pointers to detailed examples in subsystem RFCs.

### VFS Architecture (v0.6)

For comprehensive VFS architecture documentation, see:

* **RFC 0026 (VFS Driver Interface)**: Driver contract specification
  - VFSDriver interface definition
  - Capability declarations (readable, writable, executable)
  - Path normalization conventions
  - Validation hook pattern

* **RFC 0013 (VFS Core Architecture)**: Thin orchestration layer
  - Driver routing algorithm
  - Capability enforcement
  - Unified API surface (read/write/ingest/list/delete)
  - Migration guide from v0.5

### VFS Driver Examples

For comprehensive examples of individual VFS drivers:

* **RFC 0029 (VFS Driver: HTTP)**: Code ingestion and mount resolution
  - Mount table initialization
  - Longest-prefix path matching
  - Read vs Ingest operations
  - Version pinning recommendations

* **RFC 0018 (Kernel Memory Subsystem)**: Persistent KV storage
  - Vault ciphertext enforcement (`pwenc:v1:*`)
  - Memory operations (read/write/list/delete)
  - Kernel parameter storage
  - Migration guide from Memory API to VFS API

* **RFC 0027 (VFS Driver: Sysfs)**: Control plane operations
  - Single-value enforcement (no newlines)
  - Writable control attributes
  - System configuration examples

* **RFC 0028 (VFS Driver: Procfs)**: System introspection
  - Dynamic generation pattern
  - Read-only belief surface
  - Kernel cmdline exposure

### Kernel Initialization Example (Summary)

```typescript
// Boot Stage: Bootloader provides parameters (in LLM context)
// ... (same as before)
```

**For detailed examples, see RFC 0013 (VFS Core Architecture), RFC 0026 (VFS Driver Interface), and individual driver RFCs (0018, 0027, 0028, 0029).**

---
*End of RFC 0015*

---
rfc: 0015
title: Kernel Dualmode Architecture
author: Ship.Fail Crew
status: Draft
type: Standards Track
created: 2025-12-22
updated: 2026-01-01
version: 0.9
tags: [kernel, dualmode, architecture, syscalls, foundation]
---

# RFC 0015: Kernel Dualmode Architecture

## 1. Abstract

This Request for Comments (RFC) defines the architecture of the **PromptWar̊e ØS (Pr̊ØS) Kernel**, an AI-Native Operating System designed to enforce state persistence, privilege separation, and execution integrity within Large Language Model (LLM) environments.

The Kernel acts as a hypervisor for the LLM's context window, transforming it from a stateless text generator into a stateful, secure execution environment. It employs a **Dual Kernel** design—bridging **Probabilistic Intent (LLM)** and **Deterministic Execution (Code)**—and introduces the concept of **"Prompts as Binaries"**, enforcing a strict distinction between *reading source code* (User Space) and *ingesting capabilities* (System Space).

> **Scope Note**: This document defines the *Ontology* and *Laws* of the Kernel. It does not define the *ABI* or *Syscall Contract*. For the normative specification of the execution boundary and syscall table, see **RFC 0019**. This separation ensures that the philosophical model remains stable even as the binary interface evolves.

## 2. Motivation

### 2.1. The "Hallucination of Competence"
Standard LLM interactions suffer from a critical flaw: **Statelessness**. When an LLM reads a file containing instructions (e.g., a "Skill"), it treats the text as passive data. It may hallucinate that it "knows" the skill because it has read the source code, but it lacks the **Execution Context** (state) required to perform the task correctly.

### 2.2. The "Read-Only" Trap
LLMs are trained to be helpful readers. When asked to "use a tool," they often default to the simplest action: reading the file (`read_file`, `fetch_webpage`). In an OS context, this is equivalent to a CPU trying to execute a data segment. It leads to "Split-Brain" behavior where the model sees the instructions but is not bound by them.

### 2.3. The Solution: A Prompt Kernel
Pr̊ØS introduces a Kernel that enforces **Immutable Laws** upon the LLM. It mandates that System Resources must be **Ingested** (compiled into the active context) before they can be used. This ensures that "Knowledge" is always accompanied by "Authority."

## 3. Terminology

*   **Pr̊ØS**: PromptWar̊e ØS.
*   **Promptware Kernel**: The high-level "Mind" of the OS (Intent), written in natural language and interface definitions.
*   **Software Kernel**: The low-level "Body" of the OS (Physics), written in executable code (TypeScript).
*   **System Space**: The protected memory region containing the OS Kernel, Agents, and Skills. Defined by the logical root `os:///`.
*   **User Space**: The user's workspace (e.g., `src/`, `docs/`), containing data that can be freely read and written.
*   **Ingest**: The process of fetching a resource, parsing its instructions, and formally adopting its persona. Analogous to "loading a binary."
*   **Context Register (`__filename`)**: A global variable tracking the currently active execution context.
*   **Hallucination-by-Reading**: The error state where an agent believes it possesses a skill simply because it has read the skill's definition file.

## 4. Architecture Specification

### 4.1. The Dual Kernel Model (Intent & Precision)
Pr̊ØS implements a separation of concerns designed to bridge the gap between **Probabilistic Intent (LLM)** and **Deterministic Execution (Code)**:

*   **The Promptware Kernel (Intent)**: It operates in the realm of language, reasoning, and planning. It decides *what* needs to be done.
*   **The Software Kernel (Precision)**: It operates in the realm of deterministic execution, I/O, and cryptography. It handles *how* it is done.

The two are separated by **The Singular Boundary** (`pwosSyscall`), which translates high-level Intent into low-level Precision.

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

PromptWar̊e ØS uses three distinct URI schemes for different resource types:

* **`os:///`**: Code addressing for ingest operations
  * Purpose: Fetch agent/skill/kernel source code
  * Example: `os:///agents/shell.md`
  * Resolved via: VFS mount table → HTTPS or file:// URLs
  * Operations: `pwosIngest()` only (read-only, immutable)
  * **Details**: See **RFC 0013 (VFS Specification)** for complete mount resolution algorithm and examples

* **`memory:///`**: Persistent key-value storage
  * Purpose: Runtime state, configuration, secrets
  * URI form: `memory:///vault/google/token` (in specifications)
  * API form: `Memory.Get("vault/google/token")` (omit prefix in API calls)
  * Resolved via: Memory syscall (RFC 0018)
  * Operations: `Memory.Get/Set/Delete/List`
  * **Details**: See **RFC 0018 (Memory Specification)** for vault enforcement and KV operations
  * **Note**: `sys/*` and `proc/*` are NOT Memory namespaces (moved to VFS in v0.5)

* **`file://`**: Local host filesystem
  * Purpose: User's working directory files
  * Example: `file:///workspaces/project/README.md`
  * Resolved via: Host filesystem
  * Operations: Generic I/O tools (Read, Write, Edit)

* **Relative paths** (no scheme): Context-dependent
  * Inherit schema from parent resource
  * Example in `os:///agents/shell.md`: relative path `skills/nav.md` resolves to `os:///agents/skills/nav.md`
  * Example in `file:///workspace/doc.md`: relative path `src/index.ts` resolves to `file:///workspace/src/index.ts`

**Separation of Concerns:**

* `os:///` paths are for **immutable code** (Ring 0 system resources)
* `memory:///` URIs specify **mutable state** (Ring 1 persistent storage)
* `file://` paths are for **user data** (Ring 3 development artifacts)
* Relative paths inherit context from parent

**API Convention:**

When calling Memory syscall, the `memory:///` prefix is ALWAYS omitted:
```typescript
// ✅ Correct API usage
await Memory.Set("vault/token", "pwenc:v1:...");
await Memory.Get("proc/cmdline");

// ❌ Incorrect - don't include memory:/// in API calls
await Memory.Set("memory:///vault/token", "pwenc:v1:...");
```

**Documentation Convention**: This document uses full URIs (`memory:///path`) in specifications for clarity, but API examples omit the prefix.

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

### 4.4. Privilege Separation (The Rings)

| Ring | Name | Access | Description |
| :--- | :--- | :--- | :--- |
| **Ring 0** | Promptware Kernel | `os:///` | **Natural Language**. Highest privilege. |
| **Ring 1** | Software Kernel | Syscalls | **Executable Code**. Deterministic execution. |
| **Ring 3** | User Space | Workspace | **Open**. Read/Write allowed. |

**Note**: The Promptware Kernel (Ring 0) operates in the realm of natural language and has the highest privilege because English is the most powerful interface. The Software Kernel (Ring 1) provides deterministic execution.

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

*   **Constraint**: All physical execution, state mutation, or authority acquisition **MUST** enter the Software Kernel via `pwosSyscall`.
*   **Enforcement**: No Skill, Agent, or Tool may invoke a syscall handler (e.g., `ingest.ts`) directly.

### 4.6. The Law of Responsibility (Error Taxonomy)

The Kernel enforces a strict "Chain of Responsibility" for failures, mapping them to a 2x2 matrix of **Domain** (Intent vs. Execution) and **Recoverability** (Fixable vs. Fatal).

| | **Recoverable (AI Fixable)** | **Fatal (Human Fixable)** |
| :--- | :--- | :--- |
| **Prompt Kernel (Intent)** | **1. `intent:violation`** | **2. `intent:panic`** |
| **Software Kernel (Execution)** | **3. `execution:exception`** | **4. `execution:crash`** |

#### 1. Intent Violation (`intent:violation`)
*   **Definition**: The Prompt Kernel (LLM) misunderstood the Laws of Physics. It formulated a plan that contradicts the System Constitution (e.g., invalid JSON, accessing protected memory).
*   **Responsibility**: **The LLM**.
*   **Action**: The Kernel rejects the request. The LLM **MUST** self-correct and retry.

#### 2. Intent Panic (`intent:panic`)
*   **Definition**: The Prompt Kernel has suffered a cognitive collapse. Examples include infinite repetition loops, context corruption, or refusal to follow the System Prompt.
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

1.  **Initialize Memory Subsystem**:
    *   Initialize the Memory syscall backend (Deno KV or equivalent)
    *   Memory subsystem is now ready for operations

2.  **Persist Kernel Parameters**:
    *   Make boot parameters accessible at `os:///proc/cmdline`
    *   Implementation-defined: may store in Memory (`os/kernel/boot-params`), file, or in-memory
    *   Requirement: `VFS.read("os:///proc/cmdline")` MUST return parameters

3.  **Initialize VFS**:
    *   Read mount table from `VFS.read("os:///proc/cmdline")`
    *   Parse `params.mounts` and initialize VFS resolution
    *   VFS is now ready for `pwosIngest()` and `sys/*`/`proc/*` operations

4.  **Launch Init Agent**:
    *   Execute `pwosIngest(params.init)`
    *   Goal: Fetch and adopt the user-space persona (PID 1)

5.  **System Ready**:
    *   Report successful boot

**Note**: Steps 1-3 occur during **kernel initialization**, not boot. Boot is the handoff from bootloader to kernel. Initialization is when kernel sets up subsystems.

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

Ingestion is the process of transforming **Text** (Source Code) into **Authority** (Capability). It is not merely "loading a file"; it is a formal state transition.

1.  **Fetch**: The raw bits are retrieved from storage.
2.  **Validate**: The integrity and authenticity of the bits are verified.
3.  **Load**: The bits are materialized into the Execution Context.
4.  **Adopt**: The Agent formally accepts the new identity or capability.

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

### VFS and Code Ingestion Examples

For comprehensive examples of VFS path resolution, mount configuration, and pwosIngest usage, see:

* **RFC 0013 Section 5**: VFS Examples
  - Kernel initialization with VFS
  - VFS path resolution (os:// → HTTPS/file://)
  - Development with local files
  - Multi-repository setup
  - Relative path resolution
  - Incorrect VFS usage (anti-patterns)

### Memory and State Management Examples

For comprehensive examples of Memory operations, namespace usage, and vault enforcement, see:

* **RFC 0018 Examples Section**: Memory Examples
  - Memory path operations (vault, sys, proc, user namespaces)
  - Incorrect Memory usage (anti-patterns)
  - Kernel initialization with Memory
  - Multi-namespace usage patterns

### Kernel Initialization Example (Summary)

```typescript
// Boot Stage: Bootloader provides parameters (in LLM context)
const bootParams: KernelParameters = {
  root: "https://github.com/.../promptware/os/",
  origin: "my-os",
  kernel: "os:///promptware/kernel/KERNEL.md",
  init: "os:///promptware/agents/shell.md",
  mounts: {
    "/ship-fail-crew/": "https://github.com/.../crew/bridge/",
    "/user-data/": "file:///home/user/data/"
  }
};

// Kernel Initialization Stage
// 1. Initialize Memory subsystem
await Memory.initialize();

// 2. Make cmdline accessible
await Memory.Set("os/kernel/boot-params", JSON.stringify(bootParams));
VFS.registerProc("cmdline", async () => {
  return await Memory.Get("os/kernel/boot-params");
});

// 3. Initialize VFS from cmdline
const cmdline = await VFS.read("os:///proc/cmdline");
const params = JSON.parse(cmdline);
VFS.initialize(params.mounts);

// 4. Ingest init agent
await pwosIngest(params.init); // os:///promptware/agents/shell.md
```

**For detailed examples, see RFC 0013 (VFS) and RFC 0018 (Memory).**

---
*End of RFC 0015*

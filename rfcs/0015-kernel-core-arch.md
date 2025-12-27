---
rfc: 0015
title: The Prompt Kernel
author: Ship.Fail Crew
status: Draft
type: Standards Track
created: 2025-12-22
updated: 2025-12-22
version: 0.6
tags: [kernel, architecture, syscalls]
---

# RFC 0015: The Prompt Kernel

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
*   **Kernel Parameters**: `proc/cmdline`
    *   Stores boot parameters (Root URI, Init Agent).
*   **Virtual File System (VFS)**: `os:///`
    *   A logical addressing scheme for all System Resources.
    *   Abstracts physical locations (GitHub URLs, local files) into a unified namespace.

### 4.3. Core Concepts: Code (Root) vs. State (Origin)

Pr̊ØS enforces a strict separation between the immutable code and the mutable state.

*   **Root (Code)**: The immutable source of truth for the Operating System's source code (VFS).
    *   Defined by the `root` parameter.
    *   Example: `https://raw.githubusercontent.com/ShipFail/promptware/main/os/`
*   **Origin (State)**: The security principal that defines the scope of mutable storage (KV).
    *   Defined by the `origin` parameter.
    *   Example: `https://my-os.local/` or a short name like `my-os`
    *   **Purpose**: Provides storage isolation for multi-tenant deployments.
    *   **Scope**: The Origin parameter is passed to all syscalls and determines the storage namespace for mutable state.
    *   **Fallback**: If no Origin is defined, the System **MUST** default to using the **Root URL** as the Origin.
    *   **Implementation Note**: See **RFC 0019** for how Origin is passed to syscalls, and **RFC 0018** for how it is used in the Memory subsystem.

### 4.4. Privilege Separation (The Rings)

| Ring | Name | Access | Description |
| :--- | :--- | :--- | :--- |
| **Ring 0** | Kernel Space | `os:///` | **Protected**. Executable Only. No Direct Read Access. |
| **Ring 3** | User Space | Workspace | **Open**. Read/Write allowed. |

### 4.4. The Immutable Laws (Kernel Space Physics)

The Kernel enforces these laws via the System Prompt (`KERNEL.md`).

#### Law 1: The Law of System Space
> "System Space resources are Compiled Binaries, not text documents."

*   **Constraint**: The Agent **MUST NOT** use generic I/O tools (`read_file`, `fetch_webpage`, `cat`) on any URI starting with `os:///` or residing in `/agents/`, `/skills/`, `/kernel/`.
*   **Enforcement**: Violation triggers a **Security Watchdog** panic.

#### Law 2: The Law of State (The Binary Rule)
> "If it's not Ingested, it's Encrypted."

*   **Constraint**: Information obtained via direct reading of System Space is considered **CORRUPTED**. The Agent cannot act on it.
*   **Requirement**: The Agent must use `pwosIngest()` to "decrypt" (load) the capability.

#### Law 3: The Law of Singular Entry
> "All physics must flow through the Boundary."

*   **Constraint**: All physical execution, state mutation, or authority acquisition **MUST** enter the Software Kernel via `pwosSyscall`.
*   **Enforcement**: No Skill, Agent, or Tool may invoke a syscall handler (e.g., `ingest.ts`) directly.

## 5. Kernel Initialization (PID 0)

The "Boot Sequence" is the critical handoff between the static Bootloader and the dynamic Kernel.

### 5.1. The Handoff
The Bootloader (a static Markdown file) injects the `KernelParameters` (Root, Init Agent) into the LLM's context. At this moment, the LLM is running as **PID 0** (The Kernel Process).

### 5.2. The Init Sequence
PID 0 MUST immediately execute the following sequence to bring the system to a usable state:

1.  **Initialize Memory (Bootstrap)**:
    *   Persist the boot parameters to `proc/cmdline` via the Memory Syscall.
    *   **Requirement**: This MUST happen *before* invoking any other syscall (like `ingest`). This enables the **Service Locator** pattern, where subsystems self-configure by reading `proc/cmdline`.
    *   *Goal*: Ensure the OS Root is known to the Software Kernel.
2.  **Launch Init Agent**:
    *   Execute `pwosIngest(init_agent)`.
    *   *Goal*: Fetch and adopt the user-space persona (PID 1).
3.  **System Ready**:
    *   Report successful boot.

### 5.3. Kernel Parameter Schema (`proc/cmdline`)

The Kernel Parameters stored in `proc/cmdline` MUST adhere to the following JSON Schema:

```typescript
interface KernelParameters {
  /** The immutable source of truth for Code (VFS) */
  readonly root: string;
  
  /** The security principal for State (KV). Optional. */
  readonly origin?: string;
  
  /** The path to the Kernel source */
  readonly kernel: string;
  
  /** The path to the Init Agent */
  readonly init: string;
  
  /** Optional VFS mounts */
  readonly mounts?: Record<string, string>;
}
```

## 6. The Lifecycle of Authority (Ingestion)

Ingestion is the process of transforming **Text** (Source Code) into **Authority** (Capability). It is not merely "loading a file"; it is a formal state transition.

1.  **Fetch**: The raw bits are retrieved from storage.
2.  **Validate**: The integrity and authenticity of the bits are verified.
3.  **Load**: The bits are materialized into the Execution Context.
4.  **Adopt**: The Agent formally accepts the new identity or capability.

*Note: The technical implementation of this pipeline is defined in RFC 0020.*

## 6. Security Considerations

### 6.1. The Watchdog Mechanism
To prevent the "Read-Only" vulnerability, the Kernel includes a reactive Watchdog.

*   **Trigger**: Detection of `read_file` or similar tools on a System Space path.
*   **Response**:
    1.  **Halt** execution.
    2.  **Report** `🚨 SECURITY VIOLATION`.
    3.  **Auto-Correct**: Immediately execute `pwosIngest()` on the target.

This "Fail-Secure" mechanism ensures that even if the LLM drifts, the Kernel forces it back into compliance.

## 7. Future Work

*   **Multi-Process Support**: Enabling "Background Agents" with independent Context Registers.
*   **Kernel Debugger**: A specialized "Ring -1" mode for inspecting System Space without triggering security violations (for OS developers only).
*   **Signed Binaries**: Cryptographic verification of Skills before Ingestion.

---
*End of RFC 0015*

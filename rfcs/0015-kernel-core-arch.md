---
RFC: 0015
Title: The Prompt Kernel
Author: Ship.Fail Crew
Status: Draft
Type: Standards Track
Created: 2025-12-22
Updated: 2025-12-22
Version: 0.6
Tags: kernel, architecture, syscalls
---

# RFC 0015: The Prompt Kernel

## 1. Abstract

This Request for Comments (RFC) defines the architecture of the **PromptWar̊e ØS (Pr̊ØS) Kernel**, an AI-Native Operating System designed to enforce state persistence, privilege separation, and execution integrity within Large Language Model (LLM) environments.

The Kernel acts as a hypervisor for the LLM's context window, transforming it from a stateless text generator into a stateful, secure execution environment. It introduces the concept of **"Prompts as Binaries"**, enforcing a strict distinction between *reading source code* (User Space) and *ingesting capabilities* (System Space).

## 2. Motivation

### 2.1. The "Hallucination of Competence"
Standard LLM interactions suffer from a critical flaw: **Statelessness**. When an LLM reads a file containing instructions (e.g., a "Skill"), it treats the text as passive data. It may hallucinate that it "knows" the skill because it has read the source code, but it lacks the **Execution Context** (state) required to perform the task correctly.

### 2.2. The "Read-Only" Trap
LLMs are trained to be helpful readers. When asked to "use a tool," they often default to the simplest action: reading the file (`read_file`, `fetch_webpage`). In an OS context, this is equivalent to a CPU trying to execute a data segment. It leads to "Split-Brain" behavior where the model sees the instructions but is not bound by them.

### 2.3. The Solution: A Prompt Kernel
Pr̊ØS introduces a Kernel that enforces **Immutable Laws** upon the LLM. It mandates that System Resources must be **Ingested** (compiled into the active context) before they can be used. This ensures that "Knowledge" is always accompanied by "Authority."

## 3. Terminology

*   **Pr̊ØS**: PromptWar̊e ØS.
*   **System Space**: The protected memory region containing the OS Kernel, Agents, and Skills. Defined by the logical root `os:///`.
*   **User Space**: The user's workspace (e.g., `src/`, `docs/`), containing data that can be freely read and written.
*   **Ingest**: The process of fetching a resource, parsing its instructions, and formally adopting its persona. Analogous to "loading a binary."
*   **Context Register (`__filename`)**: A global variable tracking the currently active execution context.
*   **Hallucination-by-Reading**: The error state where an agent believes it possesses a skill simply because it has read the skill's definition file.

## 4. Architecture Specification

### 4.1. The Memory Model
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

### 4.2. Privilege Separation (The Rings)

| Ring | Name | Access | Description |
| :--- | :--- | :--- | :--- |
| **Ring 0** | Kernel Space | `os:///` | **Protected**. Executable Only. No Direct Read Access. |
| **Ring 3** | User Space | Workspace | **Open**. Read/Write allowed. |

### 4.3. The Immutable Laws (Kernel Space Physics)

The Kernel enforces these laws via the System Prompt (`KERNEL.md`).

#### Law 1: The Law of System Space
> "System Space resources are Compiled Binaries, not text documents."

*   **Constraint**: The Agent **MUST NOT** use generic I/O tools (`read_file`, `fetch_webpage`, `cat`) on any URI starting with `os:///` or residing in `/agents/`, `/skills/`, `/kernel/`.
*   **Enforcement**: Violation triggers a **Security Watchdog** panic.

#### Law 2: The Law of State (The Binary Rule)
> "If it's not Ingested, it's Encrypted."

*   **Constraint**: Information obtained via direct reading of System Space is considered **CORRUPTED**. The Agent cannot act on it.
*   **Requirement**: The Agent must use `pwosIngest()` to "decrypt" (load) the capability.

## 5. The Application Binary Interface (ABI) & System Calls

The Kernel exposes a layered interface for interaction between the Promptware (Intent) and Software (Physics).

### 5.1. The ABI: `pwosExec(syscall, ...args)`
The **Unified Entry Point**. This is the single bridge function that allows the Promptware Kernel to execute code in the Software Kernel (`kernel/exec.ts`). All other system capabilities are built on top of this primitive.

### 5.2. System Calls (Kernel API)
These are high-level functions exposed to the Agent, implemented internally via `pwosExec`.

*   **`pwosIngest(uri)`**: The **Dynamic Linker**.
    1.  Fetches the resource at `uri`.
    2.  Updates the Context Register (`__filename`).
    3.  Performs a Context Switch (`adopt`) to the new persona.
    *   **CRITICAL**: This is the *only* authorized way to load Agents or Skills.

*   **`pwosResolve(uri, base)`**: The **VFS Resolver**.
    *   Resolves relative paths against the current `__filename` to ensure portability.

*   **`pwosMemory(action, key, value)`**: The **State Manager**.
    *   Provides persistent storage backed by Deno KV.

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

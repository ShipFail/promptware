---
type: Technical Specification
strategy: Tiered Context (Layer 2)
audience: Human Architect, Deep Research Agent
format: Descriptive, Comprehensive, Explanatory
goal: Deep Understanding, Implementation Reference
relation: "Detail for [AGENTS.md]"
---

<!--
  PromptWar̊e ØS Architecture
  Copyright (c) 2025 Ship.Fail
  Licensed under the Public Prompt License - Apache Variant (PPL-A)
  See LICENSE for details.
-->

# Promptware OS Architecture (v0.6)

**Version**: 0.6.0
**Status**: Stable
**Philosophy**: "Promptware Intent, Software Physics."

## 1. Core Philosophy: Promptware/Software Dualism

Promptware OS v0.6 introduces a strict separation between **Intent** (what the AI wants) and **Physics** (what the machine does).

### 1.1 The Dual Kernels
*   **Promptware Kernel (`KERNEL.md`)**:
    *   **Role**: The "Soul" or "Mind".
    *   **Language**: English (Intent) + Literate TypeScript (Interface).
    *   **Function**: Defines the *Why* and *What*. It acts as a high-level dispatcher.
    *   **Analogy**: Ring 0 / User Space.
*   **Software Kernel (`syscalls/*.ts`)**:
    *   **Role**: The "Body" or "Hardware".
    *   **Language**: Pure TypeScript (Compiled Binary).
    *   **Function**: Defines the *How*. It handles I/O, memory, and path resolution deterministically.
    *   **Analogy**: Firmware / Hardware / BIOS.

### 1.2 The Bridge (`osExec`)
The system call `osExec` is the bridge that crosses the boundary. It takes a high-level intent from the Promptware Kernel and executes it as a low-level instruction in the Software Kernel via the Unified Entry Point (`exec.ts`).

## 2. Immutable Infrastructure

To solve the **Bootstrap Paradox** (where an Agent forgets its own root), we enforce a strict separation between Identity and State.

### 2.1 The Bootloader (Identity)
*   **Location**: System Prompt (Front Matter).
*   **Nature**: **Read-Only / Immutable**.
*   **Content**:
    *   `root`: The base URL of the OS (e.g., `https://raw.github.../os/`).
    *   `mounts`: The topology map (Virtual Path -> Physical URL).
    *   `init`: The entry point script.
*   **Principle**: A reboot always restores the system to the state defined in the Bootloader.

### 2.2 The Law of Anchoring
*   **Rule**: All internal OS paths must be relative to the **OS Root** or the **Current Context**.
*   **Mechanism**: The Software Kernel resolves paths against `params.root` (injected by `exec.ts`) to ensure portability.

## 3. The Software Kernel (`syscalls/*.ts`)

The "Hardware" is a collection of atomic TypeScript binaries located at `os/kernel/syscalls/`. It provides three core physical capabilities:

### 3.1 Path Resolution (`resolve`)
*   **Problem**: LLMs struggle with relative paths (`../`) and context.
*   **Solution**: The "TypeScript Import" Model.
*   **Mechanism**:
    *   The Kernel tracks a `__filename` register (the current context).
    *   `osResolve(uri, base)` delegates to the Software Kernel via `osExec`.
    *   The Software Kernel resolves `uri` relative to `base` (if relative) or `root` (if absolute).

### 3.2 JIT Linking (`ingest`)
*   **Problem**: Markdown files are "source code," not binaries. They need hydration.
*   **Solution**: Just-In-Time Compilation.
*   **Mechanism**:
    *   `osIngest(uri)` calls the Software Kernel via `osExec`.
    *   The Software Kernel fetches the content (local or remote).
    *   It parses the Front Matter (`skills`, `tools`).
    *   It resolves and injects the descriptions of those skills.
    *   It returns the "hydrated" prompt to the Agent.

### 3.3 Memory Subsystem (`memory`)
*   **Problem**: Agents need persistent state across sessions.
*   **Solution**: Deno KV.
*   **Mechanism**:
    *   `osMemory` calls the Software Kernel via `osExec`.
    *   The Software Kernel uses Deno KV to ensure cryptographic isolation between different OS instances.

## 4. The Promptware Kernel (`KERNEL.md`)

The "Assembly" layer exposes these physical capabilities to the Agent via a clean TypeScript interface.

### 4.1 System Calls (v0.6)
*   `osResolve(uri: string, base?: string): Promise<string>`
*   `osIngest(uri: string): Promise<void>`
*   `osMemory(action, key, value?): Promise<any>`
*   `osExec(syscall: string, ...args: any[]): Promise<any>`

### 4.2 The Context Register
*   `declare let __filename: string;`
*   This virtual register tracks the "Instruction Pointer" of the OS, allowing the Agent to know "where I am" for relative path resolution.

## 5. Boot Lifecycle

The system follows a strict, stateless boot sequence:

1.  **Power On**: The user provides the **Bootloader** configuration (System Prompt).
2.  **Kernel Load**: The LLM adopts the **Promptware Kernel** (`os/kernel/KERNEL.md`).
3.  **Init**:
    *   The Kernel calls `osIngest(params.init)`.
    *   The Software Kernel fetches and hydrates the Init Agent.
    *   The Kernel updates `__filename` to the Init URI.
    *   The Kernel performs a **Context Switch** (`adopt`), becoming the Agent.

## 6. Directory Structure

```
/
├── AGENTS.md           # The Constitution (L1 Context)
├── docs/               # Documentation (L2 Context)
│   └── architecture.md # This file
└── os/                 # The Operating System Root
    ├── BOOTLOADER.md   # Bootloader Spec
    ├── kernel/         # Kernel Space
    │   ├── KERNEL.md   # Promptware Kernel (Interface)
    │   ├── exec.ts     # Unified Entry Point
    │   └── syscalls/   # Software Kernel (Implementation)
    │       ├── resolve.ts      # Path Resolution
    │       ├── ingest.ts       # JIT Linker
    │       └── memory.ts       # Memory Subsystem
    ├── agents/         # User Space (Personas)
    └── skills/         # Shared Libraries (Capabilities)
```

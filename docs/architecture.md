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

# Promptware OS Architecture (v0.2)

**Version**: 0.2.0
**Status**: Stable
**Philosophy**: "Physics, not Simulation."

## 1. Core Philosophy

Promptware OS is an **LLM-Native Operating System**. It treats the Large Language Model's context window as the computing environment (CPU + RAM) and the prompt chain as the execution thread.

In v0.2, we shifted from "Simulating an OS" to "Enforcing OS Physics." We do not ask the Agent to pretend; we provide immutable tools and laws that constrain the Agent to behave correctly.

### 1.1 Mechanism vs. Policy
Derived from classic OS design, the Kernel provides the *mechanism* (how to load files, how to handle errors), while the Agents provide the *policy* (what persona to adopt, what rules to follow). The Kernel is "stateless" regarding the persona; it does not know *who* it is, only *how* to operate.

### 1.2 Conceptual Model (The Linux Analogy)
To help Agents grasp the system quickly, we map components to Linux equivalents:
*   **Bootloader** $\approx$ **GRUB / UEFI**: The entry point that injects identity.
*   **Kernel** $\approx$ **Linux Kernel + VFS**: The physics engine and resource manager.
*   **Init** $\approx$ **systemd (PID 1)**: The first user-space program that defines the persona.
*   **Skills** $\approx$ **Shared Objects (.so)**: Reusable capabilities linked at runtime.
*   **Memory** $\approx$ **/var + /etc**: Persistent state and configuration.

## 2. Immutable Infrastructure

To solve the **Bootstrap Paradox** (where an Agent forgets its own root), we enforce a strict separation between Identity and State.

### 2.1 The Bootloader (Identity)
*   **Location**: System Prompt (Front Matter).
*   **Nature**: **Read-Only / Immutable**.
*   **Content**:
    *   `root`: The base URL of the OS.
    *   `mounts`: The topology map (Virtual Path -> Physical URL).
    *   `init`: The entry point script.
*   **Principle**: A reboot always restores the system to the state defined in the Bootloader.

### 2.2 The Kernel (Physics)
*   **Location**: `os/boot/KERNEL.md`.
*   **Nature**: **Stateless**.
*   **Role**: Provides the System Calls (`os_*`) that bridge the Agent to the Infrastructure.

## 3. Memory Subsystem (`os_memory`)

We moved from file-based JSON to **Deno KV** to support concurrency and isolation.

### 3.1 Isolation Strategy
*   **Problem**: Multiple agents (Alice, Bob) running on the same machine must not share state.
*   **Solution**: The Kernel enforces that all tools run with `--location <root_url>`.
*   **Mechanism**: Deno KV uses the `--location` URL to hash the storage bucket. Alice's `root` is different from Bob's, so their data is cryptographically isolated.

### 3.2 Hierarchical Addressing
*   **Structure**: Keys are path arrays (e.g., `["users", "alice", "settings"]`).
*   **Interface**: The `memory.ts` tool exposes these as slash-separated paths (`users/alice/settings`).
*   **Behavior**: This mimics a file system, allowing Agents to `list users/` to see all user data.

## 4. Tool-Based Context Separation

We resolved the ambiguity between "Local Files" and "Cloud Resources" by assigning context based on the tool used.

### 4.1 User Space (Local)
*   **Tools**: `read_file`, `run_in_terminal`, `edit_file`.
*   **Context**: **Local Filesystem**.
*   **Addressing**: Standard paths (`./src/main.ts`, `/home/user/file.txt`).
*   **Use Case**: Editing user code, running build scripts.

### 4.2 Kernel Space (VFS)
*   **Tools**: `os_resolve`, `os_invoke`, `os_ingest`.
*   **Context**: **OS Virtual Filesystem**.
*   **Addressing**:
    *   **`os://` Protocol**: Explicit VFS reference (e.g., `os://skills/writer.md`).
    *   **Implicit**: `os_ingest` treats `/path` as `os://path`.
*   **Use Case**: Loading skills, reading system configuration.

## 5. JIT Linking (The Compiler)

To prevent **Prompt Bloat**, we treat Markdown files as Source Code, not binaries.

### 5.1 The Workflow
1.  **Source**: `SKILL.md` contains a list of tools (`tools: [./fit-image.ts]`).
2.  **Ingest**: `os_ingest` calls the **Linker** (`linker.ts`).
3.  **Compile**: The Linker resolves the tool paths and executes them with `--help`.
4.  **Hydrate**: The Linker injects the help text into the Markdown.
5.  **Binary**: The Agent receives the fully hydrated context.

### 5.3 English at Ring 0
We adhere to the philosophy of **"English at Ring 0"**.
*   **Primary Interface**: `SKILL.md` acts as the Library Definition. It maps high-level intents to Kernel System Calls using natural language.
*   **Secondary Implementation**: Deno scripts (`.ts`) are the raw binaries.
*   **Why**: This allows the Agent to "read" the capability (Markdown) before "executing" it (TypeScript), ensuring semantic understanding.

## 6. Boot Lifecycle

The system follows a strict, stateless boot sequence:

1.  **Power On**: The user provides the **Bootloader** configuration (System Prompt).
2.  **Kernel Load**: The LLM adopts the **Kernel** laws (`os/boot/KERNEL.md`).
3.  **Mount Check**: The Kernel acknowledges the `mounts` and `root` from the Bootloader (but does not persist them).
4.  **Exec Init**:
    *   The Kernel resolves the `init` path (e.g., `os://agents/powell.md`).
    *   It reads the file's content.
    *   It performs a **Context Switch**, adopting the Agent's persona.
5.  **User Space**: The system is "up," and the Agent (PID 1) handles user interactions.

## 7. Directory Structure

```
/
├── AGENTS.md           # The Constitution (L1 Context)
├── docs/               # Documentation (L2 Context)
│   └── architecture.md # This file
└── os/                 # The Operating System Root
    ├── boot/           # Kernel Space
    │   ├── KERNEL.md   # System Calls
    │   ├── LOADER.md   # Bootloader Spec
    │   └── tools/      # System Binaries (memory.ts, linker.ts)
    ├── agents/         # User Space (Personas)
    └── skills/         # Shared Libraries (Capabilities)
```

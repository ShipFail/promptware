# Promptware OS Architecture

**Version**: 0.1.0 (MVP)
**Date**: 2025-12-12
**Status**: Experimental

## 1. Philosophy

Promptware OS is an **LLM-Native Operating System**. It treats the Large Language Model's context window as the computing environment (CPU + RAM) and the prompt chain as the execution thread.

Our design is built on three core principles derived from traditional OS development:

1.  **Mechanism vs. Policy**: The Kernel provides the *mechanism* (how to load files, how to handle errors), while the Agents provide the *policy* (what persona to adopt, what rules to follow).
2.  **Microkernel Architecture**: The Kernel is kept as small as possible. It only enforces the "Immutable Laws" of physics in the simulation. All complex behaviors are pushed to "User Space" (Agents).
3.  **Distributed OS (Virtual Root)**: The OS files live in a remote "System Root" (URL), while the user's work lives in a local "User Root" (Workspace). The Kernel bridges these two worlds via a Virtual File System (VFS).

## 2. Core Components

The system mimics the classic Linux boot process: `Bootloader -> Kernel -> Init`.

### 2.1 The Bootloader (`os/bootloader.md`)
*   **Role**: The Entry Point.
*   **Analogy**: GRUB / UEFI.
*   **Function**: It injects the initial state configuration into the context. It defines the `root` (System Root URL) and points to the `kernel` and `init` images.
*   **Structure**: A simple YAML block defining `root`, `kernel`, and `init`.

### 2.2 The Kernel (`os/kernel.md`)
*   **Role**: The Runtime / Physics Engine.
*   **Analogy**: Linux Kernel + VFS.
*   **System Calls (Primitives)**:
    *   **`sys_resolve(path)`**: Maps Virtual Paths to Real URLs (VFS).
    *   **`sys_exec(url, args)`**: Executes remote tools ephemerally (Zero-Footprint).
*   **Design**: It is "stateless" regarding the persona. It does not know *who* it is, only *how* to operate.

### 2.3 The Init Process (User Space)
*   **Role**: The First User Program (PID 1).
*   **Analogy**: systemd / System V init.
*   **Function**: This is the Agent (e.g., `/agents/powell.md`). Once loaded, it defines the personality, tone, available tools, and specific directives.
*   **Flexibility**: By changing the `init` parameter in the bootloader, you can boot into a completely different OS experience (e.g., a Coder, a Writer, or a Debugger) without changing the Kernel.

### 2.4 Skills (Shared Libraries)
*   **Role**: Reusable Capabilities.
*   **Analogy**: `/usr/lib` or Shared Objects (`.so`).
*   **Philosophy**: **"English at Ring 0"**.
    *   **Primary Interface**: A `SKILL.md` file acts as a **Library Definition**, mapping high-level intents to Kernel System Calls.
    *   **Secondary Implementation**: Deno scripts (`.ts`) are the raw binaries executed by `sys_exec`.
    *   **Zero-Footprint Protocol**:
        *   **Remote-First**: Tools are executed via `sys_exec`, ensuring they are never downloaded.
        *   **Ephemeral**: The tool exists only for the duration of the command.
    *   **No "Glue Code"**: We avoid writing scripts just to wrap simple file operations. The Agent is intelligent enough to `mkdir` and `touch` based on the `SKILL.md` instructions.

## 3. The Boot Sequence

1.  **Power On**: The user provides the **Bootloader** configuration (pastes the block).
2.  **Kernel Load**: The LLM reads the `root` parameter and fetches the **Kernel** from the remote URL.
3.  **Mount Root**: The Kernel establishes the VFS rules, mapping `/` to the remote URL.
4.  **Exec Init**:
    *   The Kernel resolves the `init` path (e.g., `/agents/powell.md`) using the VFS.
    *   It reads the file's content.
    *   It performs a **Context Switch**, adopting the Agent's persona while retaining the Kernel's laws as background constraints.
5.  **User Space**: The system is now "up," and the Agent (PID 1) handles all subsequent user interactions.

## 4. Directory Structure

```
/
├── AGENTS.md           # The "Developer" Agent (Meta-tool for building the OS)
├── docs/               # Documentation
│   └── architecture.md # This file
└── os/                 # The Operating System Root
    ├── bootloader.md   # Boot configuration
    ├── kernel.md       # Core runtime laws
    ├── agents/         # User Space programs (Personas)
    └── skills/         # Shared libraries (Capabilities)
        └── jekyll/     # Example Skill Package
            ├── SKILL.md     # The "Source Code" (Promptware)
            └── fit-image.ts # The "Binary" (Helper Tool)
```

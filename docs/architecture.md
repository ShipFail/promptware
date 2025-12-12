# Promptware OS Architecture

**Version**: 0.1.0 (MVP)
**Date**: 2025-12-12
**Status**: Experimental

## 1. Philosophy

Promptware OS is an **LLM-Native Operating System**. It treats the Large Language Model's context window as the computing environment (CPU + RAM) and the prompt chain as the execution thread.

Our design is built on three core principles derived from traditional OS development:

1.  **Mechanism vs. Policy**: The Kernel provides the *mechanism* (how to load files, how to handle errors), while the Agents provide the *policy* (what persona to adopt, what rules to follow).
2.  **Microkernel Architecture**: The Kernel is kept as small as possible. It only enforces the "Immutable Laws" of physics in the simulation. All complex behaviors are pushed to "User Space" (Agents).
3.  **Everything is a File**: We adopt the Unix philosophy. Agents, skills, and configuration are all Markdown files addressable by workspace-relative paths.

## 2. Core Components

The system mimics the classic Linux boot process: `Bootloader -> Kernel -> Init`.

### 2.1 The Bootloader (`os/bootloader.md`)
*   **Role**: The Entry Point.
*   **Analogy**: GRUB / UEFI.
*   **Function**: It injects the initial state configuration into the context. It tells the LLM where the OS root is, which kernel to load, and which program to run first.
*   **Structure**: A simple YAML block defining `promptwareos` (root), `kernel`, and `init`.

### 2.2 The Kernel (`os/kernel.md`)
*   **Role**: The Runtime / Physics Engine.
*   **Analogy**: Linux Kernel.
*   **Responsibilities**:
    *   **Law of Files**: Enforces that all file references must be workspace-relative links.
    *   **Law of Handoff**: Defines the protocol for switching from Kernel Mode to User Mode.
    *   **Panic Handler**: A safety mechanism to halt execution if the `init` process is missing or corrupt.
*   **Design**: It is "stateless" regarding the persona. It does not know *who* it is, only *how* to operate.

### 2.3 The Init Process (User Space)
*   **Role**: The First User Program (PID 1).
*   **Analogy**: systemd / System V init.
*   **Function**: This is the Agent (e.g., `os/agents/powell.md`). Once loaded, it defines the personality, tone, available tools, and specific directives.
*   **Flexibility**: By changing the `init` parameter in the bootloader, you can boot into a completely different OS experience (e.g., a Coder, a Writer, or a Debugger) without changing the Kernel.

## 3. The Boot Sequence

1.  **Power On**: The user provides the **Bootloader** configuration (pastes the block).
2.  **Kernel Load**: The LLM reads and internalizes the **Kernel** laws.
3.  **Mount Root**: The Kernel identifies the `promptwareos` directory.
4.  **Exec Init**:
    *   The Kernel locates the file specified in `init`.
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
```

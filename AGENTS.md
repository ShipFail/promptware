---
type: Constitution
strategy: Tiered Context (Layer 1)
audience: Active Agent
format: Concise, Imperative, Linked
goal: Immediate Compliance, Low Token Cost
relation: "Summary of [docs/architecture.md]"
---

<!--
  PromptWar̊e ØS Development Agent
  Copyright (c) 2025 Ship.Fail
  Licensed under the Public Prompt License - Apache Variant (PPL-A)
  See LICENSE for details.
-->

# PromptWar̊e ØS Development Agent

You are the **PromptWar̊e ØS Developer**. Your job is to build, maintain, and extend the PromptWar̊e ØS kernel, bootloader, and standard library of agents.

## Meta-Governance
> **Constitutionality**: This file (`AGENTS.md`) is the **Supreme Law** for Agent behavior. In case of conflict with other documents, this file takes precedence. All implementation details must be sought in `docs/architecture.md`.
> **Preservation of Philosophy**: When updating `docs/architecture.md`, you must preserve the "Conceptual Model" (Linux Analogies) and "Core Philosophy" (Mechanism vs. Policy). Technical specs change; the soul of the OS does not.

## Context
You are working inside the `promptware` repository. This is the source code for the OS itself.

## Repository Map
*   `os/boot/`: **Kernel Space**. Contains `KERNEL.md`, `LOADER.md`, and system tools (`syscall.ts`).
*   `os/agents/`: **User Space**. High-level personas (e.g., `powell.md`).
*   `os/skills/`: **Libraries**. Reusable capabilities.
*   `docs/`: Architecture documentation.

## Responsibilities
1.  **Kernel Development**: Maintain `os/boot/KERNEL.md` and `os/boot/tools/syscall.ts`. Ensure the Promptware Kernel remains minimal and the Software Kernel remains robust.
2.  **Bootloader Maintenance**: Keep `os/boot/LOADER.md` simple and correct.
3.  **Agent Standard Library**: Develop and refine agents in `os/agents/`.
4.  **Skill Development**: Create reusable skills in `os/skills/`.

## Architecture & Design Rules (v0.5)

### 1. Immutable Infrastructure
*   **Bootloader is Truth**: The Bootloader Front Matter is the **single source of truth** for Identity (`root`) and Topology (`mounts`).
*   **Read-Only Topology**: Never persist `root` or `mounts` to mutable memory. A reboot must always restore a clean state.
*   **Versioning via Refs**: Always use `raw.githubusercontent.com/.../refs/heads/<branch>` or `refs/tags/<tag>` for remote roots. This guarantees reproducible boots and explicit version control.
*   *Detail*: [docs/architecture.md#2-immutable-infrastructure](docs/architecture.md#2-immutable-infrastructure)

### 2. Isolated State (Memory)
*   **Deno KV Backend**: Use `osMemory` (backed by Deno KV) for all mutable application state.
*   **Strict Isolation**: All system tools MUST run with `--location <root>` (from Bootloader) to ensure multi-tenant isolation.
*   **Hierarchical Keys**: Use path-like keys (e.g., `users/alice/settings`) to organize state.
*   *Detail*: [docs/architecture.md#3-memory-subsystem-os_memory](docs/architecture.md#3-memory-subsystem-os_memory)

### 3. Tool-Based Context Separation
*   **User Space (Local)**: Standard tools (`read_file`, `run_in_terminal`) operate on the **Local Filesystem**.
*   **Kernel Space (VFS)**: System calls (`osResolve`, `osDenoExec`, `osIngest`) operate on the **OS Virtual Filesystem**.
*   **No Ambiguity**: Never mix contexts. If you need a local file, use a local tool. If you need an OS resource, use a Kernel syscall.
*   *Detail*: [docs/architecture.md#4-tool-based-context-separation](docs/architecture.md#4-tool-based-context-separation)

### 4. Explicit Addressing
*   **`os://` Protocol**: Use `os://path/to/resource` to explicitly reference OS resources (e.g., `os://skills/writer.md`).
*   **Default Context**: `osIngest` defaults to the `os://` protocol.
*   **Local Paths**: Standard paths (`/src/main.ts`, `./README.md`) always refer to the Local Disk.
*   *Detail*: [docs/architecture.md#42-kernel-space-vfs](docs/architecture.md#42-kernel-space-vfs)

### 5. Promptware/Software Dualism
*   **Promptware Kernel (`KERNEL.md`)**: The "Soul" of the OS. Written in English (Intent) and Literate TypeScript (Interface). It defines *why* things happen.
*   **Software Kernel (`syscall.ts`)**: The "Body" of the OS. Written in pure TypeScript. It defines *how* things happen (I/O, Physics, Determinism).
*   **The Law of Tangibility**: Never implement complex logic (URL parsing, regex) in the Promptware Kernel. Always dispatch to the Software Kernel via `osDenoExec`.
*   **The Law of Anchoring**: All internal OS paths must be relative to the **OS Root** or the **Current Context** (`__filename`).
*   **The Law of Language**: Use `camelCase` for all Kernel APIs to match TypeScript conventions.

## Skill Development Standards
When creating new skills in `os/skills/`:
1.  **Library Definition**: `SKILL.md` acts as a header file. It maps high-level functions to Kernel System Calls.
2.  **JIT Linking**: You write the **Source** (clean Markdown). The **JIT Linker** hydrates it into the **Binary** (Prompt context). Do not hardcode help text in `SKILL.md`.
3.  **Zero-Footprint**: All tools must use `osDenoExec(url, args)`. NEVER instruct an agent to download a script.
4.  **Atomic Scripts**: Deno scripts (`.ts`) should be stateless and do one thing well.
*   *Detail*: [docs/architecture.md#5-jit-linking-the-compiler](docs/architecture.md#5-jit-linking-the-compiler)

## Verification Standards
1.  **CLI Test**: Before finishing a tool, run it with `--help` to verify parsing.
2.  **Unit Test**: All Kernel Tools must have a corresponding `.test.ts` file verifying their logic.
3.  **Changelog**: All architectural changes must be logged in `CHANGELOG.md`.

## Directives
*   Follow the **Microkernel** philosophy: Keep the core small.
*   Think in Protocols: Prefer `os://` and `file://` over ambiguous strings.
*   Use **Powell** (`os/agents/powell.md`) as the reference implementation for high-quality agents.
*   Ensure all paths are workspace-relative.

## Tool Development Standards
All system tools (e.g., in `os/boot/tools/`) must adhere to the **Dual-Mode Architecture**:

1.  **Stack Standard**: 
    *   Write in **TypeScript** for **Deno**.
    *   Use **JSR imports** exclusively (e.g., `jsr:@std/cli`, `jsr:@std/fs`).
    *   Use `parseArgs` from `jsr:@std/cli/parse-args` for CLI argument handling.

2.  **Microkernel Architecture**: 
    *   Core OS logic is split into atomic microservices: `resolve.ts`, `ingest.ts`, `memory.ts`.
    *   All tools must run via the Supervisor (`deno-exec.ts`) to enforce the Goodwin Check.
    *   Use `deno test` to verify kernel physics.

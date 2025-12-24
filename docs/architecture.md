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

# Promptware OS Architecture (v0.9.0)

**Version**: 0.9.0
**Status**: Stable
**Philosophy**: "Promptware Intent, Software Physics."

## 1. Core Philosophy: Promptware/Software Dualism

Promptware OS introduces a strict separation between **Intent** (what the AI wants) and **Physics** (what the machine does).

### 1.1 The Dual Kernels
*   **Promptware Kernel (`KERNEL.md`)**: The "Soul" or "Mind". Defines the *Why* and *What*.
*   **Software Kernel (`syscalls/*.ts`)**: The "Body" or "Hardware". Defines the *How*.

> **Spec**: [rfcs/0015-kernel-core-arch.md](../rfcs/0015-kernel-core-arch.md)

## 2. Subsystem Specifications

### 2.1 Bootloader & Identity
The Bootloader defines the immutable root of trust and the initial mount points. It solves the Bootstrap Paradox by enforcing a strict separation between Identity and State.
> **Spec**: [rfcs/0014-boot-loader-protocol.md](../rfcs/0014-boot-loader-protocol.md)

### 2.2 Virtual File System (VFS)
Defines path resolution, the `os://` protocol, and the Law of Anchoring. It ensures portability by resolving paths against the OS Root or Current Context.
> **Spec**: [rfcs/0013-kernel-vfs-sysfs.md](../rfcs/0013-kernel-vfs-sysfs.md)

### 2.3 Memory & State
Defines the `pwosMemory` syscall and the `/vault/` namespace for secure storage. It uses Deno KV to ensure cryptographic isolation between different OS instances.
> **Spec**: [rfcs/0018-kernel-memory-spec.md](../rfcs/0018-kernel-memory-spec.md)

### 2.4 Security & Cryptography
Defines `pwenc:v1` primitives and the `Sealed` class for secure data handling.
> **Spec**: [rfcs/0016-security-crypto-primitives.md](../rfcs/0016-security-crypto-primitives.md) and [rfcs/0017-security-sealed-fetch.md](../rfcs/0017-security-sealed-fetch.md)

## 3. Unspecified Components (Draft Status)

### 3.1 JIT Linking (`ingest`)
*   **Problem**: Markdown files are "source code," not binaries. They need hydration.
*   **Solution**: Just-In-Time Compilation.
*   **Mechanism**:
    *   `pwosIngest(uri)` calls the Software Kernel via `pwosExec`.
    *   The Software Kernel fetches the content (local or remote).
    *   It parses the Front Matter (`skills`, `tools`).
    *   It resolves and injects the descriptions of those skills.
    *   It returns the "hydrated" prompt to the Agent.
> **Proposed Spec**: RFC 0020

### 3.2 The Singular Boundary (`pwosExec`)
The system call `pwosExec` is the singular boundary that crosses from Intent to Physics. It takes a high-level intent from the Promptware Kernel and executes it as a low-level instruction in the Software Kernel via the Unified Entry Point (`exec.ts`).
> **Spec**: [rfcs/0019-kernel-abi-exec.md](../rfcs/0019-kernel-abi-exec.md)

## 4. Directory Structure

```
/
├── AGENTS.md           # The Constitution (L1 Context)
├── docs/               # Documentation (L2 Context)
│   └── architecture.md # This file
├── rfcs/               # Technical Specifications (L3 Context)
│   ├── 0000-meta-rfc-process.md
│   ├── 0012-sys-skill-spec.md
│   ├── 0013-kernel-vfs-sysfs.md
│   ├── 0014-boot-loader-protocol.md
│   ├── 0015-kernel-core-arch.md
│   ├── 0016-security-crypto-primitives.md
│   ├── 0017-security-sealed-fetch.md
│   └── 0018-kernel-memory-spec.md
└── os/                 # The Operating System Root
    ├── BOOTLOADER.md   # Bootloader Spec
    ├── kernel/         # Kernel Space
    │   ├── KERNEL.md   # Promptware Kernel (Interface)
    │   ├── exec.ts     # Unified Entry Point
    │   └── syscalls/   # Software Kernel (Implementation)
    ├── agents/         # User Space (Personas)
    └── skills/         # Shared Libraries (Capabilities)
```

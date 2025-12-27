---
rfc: 0002
title: No Cargo Culting
author: Ship.Fail Crew
status: Draft
type: Meta
created: 2025-12-27
updated: 2025-12-27
version: 1.0
tags: [meta, design-principle, philosophy]
---

# RFC 0002: No Cargo Culting

## 1. Summary

This RFC establishes the **"No Cargo Culting"** design principle for PromptWar̊e ØS. It mandates that the project MUST NOT adopt names, structures, or rituals from Linux/Unix unless the underlying mechanism, constraint, and invariant are also present (or an explicit, enforceable substitute exists).

## 2. Motivation

PromptWar̊e ØS uses an LLM as its "CPU" and context as its "RAM". While Unix metaphors are powerful for explaining this architecture, blindly adopting terms like "Kernel", "Ring 0", or "Exec" without their corresponding enforcement mechanisms leads to:
1.  **False Security**: Users assume protections (like hardware isolation) that do not exist.
2.  **Architectural Drift**: The system evolves to mimic the *appearance* of Linux rather than solving the actual problems of LLM orchestration.
3.  **Cognitive Dissonance**: Developers struggle when the behavior of a "Syscall" doesn't match their mental model from traditional OS development.

## 3. The Principle

> **Principle: No Cargo Culting**
>
> PromptWareOS MUST NOT adopt names, structures, or rituals from Linux/Unix unless the underlying mechanism, constraint, and invariant are also present (or an explicit, enforceable substitute exists).

## 4. The Checklist

For every borrowed term or pattern (e.g., "kernel", "ring 0", "syscall", "exec"), the specification MUST explicitly define the following five attributes. If these cannot be defined, the term MUST NOT be used (or must be explicitly marked as a metaphor).

1.  **Mechanism**: What enforces it? (hardware / sandbox / policy engine / signature verification / capability tokens)
2.  **Boundary**: What is allowed on each side? What is forbidden?
3.  **Invariant**: What must always be true? (determinism, immutability, privilege separation, auditability)
4.  **Failure mode**: What happens if violated? (hard fail, soft fail, quarantine, degraded mode)
5.  **Proof by test**: One concrete test that would fail if the mechanism is missing.

## 5. Naming Rules

If a Linux term is used but the mechanism is weaker or different, the spec MUST either:

1.  **Rename** it to a softer term (e.g., use "skill call" instead of "syscall", or "shell" instead of "exec").
2.  **Explicitly Mark** it as a metaphor: `METAPHOR ONLY`. This signals that the term is for conceptual understanding and does not carry a compatibility promise.

## 6. The "North Star" Rule

When deciding whether to borrow a concept, apply this test:

> **"If this mechanism is removed, does the system become unsafe or incorrect?"**

*   **YES**: It is a structural component. You may borrow the term if you implement the enforcement.
*   **NO** (It just makes things less pretty): It is a metaphor. Use a different name or mark it clearly.

## 7. Classification of Concepts

To assist with the audit of existing and future concepts, use this classification guide:

### 7.1. Structural (Safe to Borrow)
These are real "causal" ideas where the mechanism is implemented.
*   **System call boundary**: A single mediated entry interface with enforcement.
*   **ABI contract**: Stable schemas + versioning + compatibility promises.
*   **Capability/permission model**: Deny-by-default, explicit grants.
*   **Init/supervisor**: Lifecycle management of tasks.
*   **Immutable boot parameters**: Provenance + reproducibility.

### 7.2. Semantic (Borrow with Redefinition)
These work if explicitly redefined for the LLM context.
*   **Kernel**: Authoritative orchestrator + policy engine (not hardware-privileged).
*   **Rings**: Privilege tiers enforced by policy/capabilities (not CPU rings).
*   **Mount/FS**: Namespace mapping between repos, KV, and remote resources.

### 7.3. Metaphor-Only (Dangerous)
Use only if clearly marked.
*   **"Kernel mode" vs "User mode"**: Unless real isolation exists.
*   **Syscall numbers**: Unless a numeric ABI is required for compatibility.
*   **Signals**: Unless async interrupts are modeled precisely.
*   **ELF/Process Image**: Unless code/memory is truly replaced or relocated.

## 8. Implementation Plan

1.  **Audit**: Review all existing RFCs and Code against this principle.
2.  **Refactor**: Rename terms that fail the checklist (e.g., `exec` -> `shell`).
3.  **Enforce**: Require this checklist for all future RFCs introducing new architectural concepts.

---
End of RFC 0002

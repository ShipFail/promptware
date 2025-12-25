---
rfc: 0013
title: Sysfs and Procfs
author: Huan Li, ChatGPT 5.2 Thinking
status: Draft
type: Standards Track
created: 2025-12-20
updated: 2025-12-20
version: 0.1
tags: [vfs, sys, proc, kernel]
---

# RFC 0013: Sysfs and Procfs

## 1. Summary

This RFC defines two virtual filesystem surfaces for interacting with a PromptWar̊e ØS runtime: `/sys` as the validated control plane for mutation, and `/proc` as the read-only belief surface for introspection. It sets core invariants, naming and hierarchy rules, extension points, and stability boundaries, with explicit lessons from Linux procfs/sysfs/debugfs and the namespaces era.

---

## 2. Motivation

Linux procfs began as introspection but grew writable knobs, creating accidental ABIs, brittle automation, and unsafe mutation-by-inspection. Sysfs later introduced a cleaner object model with single-value attributes and validation, improving control-plane clarity. Containers and namespaces further showed that process-visible state depends on viewpoint.

PromptWar̊e ØS adopts these lessons: strict separation of observation and control, explicit stability boundaries, and a first-class concept that `/proc` reflects a viewpoint-relative belief.

---

## 3. Goals & Non-Goals

### Goals

- Hard separation of concerns: `/proc` read-only introspection, `/sys` validated control.
- Low cognitive load through consistent naming and hierarchy.
- Composable tooling using text interfaces.
- Stable core paths and semantics; flexible extensions.
- Multi-agent support with global and per-agent overlays.

### Non-Goals

- A general-purpose configuration language inside `/sys`.
- Stable formats for every introspection view.
- Full policy introspection in v0.1.

---

## 4. Detailed Design

### 4.1 Terminology

- Agent: An execution entity running within PromptWareOS.
- Agent Identity (AgentID): Stable logical identity.
- Incarnation: A specific running instance of an AgentID (ephemeral).
- Skill: A capability module addressable by an identifier.
- Belief Surface: A read-only, best-effort view of what the system believes.
- Control Plane: A mutation interface expressing what the system can change.
- Attribute File: A file containing exactly one semantic value, newline-terminated.

### 4.2 Core Principles

P1. `/proc` is read-only by construction.
- Normative: All `/proc` nodes MUST be non-writable.

P2. `/sys` is the only mutation surface.
- Normative: Any operation that mutates agent or system state MUST be expressible via `/sys` or tools that delegate to `/sys`.

P3. `/sys` attribute files are single-value and newline-terminated.
- Normative: A `/sys` attribute file MUST contain exactly one semantic value, be newline-terminated on read, accept a single value on write, and reject invalid values with a clear error.

P4. `/proc` may be rich.
- Normative: `/proc` nodes MAY expose tabular layouts, multi-line summaries, and human-readable narratives.
- Advisory: Views intended for automation SHOULD use stable, machine-readable formats (e.g., key=value blocks).

P5. Global surfaces and agent overlays.
- Normative: PromptWareOS MUST provide both global system surfaces and per-agent overlays.

P6. Mixed write semantics in `/sys`.
- Normative: Attribute-level writes MUST be atomic (succeed or fail immediately).
- Normative: Object-level state MAY be reconciling, where multiple attributes jointly define intent and the runtime converges.

### 4.3 Namespace Layout

Top-level roots:
- `/sys` for control-plane mutation.
- `/proc` for belief-surface introspection.

Global surfaces:
- `/sys/system/...`
- `/proc/system/...`

Agent overlays:
- `/sys/agents/{agent-id}/...`
- `/proc/agents/{agent-id}/...`

Agent identity vs incarnation:
- Normative: `{agent-id}` identifies a stable logical identity.
- Normative: Incarnation-specific views MUST appear under an explicit incarnation subtree:
  - `/sys/agents/{agent-id}/incarnations/{incarnation-id}/...`
  - `/proc/agents/{agent-id}/incarnations/{incarnation-id}/...`

### 4.4 `/sys` Specification

Invariants:
- `/sys` is a control plane.
- `/sys` writes MUST validate and fail safely.
- `/sys` paths MUST be semantic, predictable, and stable within the core contract.

Canonical objects:
- Agents:
  - `/sys/agents/{agent-id}/status` (read-only attribute)
  - `/sys/agents/{agent-id}/lifecycle/desired_state` (writable attribute)
- Skills:
  - `/sys/agents/{agent-id}/skills/{skill-id}/status`
  - `/sys/agents/{agent-id}/skills/{skill-id}/enable`

Scripts (authoritative control plane):
- Normative: Script material that is part of the authoritative control plane MUST live under `/sys`.
- Example layout:
  - `/sys/agents/{agent-id}/skills/{skill-id}/scripts/{script-id}/source`
  - `/sys/agents/{agent-id}/skills/{skill-id}/scripts/{script-id}/version`
  - `/sys/agents/{agent-id}/skills/{skill-id}/scripts/{script-id}/enabled`

Memory (control surface):
- Normative: Mutation of memory state MUST be via `/sys`.
- Example:
  - `/sys/memory/{key}` (writable attribute)
- Advisory: For complex values, the value SHOULD be a compact serialization (e.g., JSON) while still treated as a single value.

Atomic vs reconciling examples:
- Atomic: `/sys/agents/{agent-id}/skills/{skill-id}/enable` toggles immediately.
- Reconciling: an object may have multiple `desired_*` attributes which the runtime converges on.

### 4.5 `/proc` Specification

Invariants:
- `/proc` is read-only.
- `/proc` expresses belief; outputs MAY be viewpoint-relative.
- `/proc` may present rich, narrative diagnostics.

Canonical views:
- System belief views:
  - `/proc/system/summary`
  - `/proc/system/health`
  - `/proc/system/mounts` (conceptual analog of Linux mount views)
- Agent belief views:
  - `/proc/agents/{agent-id}/summary`
  - `/proc/agents/{agent-id}/belief`
  - `/proc/agents/{agent-id}/skills` (table)
  - `/proc/agents/{agent-id}/memory` (summary)
- Incarnation views:
  - `/proc/agents/{agent-id}/incarnations/{incarnation-id}/trace`
  - `/proc/agents/{agent-id}/incarnations/{incarnation-id}/context`

### 4.6 Extension and Registration Model

User-registered `/proc` entries:
- Normative: PromptWareOS MUST allow users and modules to register additional `/proc` views.
- Normative: User-registered `/proc` entries MUST be read-only.

Stability:
- Normative: The core runtime MUST NOT treat extension `/proc` nodes as stable ABI.
- Advisory: Extension nodes SHOULD include a header line indicating producer name, semantic version, and stability level (`volatile | experimental | stable`).

Collision rules:
- Normative: The core namespace under `/proc/system` and `/proc/agents` is reserved.
- Normative: Extensions MUST NOT register nodes that shadow core paths.

### 4.7 Naming and Hierarchy Rules

These rules are normative for core paths and strongly recommended for extensions.

R1. Identity becomes a directory.
- Use directories for entities: `agents/{agent-id}`, `skills/{skill-id}`, `scripts/{script-id}`.

R2. Attributes are files.
- Use files for single semantic values.

R3. Control paths are deep; `/proc` may flatten for readability.
- Use deeper hierarchies in `/sys` for precision; prefer flatter, readable `/proc` layouts.

R4. Prefer semantic, action-free names.
- Prefer `enable`, `status`, `desired_state` over imperative verbs.

R5. Never rename core nodes; deprecate instead.
- Core path stability is maintained by deprecation and aliasing, not renaming.

---

## 5. Compatibility

- Backward compatibility: Core invariants and reserved paths are stable within the 0.x series.
- Forward compatibility: Extensions MUST assume `/proc` outputs can evolve and SHOULD pin to explicit versions if required.
- Migration: Any change to core path meaning requires a new RFC and deprecation plan.

### Boot-era evolution and revision history

- Core invariants MUST remain stable.
- Specific node sets may evolve between 0.x releases.
- Revision history is append-only:
  - 0.1.0 (2025-12-20): Initial draft.

---

## 6. Rationale

Separating `/sys` and `/proc` avoids the historical failure mode of writable introspection surfaces. Single-value attribute files are human-friendly, easy to validate, and allow deterministic tooling. Rejecting a separate debugfs in v0.1 preserves surface area and forces debug views to remain read-only. Avoiding policy introspection keeps sensitive or trust-dependent logic out of the belief surface until a dedicated policy RFC exists.

---

## 7. Alternatives Considered

- Writable `/proc` tunables: rejected due to accidental ABI and safety risks.
- Separate `debugfs`: deferred to reduce surface area; debug content remains under `/proc` as read-only.
- Fully introspectable policy: rejected for v0.1 due to security and complexity.

---

## 8. Security Considerations

- Normative: This RFC does not define the policy model.
- Normative: `/proc` MUST NOT reveal policy internals.

Rationale: Policy introspection requires careful design to avoid leaking sensitive constraints or control logic.

---

## 9. Implementation Plan

1. Define the `/sys` and `/proc` VFS roots and mount points in the kernel.
2. Implement attribute read/write validation for `/sys` with explicit error typing.
3. Add canonical core nodes for system and agent views.
4. Implement `/proc` rendering with optional machine-readable headers.
5. Provide a registration interface for user `/proc` extensions with collision checks.

---

## 10. Future Directions

- A dedicated policy visibility RFC with controlled exposure.
- Optional structured schemas for `/proc` tables.
- A separate debug surface if `/proc` becomes overloaded.

---

## 11. Unresolved Questions

1. Should `/sys/memory/{key}` support hierarchical keys, or only flat keys?
2. Should scripts under `/sys` be immutable content-addressed objects with a separate `enabled` attribute?
3. What is the canonical list format for `/proc/.../skills` tables?
4. How should reconciliation loops report progress (purely in `/proc`, or via `/sys/.../status` too)?

---

## 12. References

- https://www.kernel.org/doc/html/latest/filesystems/proc.html
- https://www.kernel.org/doc/html/latest/filesystems/sysfs.html
- https://www.kernel.org/doc/html/latest/filesystems/debugfs.html
- https://man7.org/linux/man-pages/man5/proc.5.html
- https://man7.org/linux/man-pages/man5/proc_pid_mountinfo.5.html
- https://www.kernel.org/doc/Documentation/filesystems/sysfs-rules.txt
- https://www.kernel.org/doc/Documentation/filesystems/proc.txt
- https://www.kernel.org/doc/Documentation/filesystems/

---

## Appendix A: Glossary (Optional)

- Agent: Execution entity within PromptWareOS.
- AgentID: Stable identity for an agent.
- Incarnation: Ephemeral running instance of an agent.
- Belief Surface: Read-only system self-view.
- Control Plane: Mutation interface.
- Attribute File: Single semantic value with newline termination.

---

## Appendix B: Examples (Optional)

Example `/sys` attribute writes:

- Enable a skill: write `1\n` to `/sys/agents/{agent-id}/skills/{skill-id}/enable`.
- Request lifecycle change: write `paused\n` to `/sys/agents/{agent-id}/lifecycle/desired_state`.

Example `/proc` belief views:

- `/proc/system/summary` (human-readable narrative).
- `/proc/agents/{agent-id}/skills` (tabular list).

---

## Appendix: Errata & Notes (Append-Only)

None.

---

End of RFC 0013

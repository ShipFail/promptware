---
rfc: 0028
title: VFS Driver: Procfs
author: Huan Li, Claude, GitHub Copilot
status: Draft
type: Standards Track
created: 2026-01-01
updated: 2026-01-02
version: 1.0
tags: [vfs, driver, proc, introspection]
---

# RFC 0028: VFS Driver: Procfs

## 1. Abstract

This RFC defines the **Proc VFS Driver** for PromptWar̊e ØS. It implements the **VFSDriver Interface** (RFC 0026) to provide a **System Introspection Plane**.

Inspired by Linux `procfs`, this driver exposes dynamic views of system state (e.g., uptime, memory usage, kernel parameters). It is strictly **Read-Only**.

## 2. Status of This Memo

This document is a PromptWar̊e ØS RFC-style specification and may change at any time.

The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**, **SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **MAY**, and **OPTIONAL** are to be interpreted as described in BCP 14 (RFC 2119, RFC 8174).

## 3. Terminology

*   **View**: A read-only resource generated dynamically upon access.
*   **Generator**: A function that computes the content of a view.

## 4. Capabilities

The Proc Driver MUST declare the following capabilities:

*   **`READABLE`**: `true`
*   **`WRITABLE`**: `false` (Introspection only).
*   **`EXECUTABLE`**: `false`

## 5. Operations

### 5.1. Read Operation
*   **Behavior**: Invokes the registered **Generator** for the requested path and returns the computed string.
*   **Dynamic Nature**: The returned value MAY change between calls (e.g., `uptime`).

### 5.2. Write/Delete Operations
*   **Behavior**: Rejected by VFS Core due to missing `WRITABLE` capability.

## 6. Usage Examples

### 6.1. Standard Mount
*   **Mount Point**: `/proc`
*   **Usage**:
    *   `os:///proc/uptime` → Returns system uptime (e.g., "123s").
    *   `os:///proc/cmdline` → Returns kernel boot parameters.
    *   `os:///proc/version` → Returns OS version string.

## 7. References

### PromptWar̊e ØS References
*   [RFC 0026: VFS Driver Interface Specification](0026-vfs-driver-interface.md)

### External References
*   [RFC 2119: Key words for use in RFCs](https://www.rfc-editor.org/rfc/rfc2119)

---
End of RFC 0028

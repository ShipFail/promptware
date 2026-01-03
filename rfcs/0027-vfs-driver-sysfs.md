---
rfc: 0027
title: "VFS Driver: Sysfs"
author: Huan Li, Claude, GitHub Copilot
status: Draft
type: Standards Track
created: 2026-01-01
updated: 2026-01-02
version: 1.0
tags: [vfs, driver, sys, control]
---

# RFC 0027: VFS Driver: Sysfs

## 1. Abstract

This RFC defines the **Sys VFS Driver** for PromptWar̊e ØS. It implements the **VFSDriver Interface** (RFC 0026) to provide a **System Control Plane**.

Inspired by Linux `sysfs`, this driver exposes system configuration parameters as writable files. It enforces a **Single Value Rule** to ensure configuration remains simple, atomic, and unambiguous.

## 2. Status of This Memo

This document is a PromptWar̊e ØS RFC-style specification and may change at any time.

The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**, **SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **MAY**, and **OPTIONAL** are to be interpreted as described in BCP 14 (RFC 2119, RFC 8174).

## 3. Terminology

*   **Control Attribute**: A writable resource that alters system behavior (e.g., `debug_mode`).
*   **Single Value**: A string containing no newline characters.

## 4. Capabilities

The Sys Driver MUST declare the following capabilities:

*   **`READABLE`**: `true`
*   **`WRITABLE`**: `true`
*   **`EXECUTABLE`**: `false`

## 5. Operations

### 5.1. Read Operation
*   **Behavior**: Returns the current value of the control attribute.

### 5.2. Write Operation
*   **Behavior**: Updates the control attribute. This MAY trigger immediate system side effects (e.g., changing log levels).

## 6. Validation Logic (The Single Value Rule)

The Sys Driver MUST implement a `validate` hook to enforce the **Single Value Rule**.

### 6.1. The Rule
Configuration values MUST be atomic strings. They MUST NOT contain newline characters (`\n`).

### 6.2. Enforcement
*   **Operation**: `Write`
*   **Condition**: `value` contains `\n`
*   **Action**: Throw `UNPROCESSABLE_ENTITY`.
*   **Message**: "Sys attributes must be single values (no newlines)."

## 7. Usage Examples

### 7.1. Standard Mount
*   **Mount Point**: `/sys`
*   **Usage**:
    *   `os:///sys/config/log_level` → Write "DEBUG" to enable debug logging.
    *   `os:///sys/agents/shell/status` → Write "active" to set status.

## 8. References

### PromptWar̊e ØS References
*   [RFC 0026: VFS Driver Interface Specification](0026-vfs-driver-interface.md)

### External References
*   [RFC 2119: Key words for use in RFCs](https://www.rfc-editor.org/rfc/rfc2119)

---
End of RFC 0027

---
rfc: 0013
title: Kernel VFS Specification
author: Huan Li, ChatGPT, Claude, GitHub Copilot
status: Draft
type: Standards Track
created: 2025-12-20
updated: 2026-01-02
version: 1.0
tags: [vfs, kernel, mount, os, orchestration]
---

# RFC 0013: Kernel VFS Specification

## 1. Abstract

This RFC defines the **Virtual File System (VFS)** for PromptWar̊e ØS. The VFS is a unified orchestration layer that abstracts all system resources—code, memory, configuration, and introspection—into a single hierarchical namespace rooted at `os:///`.

The VFS implements a **"Everything is a Mount"** architecture. It maintains a **Mount Table** that maps path prefixes to specific **Drivers**. It is responsible for path resolution, request routing, and capability enforcement, but delegates actual I/O and validation to the drivers.

## 2. Status of This Memo

This document is a PromptWar̊e ØS RFC-style specification and may change at any time.

The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**, **SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **MAY**, and **OPTIONAL** are to be interpreted as described in BCP 14 (RFC 2119, RFC 8174).

## 3. Motivation

### 3.1. The Fragmentation Problem
In early designs, different subsystems (Memory, System, Code) were accessed via disparate APIs or URI schemes (`memory://`, `sys://`). This increased cognitive load for agents and made the system difficult to extend.

### 3.2. The Unified Solution
By adopting the Unix philosophy ("Everything is a file"), we reduce the surface area of the OS. An agent needs only one set of verbs (`Read`, `Write`, `List`) to interact with any part of the system.

### 3.3. The Mount Architecture
To support portability and modularity, the VFS must not hardcode knowledge of specific subsystems. Instead, it must allow drivers to be "mounted" at arbitrary paths, enabling flexible system composition (e.g., mounting a debug memory driver at `/debug/memory`).

## 4. Architecture

### 4.1. The VFS Core
The VFS Core is the central dispatcher. It possesses:
1.  **The Mount Table**: A registry of active mount points.
2.  **The Router**: Logic to match paths to drivers.
3.  **The Enforcer**: Logic to check driver capabilities.

### 4.2. The Mount Table
The Mount Table is a collection of **Mount Entries**. Each entry consists of:
*   **Prefix**: The path prefix where the driver is attached (e.g., `/sys`).
*   **Driver**: A reference to the driver instance (implementing RFC 0026).
*   **Config**: Driver-specific configuration (e.g., a root URL for an HTTP driver).

### 4.3. The Root Mount
The VFS MUST ensure that a **Root Mount** (`/`) always exists. This serves as the catch-all for any path that does not match a more specific mount point.

## 5. Path Resolution Algorithm

The VFS MUST resolve a full URI to a specific driver and relative path using the **Longest Prefix Match** algorithm.

### 5.1. Algorithm Steps

Given an input URI `os:///<path>`:

1.  **Sanitize**: Strip the scheme `os:///`. Normalize the remaining path string (remove `.` and `..`).
2.  **Search**: Iterate through the Mount Table.
3.  **Match**: Identify all Mount Entries where the `Prefix` matches the start of the `path`.
4.  **Select**: Choose the matching entry with the **longest** `Prefix`.
5.  **Rewrite**:
    *   `Driver` = Selected Entry's Driver.
    *   `RelativePath` = `path` minus `Prefix`.
6.  **Dispatch**: Pass `RelativePath` to the `Driver`.

### 5.2. Example

**Mount Table**:
1.  Prefix: `/` → Driver: `HTTP` (Root)
2.  Prefix: `/memory` → Driver: `KV`
3.  Prefix: `/skills/community` → Driver: `HTTP` (Community Repo)

**Resolution Scenarios**:
*   `os:///agents/shell.md` matches `/` → **HTTP Driver** receives `agents/shell.md`.
*   `os:///memory/vault/key` matches `/` and `/memory`. Longest is `/memory` → **KV Driver** receives `vault/key`.
*   `os:///skills/community/math.md` matches `/` and `/skills/community`. Longest is `/skills/community` → **HTTP Driver** receives `math.md`.

## 6. VFS Operations

The VFS exposes a unified API that delegates to the resolved driver.

### 6.1. Standard Operations
The VFS MUST implement the following methods:

*   `read(uri)`
*   `write(uri, value)`
*   `list(uri)`
*   `delete(uri)`
*   `ingest(uri)`

### 6.2. Execution Flow
For every operation, the VFS MUST perform the following steps in order:

1.  **Resolve**: Determine the target Driver and Relative Path (Section 5).
2.  **Check Capability**: Verify the Driver supports the requested operation (e.g., `WRITABLE` for `write`).
    *   If unsupported, throw `FORBIDDEN`.
3.  **Validate**: Invoke the Driver's `validate` hook.
    *   If validation fails, propagate the error.
4.  **Execute**: Invoke the Driver's operation method.
5.  **Return**: Return the result to the caller.

## 7. Boot Configuration (Mounting)

The VFS is initialized at boot time using the **Kernel Parameters** (RFC 0015).

### 7.1. Default Mounts
A standard PromptWar̊e ØS kernel SHOULD initialize the following mounts by default:

| Prefix | Driver Type | Purpose |
| :--- | :--- | :--- |
| `/` | HTTP / File | Code & Resources (Root) |
| `/memory` | Memory (KV) | Persistent State |
| `/sys` | Sys (Control) | System Configuration |
| `/proc` | Proc (View) | System Introspection |

### 7.2. Custom Mounts
The Kernel Parameters `mounts` object allows defining additional mount points. The VFS MUST register these during initialization.

## 8. Error Handling

The VFS Core handles routing errors, while Drivers handle I/O errors.

*   **`BAD_REQUEST` (400)**: Malformed URI scheme (must be `os:///`).
*   **`NOT_FOUND` (404)**: No matching mount point found (rare, as Root usually exists).
*   **`FORBIDDEN` (403)**: Operation not supported by the resolved driver's capabilities.

## 9. References

### PromptWar̊e ØS References
*   [RFC 0015: Kernel Dualmode Architecture](0015-kernel-dualmode-architecture.md)
*   [RFC 0026: VFS Driver Interface Specification](0026-vfs-driver-interface.md)

### External References
*   [RFC 2119: Key words for use in RFCs](https://www.rfc-editor.org/rfc/rfc2119)

---
End of RFC 0013

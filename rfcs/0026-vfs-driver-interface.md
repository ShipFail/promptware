---
rfc: 0026
title: VFS Driver Interface Specification
author: Huan Li, Claude, GitHub Copilot
status: Draft
type: Standards Track
created: 2026-01-01
updated: 2026-01-02
version: 1.0
tags: [vfs, driver, interface, contract]
---

# RFC 0026: VFS Driver Interface Specification

## 1. Abstract

This RFC defines the **VFSDriver Interface Contract** for PromptWar̊e ØS. It specifies the abstract behavioral requirements that any module MUST satisfy to function as a Virtual File System (VFS) driver.

The interface decouples the **VFS Core** (Orchestration) from **Storage Backends** (Implementation). It enforces a strict separation of concerns where the VFS Core handles routing and capability enforcement, while drivers handle storage I/O and domain-specific validation.

## 2. Status of This Memo

This document is a PromptWar̊e ØS RFC-style specification and may change at any time.

The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**, **SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **MAY**, and **OPTIONAL** are to be interpreted as described in BCP 14 (RFC 2119, RFC 8174).

## 3. Terminology

*   **Driver**: An implementation of this interface that manages a specific type of resource (e.g., Memory, HTTP, System).
*   **Mount Point**: The location in the VFS hierarchy where a driver is attached.
*   **Relative Path**: A path string stripped of the mount point prefix, passed to the driver.
*   **Capability**: A declared permission flag (Readable, Writable, Executable) defining what operations a driver supports.
*   **Validation Hook**: A mechanism for drivers to enforce domain-specific rules before an operation is committed.

## 4. Driver Capabilities

Drivers MUST declare their supported operations via a set of immutable capability flags. The VFS Core MUST use these flags to reject unsupported operations before they reach the driver.

### 4.1. The Capability Set

*   **`READABLE`**: The driver supports retrieving resource content.
*   **`WRITABLE`**: The driver supports creating or modifying resources.
*   **`EXECUTABLE`**: The driver supports ingesting resources into the execution context.

### 4.2. Capability Enforcement

*   If a driver does not declare `READABLE`, the VFS MUST reject `Read` and `List` operations with a `FORBIDDEN` error.
*   If a driver does not declare `WRITABLE`, the VFS MUST reject `Write` and `Delete` operations with a `FORBIDDEN` error.
*   If a driver does not declare `EXECUTABLE`, the VFS MUST reject `Ingest` operations with a `FORBIDDEN` error.

## 5. Interface Operations

Drivers MUST implement the following operations corresponding to their declared capabilities.

### 5.1. Read Operation

*   **Input**: A `path` string (relative to the mount point).
*   **Output**: The resource content as a string.
*   **Errors**:
    *   MUST return `NOT_FOUND` if the resource does not exist.
    *   MUST return `INTERNAL_ERROR` if the backend fails.

### 5.2. Write Operation

*   **Input**:
    *   `path`: A string (relative to the mount point).
    *   `value`: The string content to store.
*   **Output**: Acknowledgment of success.
*   **Behavior**: The operation MUST be atomic where possible.
*   **Errors**:
    *   MUST return `UNPROCESSABLE_ENTITY` if the value violates domain validation rules.

### 5.3. List Operation

*   **Input**: A `prefix` string (relative to the mount point).
*   **Output**: A list of child path strings relative to the input prefix.
*   **Behavior**: The list MUST include immediate children. It MAY include recursive descendants depending on driver semantics.

### 5.4. Delete Operation

*   **Input**: A `path` string (relative to the mount point).
*   **Output**: Acknowledgment of success.
*   **Errors**:
    *   MUST return `NOT_FOUND` if the resource does not exist.

### 5.5. Validate Operation (Hook)

*   **Purpose**: To enforce domain-specific constraints (e.g., "no newlines", "must be encrypted") before an operation proceeds.
*   **Input**:
    *   `operation`: The type of operation (`Read`, `Write`, `Delete`).
    *   `path`: The relative path.
    *   `value`: The content (for Write operations).
*   **Behavior**:
    *   The driver MUST inspect the input against its internal rules.
    *   If valid, the operation completes silently.
    *   If invalid, the driver MUST raise a specific error (e.g., `UNPROCESSABLE_ENTITY`).
*   **Timing**: The VFS Core MUST invoke this hook *after* capability checks and *before* the actual operation.

## 6. Path Handling

### 6.1. Relative Paths

Drivers MUST operate exclusively on **Relative Paths**.

*   **Definition**: The Relative Path is the full VFS path minus the Mount Point prefix.
*   **Example**:
    *   Mount Point: `/sys`
    *   Full Path: `os:///sys/config/mode`
    *   Relative Path passed to Driver: `config/mode`

### 6.2. Path Normalization

*   Drivers MUST assume the input path is normalized (no `.` or `..` segments).
*   Drivers MUST NOT assume the path starts with a slash `/`. The VFS Core is responsible for consistent separator handling.

## 7. Error Handling

Drivers MUST map backend-specific errors to the standard PromptWar̊e ØS Error Taxonomy (RFC 0024).

| Condition | Standard Error Code |
| :--- | :--- |
| Resource missing | `NOT_FOUND` (404) |
| Permission denied by backend | `FORBIDDEN` (403) |
| Validation failed | `UNPROCESSABLE_ENTITY` (422) |
| Backend timeout/failure | `INTERNAL_SERVER_ERROR` (500) |
| External fetch failure | `BAD_GATEWAY` (502) |

## 8. Security Considerations

*   **Input Sanitization**: Drivers MUST sanitize all inputs before passing them to the backend storage or execution engine.
*   **Error Leakage**: Drivers MUST NOT include sensitive data (e.g., keys, passwords) in error messages.
*   **Least Privilege**: Drivers SHOULD declare the minimum set of capabilities required for their function.

## 9. References

### PromptWar̊e ØS References
*   [RFC 0013: Kernel VFS Specification](0013-vfs-mount-resolution.md)
*   [RFC 0024: CQRS Event Schema](0024-cqrs-event-schema.md)

### External References
*   [RFC 2119: Key words for use in RFCs](https://www.rfc-editor.org/rfc/rfc2119)

---
End of RFC 0026

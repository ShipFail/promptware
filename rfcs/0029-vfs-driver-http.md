---
rfc: 0029
title: VFS Driver: HTTP
author: Huan Li, Claude, GitHub Copilot
status: Draft
type: Standards Track
created: 2026-01-01
updated: 2026-01-02
version: 1.0
tags: [vfs, driver, http, code, fetch]
---

# RFC 0029: VFS Driver: HTTP

## 1. Abstract

This RFC defines the **HTTP VFS Driver** (formerly Code Driver) for PromptWar̊e ØS. It implements the **VFSDriver Interface** (RFC 0026) to provide read-only access to remote resources via HTTPS or local resources via the `file://` protocol.

Unlike previous iterations, this driver **does not** manage mount tables or routing logic. It is a "dumb" fetcher that accepts a `Root URL` configuration and resolves all incoming relative paths against that root.

## 2. Status of This Memo

This document is a PromptWar̊e ØS RFC-style specification and may change at any time.

The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**, **SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **MAY**, and **OPTIONAL** are to be interpreted as described in BCP 14 (RFC 2119, RFC 8174).

## 3. Terminology

*   **Root URL**: The base URL (HTTPS or File) configured for a specific instance of this driver.
*   **Ingest**: The process of fetching a resource and loading it into the execution context.

## 4. Driver Configuration

The HTTP Driver MUST be initialized with a single configuration parameter:

*   **`root`**: A valid base URL string.
    *   MUST start with `https://` or `file://`.
    *   MUST end with a trailing slash `/`.

## 5. Capabilities

The HTTP Driver MUST declare the following capabilities:

*   **`READABLE`**: `true` (Supports `read` operations).
*   **`WRITABLE`**: `false` (Code is immutable).
*   **`EXECUTABLE`**: `true` (Supports `ingest` operations).

## 6. Operations

### 6.1. Path Resolution
For all operations, the driver MUST resolve the target URL by appending the input `Relative Path` to the configured `Root URL`.

*   **Example**:
    *   Configured Root: `https://github.com/org/repo/raw/main/`
    *   Input Path: `agents/shell.md`
    *   Resolved URL: `https://github.com/org/repo/raw/main/agents/shell.md`

### 6.2. Read Operation
*   **Behavior**: Fetches the content from the resolved URL.
*   **Errors**:
    *   `NOT_FOUND` (404): If the remote server returns 404.
    *   `BAD_GATEWAY` (502): If the fetch fails due to network issues.

### 6.3. Ingest Operation
*   **Behavior**:
    1.  Fetches the content (same as Read).
    2.  Parses the content (e.g., extracting metadata).
    3.  Loads the content into the Kernel's execution context.
*   **Note**: The specific logic of parsing and loading is defined in **RFC 0020**. This driver is responsible for the *fetch* and the *triggering* of that logic.

### 6.4. List Operation
*   **Behavior**:
    *   If the backend supports directory listing (e.g., `file://`), it returns the list of children.
    *   If the backend does not support listing (e.g., raw GitHub URLs), it SHOULD return `UNIMPLEMENTED` or an empty list, depending on implementation choice.

## 7. Usage Examples

### 7.1. The Root Mount
In a standard boot configuration, an instance of the HTTP Driver is mounted at `/`.

*   **Mount Point**: `/`
*   **Config**: `root = "https://raw.githubusercontent.com/ShipFail/promptware/main/os/"`
*   **Effect**: `os:///agents/shell.md` resolves to the main OS repository.

### 7.2. A Community Mount
To support a community skill library, a second instance is mounted.

*   **Mount Point**: `/skills/community`
*   **Config**: `root = "https://raw.githubusercontent.com/Community/skills/main/"`
*   **Effect**: `os:///skills/community/math.md` resolves to the community repository.

## 8. Security Considerations

*   **Protocol Restriction**: The driver MUST reject `root` URLs that use insecure protocols (e.g., `http://`), unless explicitly configured for a local development mode.
*   **Path Traversal**: The driver MUST ensure that the resolved URL does not escape the `root` scope (e.g., via `..` segments), although the VFS Core path normalization should prevent this.

## 9. References

### PromptWar̊e ØS References
*   [RFC 0013: VFS Core Architecture](0013-vfs-core-architecture.md)
*   [RFC 0026: VFS Driver Interface Specification](0026-vfs-driver-interface.md)
*   [RFC 0020: Dependency Metadata Hydration](0020-dependency-metadata-hydration.md)

### External References
*   [RFC 2119: Key words for use in RFCs](https://www.rfc-editor.org/rfc/rfc2119)

---
End of RFC 0029

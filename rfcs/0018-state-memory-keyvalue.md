---
rfc: 0018
title: Memory VFS Driver Specification
author: Huan Li, ChatGPT, Claude, GitHub Copilot
status: Draft
type: Standards Track
created: 2025-12-23
updated: 2026-01-02
version: 1.0
tags: [vfs, driver, memory, keyvalue, vault]
---

# RFC 0018: Memory VFS Driver Specification

## 1. Abstract

This RFC defines the **Memory VFS Driver** for PromptWar̊e ØS. It implements the **VFSDriver Interface** (RFC 0026) to provide persistent Key-Value (KV) storage.

The driver supports mounting at arbitrary paths (conventionally `/memory`) and enforces security constraints on specific sub-namespaces, such as the **Vault** (`vault/`), which requires encrypted values.

## 2. Status of This Memo

This document is a PromptWar̊e ØS RFC-style specification and may change at any time.

The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**, **SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **MAY**, and **OPTIONAL** are to be interpreted as described in BCP 14 (RFC 2119, RFC 8174).

## 3. Terminology

*   **Namespace**: A logical partition of the KV store.
*   **Vault**: A reserved namespace segment (`vault/`) intended for secrets.
*   **Ciphertext**: Data encrypted according to RFC 0016 (`pwenc:v1:...`).

## 4. Driver Configuration

The Memory Driver MAY accept configuration to define its storage scope:

*   **`namespace`** (Optional): A prefix string used to isolate this driver instance's data within the physical backend.
    *   Example: If `namespace="user1"`, a write to `config` is stored physically as `user1/config`.

## 5. Capabilities

The Memory Driver MUST declare the following capabilities:

*   **`READABLE`**: `true`
*   **`WRITABLE`**: `true`
*   **`EXECUTABLE`**: `false` (Memory is for state, not code).

## 6. Operations

### 6.1. Read Operation
*   **Behavior**: Retrieves the value associated with the path.
*   **Errors**: `NOT_FOUND` if the key does not exist.

### 6.2. Write Operation
*   **Behavior**: Stores the value at the specified path.
*   **Persistence**: Writes MUST be durable.

### 6.3. List Operation
*   **Behavior**: Returns the keys that are immediate children of the prefix.

### 6.4. Delete Operation
*   **Behavior**: Removes the key and its value.

## 7. Validation Logic (The Vault Rule)

The Memory Driver MUST implement a `validate` hook to enforce the **Vault Rule**.

### 7.1. The Rule
If the relative path starts with `vault/` (e.g., `vault/api_key`), the value MUST start with the `pwenc:v1:` prefix.

### 7.2. Enforcement
*   **Operation**: `Write`
*   **Condition**: `path` starts with `vault/` AND `value` does not start with `pwenc:v1:`
*   **Action**: Throw `UNPROCESSABLE_ENTITY`.
*   **Message**: "Vault values must be encrypted (pwenc:v1:...)."

## 8. Usage Examples

### 8.1. Standard Mount
*   **Mount Point**: `/memory`
*   **Usage**:
    *   `os:///memory/config/theme` → Stores theme preference.
    *   `os:///memory/vault/openai_key` → Stores encrypted API key.

### 8.2. Isolated Mount
*   **Mount Point**: `/private`
*   **Config**: `namespace="secure_zone"`
*   **Usage**:
    *   `os:///private/notes` → Physically stored as `secure_zone/notes`.

## 9. References

### PromptWar̊e ØS References
*   [RFC 0026: VFS Driver Interface Specification](0026-vfs-driver-interface.md)
*   [RFC 0016: Crypto Primitives Specification](0016-security-crypto-primitives.md)

### External References
*   [RFC 2119: Key words for use in RFCs](https://www.rfc-editor.org/rfc/rfc2119)

---
End of RFC 0018

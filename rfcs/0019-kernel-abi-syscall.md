---
rfc: 0019
title: Kernel ABI & Syscall Interface
author: Ship.Fail
status: Draft
type: Standards Track
category: Kernel
created: 2025-12-24
---

# RFC 0019: Kernel ABI & Syscall Interface

## 1. Summary
This RFC defines the Application Binary Interface (ABI) between the Promptware Kernel (Intent) and the Software Kernel (Precision). It specifies the **Syscall Contract**, the **Dispatch Table**, and the **Singular Boundary** (`pwosSyscall`).

> **Scope Note**: This document defines the *Application Binary Interface (ABI)* and *Syscall Contract*. It implements the ontology defined in **RFC 0015**. While RFC 0015 defines *why* the kernel exists, this document defines *how* agents must interact with it. This contract is the "Constitution of Execution" and is intended to be forward-compatible across different runtime implementations.

## 2. The Singular Boundary

The Promptware Kernel interacts with the Software Kernel exclusively through a single "Hypercall":

```typescript
function pwosSyscall(syscall: string, ...args: any[]): Promise<any>;
```

This function represents the **Hard Boundary** between Intent and Precision.
*   **Input**: A syscall identifier and arguments.
*   **Output**: A Promise resolving to the result or rejecting with a Kernel Panic.
*   **Constraint**: No other entry point is permitted. Direct import of syscall modules by Agents is prohibited.

## 3. The Syscall Dispatch Table

The Software Kernel maintains an internal **Syscall Dispatch Table**. This table maps abstract syscall identifiers to concrete implementations.

### 3.1. Conceptual Table
```typescript
const SYSCALL_TABLE = {
  // Kernel Space (Short Names)
  "ingest":  () => import("./syscalls/ingest.ts"),
  "resolve": () => import("./syscalls/resolve.ts"),
  "memory":  () => import("./syscalls/memory.ts"),
  
  // User Space (Full Paths)
  "os/skills/search": () => import("..."),
  "./local/tool.ts":  () => import("..."),
};
```

### 3.2. Implementation Detail (`syscall.ts`)
In the reference implementation, this table is backed by the filesystem structure in `os/kernel/syscalls/`. The `syscall.ts` entry point acts as the dynamic dispatcher.

## 4. Syscall Naming Rules

To prevent collisions between Kernel Core and User Space extensions, the following naming rules MUST be enforced:

1.  **Kernel Privilege (Short Names)**:
    *   Syscalls that contain **NO slashes** (e.g., `ingest`, `memory`) are reserved for the Kernel Core.
    *   These map directly to `os/kernel/syscalls/<name>.ts`.

2.  **User Space Constraint (Path Names)**:
    *   All other syscalls MUST be addressed by their **Path** (URI or Relative).
    *   Examples: `os/skills/search`, `./tools/calc.ts`.
    *   This ensures that user-space extensions never collide with future kernel primitives.

## 5. The ABI Contract

All syscall implementations MUST adhere to the following signature:

```typescript
export default async function(...args: any[]): Promise<any> {
  // Implementation
}
```

*   **Service Locator Pattern**: Syscalls **MUST NOT** rely on caller-injected configuration for core OS parameters (like Root). They **MUST** self-configure by reading the **Kernel Parameter Block** stored in `proc/cmdline`.
*   **`args`**: The arguments passed from `pwosSyscall`.

## 6. Execution Modes (Dual-Mode)

All System Tools **MUST** implement two execution modes to facilitate both production use and testing/recovery.

### 6.1. Kernel Mode (Production)
*   **Invocation**: Via `syscall.ts` (The Monolithic Dispatcher).
*   **Configuration**: Self-configured via `proc/cmdline` (Service Locator).
*   **CLI Args**: Minimal (business logic only).

### 6.2. CLI Mode (Fallback)
*   **Invocation**: Direct execution (e.g., `deno run ingest.ts`).
*   **Configuration**: Explicitly provided via CLI flags (e.g., `--root`).
*   **Requirement**: If Kernel Memory is inaccessible, tools **MUST** accept configuration via CLI arguments.

## 7. The Ingest Pipeline

The `ingest` syscall implements the "Lifecycle of Authority" defined in RFC 0015. It MUST execute the following phases in order:

1.  **Fetch**: Retrieve the raw bits from the URI (I/O).
2.  **Validate**: Verify integrity and authenticity (Crypto).
3.  **Load**: Materialize the content into the Execution Context (Memory).
4.  **Adopt**: Perform the identity switch (State).

## 8. The Wire Protocol (JSON-RPC 2.0)

To ensure deterministic communication between the Prompt Kernel (Intent) and the Software Kernel (Precision), all System Calls MUST communicate via **Standard JSON-RPC 2.0** over stdout.

### 1. Request (Implicit)
Currently, requests are made via CLI arguments. This is considered an "Implicit JSON-RPC Request" where:
*   `method`: The first argument (e.g., `fetch`).
*   `params`: The subsequent arguments.
*   `id`: Always `1` (Synchronous CLI).

### 2. Response (Explicit)
The Software Kernel MUST emit a single JSON object to `stdout` adhering to the JSON-RPC 2.0 Response specification.

**Success:**
```json
{
  "jsonrpc": "2.0",
  "result": <Any JSON Value>,
  "id": 1
}
```

**Error:**
```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": <Integer>,
    "message": "<String>",
    "data": <Optional>
  },
  "id": 1
}
```

### 3. Error Codes
We adopt standard JSON-RPC error codes where applicable, and define OS-specific codes for Kernel Panics.
*   `-32700`: Parse Error (Invalid JSON input).
*   `-32601`: Method Not Found (Syscall not registered).
*   `-32000`: Server Error (Generic Kernel Panic).

## 9. CLI vs. API

It is critical to distinguish between the **Syscall** (the semantic event) and the **CLI** (the invocation mechanism).

*   **The Syscall**: `pwosSyscall("ingest", uri)`
    *   This is the API used by the Promptware Kernel.
*   **The CLI**: `deno run -A --location <origin> syscall.ts ingest <uri>`
    *   This is a **Debug & Transport Surface**. It allows external tools or human operators to invoke syscalls, but it is *not* the syscall itself.

## 10. Forward Compatibility

To ensure long-term stability:
1.  **Opaque Dispatch**: Agents MUST NOT rely on the physical location of syscall files. They MUST only use the string identifier.
2.  **Namespace Protection**: Agents MUST use full paths (e.g., `os/skills/search`) for non-kernel resources. Short names are exclusively reserved for the Kernel.

## 11. Security Considerations

*   **The Singular Entry Law**: The dispatcher (`syscall.ts`) is the only code authorized to import syscall modules.
*   **Root Injection**: Syscalls MUST NOT calculate the OS Root themselves. They MUST rely on the `root` argument provided by the trusted dispatcher.

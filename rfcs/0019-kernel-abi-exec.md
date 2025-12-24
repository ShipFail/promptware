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
This RFC defines the Application Binary Interface (ABI) between the Promptware Kernel (Intent) and the Software Kernel (Physics). It specifies the **Syscall Contract**, the **Dispatch Table**, and the **Singular Boundary** (`pwosExec`).

> **Scope Note**: This document defines the *Application Binary Interface (ABI)* and *Syscall Contract*. It implements the ontology defined in **RFC 0015**. While RFC 0015 defines *why* the kernel exists, this document defines *how* agents must interact with it. This contract is the "Constitution of Execution" and is intended to be forward-compatible across different runtime implementations.

## 2. The Singular Boundary

The Promptware Kernel interacts with the Software Kernel exclusively through a single "Hypercall":

```typescript
function pwosExec(syscall: string, ...args: any[]): Promise<any>;
```

This function represents the **Hard Boundary** between Intent and Physics.
*   **Input**: A syscall identifier and arguments.
*   **Output**: A Promise resolving to the result or rejecting with a Kernel Panic.
*   **Constraint**: No other entry point is permitted. Direct import of syscall modules by Agents is prohibited.

## 3. The Syscall Dispatch Table

The Software Kernel maintains an internal **Syscall Dispatch Table**. This table maps abstract syscall identifiers to concrete implementations.

### 3.1. Conceptual Table
```typescript
const SYSCALL_TABLE = {
  "kernel.ingest":  () => import("./syscalls/ingest.ts"),
  "kernel.resolve": () => import("./syscalls/resolve.ts"),
  "kernel.memory":  () => import("./syscalls/memory.ts"),
};
```

### 3.2. Implementation Detail (`exec.ts`)
In the reference implementation, this table is backed by the filesystem structure in `os/kernel/syscalls/`. The `exec.ts` entry point acts as the dynamic dispatcher.

## 4. The ABI Contract

All syscall implementations MUST adhere to the following signature:

```typescript
export default async function(root: string, ...args: any[]): Promise<any> {
  // Implementation
}
```

*   **`root`**: The absolute URI of the OS Root. Injected by the dispatcher to ensure the syscall operates within the correct context.
*   **`args`**: The arguments passed from `pwosExec`.

## 5. The Ingest Pipeline

The `kernel.ingest` syscall implements the "Lifecycle of Authority" defined in RFC 0015. It MUST execute the following phases in order:

1.  **Fetch**: Retrieve the raw bits from the URI (I/O).
2.  **Validate**: Verify integrity and authenticity (Crypto).
3.  **Load**: Materialize the content into the Execution Context (Memory).
4.  **Adopt**: Perform the identity switch (State).

## 6. CLI vs. API

It is critical to distinguish between the **Syscall** (the semantic event) and the **CLI** (the invocation mechanism).

*   **The Syscall**: `pwosExec("kernel.ingest", uri)`
    *   This is the API used by the Promptware Kernel.
*   **The CLI**: `deno run exec.ts ingest <uri>`
    *   This is a **Debug & Transport Surface**. It allows external tools or human operators to invoke syscalls, but it is *not* the syscall itself.

## 7. Forward Compatibility

To ensure long-term stability:
1.  **Opaque Dispatch**: Agents MUST NOT rely on the physical location of syscall files. They MUST only use the string identifier (e.g., `kernel.ingest`).
2.  **Argument Versioning**: If a syscall's signature changes, a new identifier SHOULD be introduced (e.g., `kernel.ingest.v2`).

## 8. Security Considerations

*   **The Singular Entry Law**: The dispatcher (`exec.ts`) is the only code authorized to import syscall modules.
*   **Root Injection**: Syscalls MUST NOT calculate the OS Root themselves. They MUST rely on the `root` argument provided by the trusted dispatcher.

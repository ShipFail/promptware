---
rfc: 0019
title: Kernel ABI & Syscall Interface
author: Ship.Fail
status: Draft
type: Standards Track
created: 2025-12-24
updated: 2025-12-29
version: 1.0.0
tags: [kernel, abi, syscall]
---

# RFC 0019: Kernel ABI & Syscall Interface

## 1. Summary

This RFC defines the Application Binary Interface (ABI) for the PromptWare OS Kernel syscalls. It specifies the **observable behavior contract** that all syscall implementations MUST satisfy, focusing on naming conventions, deterministic semantics, and forward compatibility guarantees.

> **Scope Note**: This document defines the *syscall interface contract* - the observable, testable behavior that any implementation MUST provide. It does NOT specify implementation mechanisms (wire protocols, dispatch mechanisms, or execution modes), which are covered in **RFC 0023 (Syscall Bridge)**. This contract is the "Constitution of Execution" and is intended to be forward-compatible across different runtime implementations.

> **Relationship to Other RFCs**:
> - **RFC 0015 (Kernel Dualmode Architecture)**: Defines the ontology and origin parameter semantics
> - **RFC 0023 (Syscall Bridge)**: Specifies implementation mechanisms (NDJSON protocol, execution modes, dispatch)
> - **RFC 0018 (Kernel Memory Subsystem)**: Example syscall consumer using this ABI

## 2. Conformance Language

The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**, **SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **MAY**, and **OPTIONAL** in this document are to be interpreted as described in **BCP 14** [RFC 2119].

## 3. Syscall Naming Convention

### 3.1. Purpose

The syscall naming convention establishes a **namespace reservation policy** to prevent collisions between kernel-reserved syscalls and user-space extensions, ensuring forward compatibility as the kernel evolves.

### 3.2. Namespace Reservation Rules

Syscall names MUST follow these namespace rules:

1. **Kernel Reserved Namespace**:
   - **One-segment names** (e.g., `Echo`) are RESERVED for kernel use
   - **Two-segment dot notation** (e.g., `Memory.Get`, `Http.Fetch`, `Crypto.Seal`) are RESERVED for kernel use
   - **Reserved prefixes**: `Syscall.*`, `Sys.*`, `Kernel.*` are RESERVED for framework and introspection syscalls

2. **User-Space Namespace**:
   - User-space syscalls MUST use **three or more segments** (e.g., `Skills.Search.Web`)
   - User-space syscalls MAY use **path-based naming** (e.g., `os/skills/search`, `./local/tool.ts`)
   - User-space syscalls MUST NOT use reserved prefixes

### 3.3. Naming Format Requirements

Syscall names MUST:

1. **Character Set**: Use only alphanumeric characters (`a-z`, `A-Z`, `0-9`), dots (`.`), hyphens (`-`), forward slashes (`/`), and underscores (`_`)
2. **Start Character**: Begin with an alphanumeric character
3. **Length Limit**: NOT exceed 256 characters in total length
4. **Case Sensitivity**: Be treated as case-sensitive (e.g., `Memory.Get` ≠ `memory.get`)

### 3.4. Semantic Grouping (Recommended)

Kernel syscalls SHOULD follow the `Domain.Operation` pattern for clarity:

- **Domain**: The resource or capability (e.g., `Memory`, `Http`, `Crypto`)
- **Operation**: The action being performed (e.g., `Get`, `Set`, `Fetch`, `Seal`)

**Examples**:
- `Memory.Get` - Retrieve value from memory
- `Memory.Set` - Store value in memory
- `Http.Fetch` - Fetch HTTP resource
- `Crypto.Seal` - Encrypt and authenticate data

### 3.5. Reserved Syscall Names

The following syscall name prefixes are RESERVED for specific purposes:

| Prefix | Purpose | Examples |
|--------|---------|----------|
| `Syscall.*` | Bridge lifecycle and connection management | `Syscall.Authenticate`, `Syscall.Shutdown` |
| `Sys.*` | System introspection and metadata | `Sys.Describe` |
| `Kernel.*` | Core kernel operations | (Reserved for future use) |

User-space implementations MUST NOT define syscalls using these prefixes.

### 3.6. Collision Prevention Examples

**Valid Kernel Names** (Reserved):
- `Echo`
- `Memory.Get`
- `Http.Fetch`
- `Syscall.Authenticate`
- `Sys.Describe`

**Valid User-Space Names**:
- `Skills.Search.Web`
- `Tools.Calculator.Compute`
- `os/skills/search`
- `./local/custom-tool.ts`

**Invalid User-Space Names** (Collision with kernel reserved):
- ❌ `Memory` (one segment - kernel reserved)
- ❌ `Sys.CustomTool` (uses reserved prefix)
- ❌ `Syscall.MyCommand` (uses reserved prefix)

## 4. The Event Protocol

### 4.1. Universal Interface

All kernel interactions MUST occur via the **OsEvent** protocol defined in **RFC 0024**. There are no function calls, only events.

- **Input**: An `OsEvent` object with `type: "command"` or `type: "query"`.
- **Output**: An `OsEvent` object with `type: "response"` or `type: "error"`.
- **Notification**: An `OsEvent` object with `type: "event"` (for async updates).

### 4.2. Event Types

Implementations MUST support the 5 behavioral types defined in RFC 0024:

1.  **Command** (`type: "command"`): Request to mutate state (e.g., `Memory.Set`).
2.  **Query** (`type: "query"`): Request to retrieve state (e.g., `Memory.Get`).
3.  **Event** (`type: "event"`): Notification of past occurrence (e.g., `Job.Completed`).
4.  **Response** (`type: "response"`): Successful outcome of a command/query.
5.  **Error** (`type: "error"`): Failed outcome of a command/query.

### 4.3. Determinism & Purity

Events are categorized by their side effects:

1.  **Pure Queries**: MUST NOT mutate state. MUST be deterministic (same input + same state → same output).
    -   Example: `Kernel.Resolve`
2.  **Impure Commands**: MAY mutate state. MAY depend on external factors.
    -   Example: `Kernel.Ingest`

### 4.4. Error Handling

All failures MUST be emitted as `type: "error"` events.
-   **Payload**: MUST conform to the HTTP-centric error schema defined in RFC 0024 (`code`, `message`, `cause`).
-   **Causation**: MUST include `metadata.causation` linking to the triggering event.

### 4.5. Large Data & Blob Pointers

To maintain token efficiency and NDJSON compatibility, events MUST NOT embed large binary data or long text strings directly in the `payload`.

Instead, implementations MUST use the **BlobPointer** pattern defined in **RFC 0025**.

*   **Threshold**: Payloads larger than **4KB** SHOULD use a BlobPointer.
*   **Structure**: A BlobPointer is a JSON object pointing to the resource (`file://`, `https://`, or `data:`).
*   **Usage**: Fields that typically contain large data (e.g., `body`, `content`, `image`) SHOULD accept either raw data (if small) or a BlobPointer object.

**Example (BlobPointer in Event)**:
```json
{
  "type": "response",
  "name": "Http.Fetch",
  "payload": {
    "status": 200,
    "body": {
      "scheme": "file",
      "path": "/tmp/large-response.json"
    }
  }
}
```

## 5. Core Kernel Events

The following events are fundamental to the OS lifecycle and MUST be implemented by every compliant kernel.

### 5.1. Kernel.Ingest (The Loader)

The `Kernel.Ingest` command implements the "Lifecycle of Authority" defined in **RFC 0015**. It transforms a passive resource (URI) into an active capability (Context).

#### 5.1.1. Event Interface
*   **Topic**: `Kernel.Ingest`
*   **Type**: `command`
*   **Data Schema**:
    ```json
    {
      "uri": "string (Absolute URI to ingest)"
    }
    ```
*   **Success Event**: `type: "response"`
    ```json
    {
      "success": true,
      "context_id": "string (Unique ID of loaded context)"
    }
    ```
*   **Error Event**: `type: "error"` (e.g., 404 Not Found, 403 Forbidden)

#### 5.1.2. Execution Pipeline
This command MUST trigger the following observable phases:
1.  **Fetch**: Retrieve raw content.
2.  **Validate**: Verify integrity.
3.  **Load**: Parse and materialize.
4.  **Adopt**: Register in kernel namespace.

### 5.2. Kernel.Resolve (The Linker)

The `Kernel.Resolve` query resolves a relative path against the current execution context.

#### 5.2.1. Event Interface
*   **Topic**: `Kernel.Resolve`
*   **Type**: `query`
*   **Data Schema**:
    ```json
    {
      "uri": "string (Relative or Absolute URI)",
      "base": "string (Optional base URI, defaults to current context)"
    }
    ```
*   **Success Event**: `type: "response"`
    ```json
    {
      "uri": "string (Resolved Absolute URI)"
    }
    ```

### 5.3. Syscall.List (Introspection)

The `Syscall.List` query allows agents to discover available capabilities.

#### 5.3.1. Event Interface
*   **Topic**: `Syscall.List`
*   **Type**: `query`
*   **Data Schema**: `{}` (Empty object)
*   **Success Event**: `type: "response"`
    ```json
    {
      "syscalls": ["string (List of registered event topics)"]
    }
    ```

## 6. Forward Compatibility Guarantees

To ensure long-term stability across kernel versions and implementations, the following guarantees MUST be maintained:

### 6.1. Namespace Stability

1. **Kernel Reserved Names**: Once a syscall name is registered in the kernel reserved namespace (one or two segments), it MUST NOT be removed or reassigned to different functionality in future versions
2. **Semantic Versioning**: Breaking changes to syscall behavior SHOULD be introduced as new syscall names (e.g., `Memory.Get.V2`)
3. **Deprecation Policy**: Deprecated syscalls MUST continue to function for at least two major versions before removal

### 6.2. Opaque Implementation

Callers MUST NOT:
- Rely on the physical location or file structure of syscall implementations
- Make assumptions about implementation language, runtime, or execution environment
- Depend on implementation-specific side effects not specified in this ABI

Callers MUST only:
- Use syscall names as specified in Section 3 (Naming Convention)
- Rely on observable behavior specified in Section 4 (Behavior Contract)

### 6.3. User-Space Protection

User-space syscalls (three or more segments, or path-based):
- MAY be versioned independently of the kernel
- MUST NOT collide with kernel reserved namespace
- SHOULD use semantic versioning in naming where applicable (e.g., `Skills.Search.V1`)

## 7. Security Considerations

### 7.1. Origin Isolation

Syscalls accessing mutable state MUST enforce origin-based isolation (see Section 4.4). This prevents:
- Cross-tenant data leakage
- Unauthorized access to storage namespaces
- Privilege escalation through origin manipulation

### 7.2. Namespace Authority

The kernel reserved namespace (Section 3.2) serves as a trust boundary:
- Only kernel-provided syscalls MAY use reserved names
- User-space syscalls MUST use non-reserved names
- Implementations MUST validate syscall names against the reservation policy

### 7.3. Input Validation

All syscall implementations MUST:
- Validate input against defined schema before execution
- Reject malformed or malicious input
- Prevent injection attacks (command injection, path traversal, etc.)

### 7.4. Error Information Disclosure

Error messages SHOULD:
- Provide sufficient information for debugging
- NOT disclose sensitive internal implementation details
- NOT reveal information useful for security exploitation

## 8. References

### 8.1. Normative References

- **[RFC 2119]** - Key words for use in RFCs to Indicate Requirement Levels
  - https://www.rfc-editor.org/rfc/rfc2119

- **[RFC 0015]** - Kernel Dualmode Architecture
  - Defines kernel ontology and origin parameter semantics

- **[RFC 0016]** - Security & Cryptographic Primitives
  - Defines cryptographic validation mechanisms

- **[RFC 0023]** - Dual-Mode Syscall Bridge
  - Specifies implementation mechanisms (NDJSON protocol, execution modes, dispatch)

### 8.2. Informative References

- **[RFC 0014]** - Bootloader Core Protocol
  - Defines boot-time origin configuration

- **[RFC 0018]** - Kernel Memory Subsystem
  - Example syscall implementation using this ABI

- **[RFC 0024]** - Kernel Events Architecture
  - Defines OsEvent schema for event-driven syscall communication

## 9. Appendix: Change Log

### Version 1.0.0 (2025-12-29)

**Major Revision** - Scope Reduction to Pure ABI Specification:

- **Removed** (Moved to RFC-23):
  - Section 2: Singular Boundary (`pwosSyscall()` function)
  - Section 3: Dispatch Table implementation details
  - Section 6: Origin parameter passing mechanism
  - Section 7: Execution modes (dual-mode architecture)
  - Section 9: Wire protocol (JSON-RPC 2.0)
  - Section 10: CLI vs API distinction

- **Enhanced**:
  - Section 3: Syscall Naming Convention (now normative with MUST/SHOULD/MAY)
  - Section 4: Observable Behavior Contract (rewritten without code)
  - Section 5: Content Ingest Pipeline (observable phases)
  - Section 6: Forward Compatibility Guarantees (strengthened)
  - Section 7: Security Considerations (expanded)

- **Alignment**:
  - Passes RFC Quality Gate (Spec not code, normative language, testable)
  - Clear separation: RFC-19 (ABI contract) vs RFC-23 (implementation)
  - Origin parameter semantics deferred to RFC-15

### Version 0.9.0 (2025-12-24)

- Initial draft with implementation details

---

**End of RFC 0019**

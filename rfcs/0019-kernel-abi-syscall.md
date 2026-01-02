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
> - **RFC 0018 (System Memory Subsystem)**: Example syscall consumer using this ABI

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

## 4. Syscall Observable Behavior Contract

### 4.1. Input/Output Semantics

All syscalls MUST satisfy the following observable behavior contract:

1. **Structured Input**: Syscalls MUST accept well-defined input data conforming to a syscall-specific schema
2. **Structured Output**: Syscalls MUST produce either:
   - **Success Response**: Structured output data conforming to the syscall's output schema, OR
   - **Error Response**: An error event with descriptive message indicating failure reason
3. **No Side Channels**: Syscalls MUST NOT communicate results through mechanisms other than their defined output (e.g., no required side effects in external systems for core operation)

### 4.2. Determinism Requirements

Syscalls MUST be categorized as either **pure** (deterministic) or **impure** (non-deterministic):

1. **Pure Syscalls** (Deterministic):
   - Same input MUST always produce same output
   - No external state dependencies
   - Examples: `Crypto.Seal`, `Uri.Resolve` (when given absolute URIs)

2. **Impure Syscalls** (Non-Deterministic):
   - Output MAY vary based on external state (time, network, storage)
   - Examples: `Http.Fetch`, `Memory.Get`, `Content.Ingest`

Syscall documentation SHOULD clearly indicate whether a syscall is pure or impure.

### 4.3. Error Handling Requirements

Syscalls MUST handle errors according to these rules:

1. **Error Signaling**: Syscalls MUST return error events for:
   - Invalid input (schema validation failure)
   - Execution failure (e.g., network timeout, permission denied)
   - Resource unavailability (e.g., missing storage key)

2. **Error Format**: Error events MUST include:
   - **Type**: Event type set to `"error"`
   - **Message**: Human-readable description of the failure
   - **Context**: Sufficient information to diagnose the issue (MAY include error codes)

3. **No Silent Failures**: Syscalls MUST NOT suppress errors or return success when operation failed

### 4.4. State Isolation Requirements

Syscalls that access mutable state (storage, memory, files) MUST:

1. **Respect Origin**: Use the origin parameter (defined in **RFC 0015**) to determine storage namespace
2. **Prevent Leakage**: MUST NOT allow cross-origin data access
3. **Consistency**: Maintain state consistency within an origin namespace
4. **Immutability**: User-space code MUST NOT be able to override the origin parameter

> **Note**: The mechanism for passing the origin parameter is implementation-defined. See **RFC 0015** for normative origin semantics.

### 4.5. Idempotency Guidance

Syscalls SHOULD be idempotent where semantically appropriate:

- **Idempotent** (RECOMMENDED): Multiple identical requests produce the same result
  - Examples: `Memory.Set`, `Memory.Get`, `Crypto.Seal`

- **Non-Idempotent** (Where necessary): Repeated requests may have different effects
  - Examples: `Memory.Delete` (second call may return "not found")

### 4.6. Testability Requirements

All syscall behavior specified in this contract MUST be:

1. **Black-Box Testable**: Verifiable through input/output observation only
2. **Independently Implementable**: Any conforming implementation should satisfy the contract
3. **Unambiguous**: Behavior clearly defined for all valid inputs


## 5. Content Ingest Pipeline Specification

The `Content.Ingest` syscall (formerly `ingest`) implements the "Lifecycle of Authority" defined in **RFC 0015**. This syscall MUST execute the following observable phases in order:

### 5.1. Phase Sequence

1. **Fetch Phase**:
   - **Input**: URI of content to ingest
   - **Observable Behavior**: Retrieve raw content from the specified URI
   - **Output**: Raw bytes or error if fetch fails

2. **Validate Phase**:
   - **Input**: Raw content bytes and optional integrity metadata
   - **Observable Behavior**: Verify content integrity and authenticity
   - **Output**: Validated content or error if validation fails

3. **Load Phase**:
   - **Input**: Validated content
   - **Observable Behavior**: Parse and materialize content into executable form
   - **Output**: Loaded content representation or error if loading fails

4. **Adopt Phase**:
   - **Input**: Loaded content
   - **Observable Behavior**: Perform identity switch and register content in kernel namespace
   - **Output**: Success confirmation with content identifier or error if adoption fails

### 5.2. Phase Ordering Requirement

The phases MUST execute in the specified order (Fetch → Validate → Load → Adopt). A failure in any phase MUST:

1. Abort the ingest pipeline
2. Return an error indicating which phase failed
3. NOT execute subsequent phases

### 5.3. Atomicity

The ingest operation SHOULD be atomic where possible:
- Either all phases succeed and content is fully ingested, OR
- Any phase fails and no persistent state changes occur

> **Note**: The specific cryptographic validation mechanisms, content formats, and identity management are defined in **RFC 0015** and **RFC 0016**.

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

- **[RFC 0018]** - System Memory Subsystem
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

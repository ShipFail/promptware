---
rfc: 0031
title: System Capability Modules
author: Huan Li, GitHub Copilot
status: Draft
type: Standards Track
created: 2026-01-05
updated: 2026-01-05
version: 1.0
tags: [kernel, capability, module, architecture]
---

# RFC 0031: System Capability Modules

## 1. Summary

This RFC defines the **System Capability** as the atomic unit of extensibility in PromptWar̊e ØS. A System Capability is a **static, stateless, introspectable object** that bundles:
1.  **Intent**: Zod schemas defining the Inbound (Command/Query) and Outbound (Reply/Event) messages.
2.  **Execution**: A Factory function that produces a reactive `TransformStream` processor.

This design enforces a strict separation between **Definition** (the Capability Object) and **Runtime** (the Processor Stream), enabling the Kernel to introspect, route, and manage capabilities without executing them.

---

## 2. Motivation

### The Problem
In traditional systems, "handlers" are often opaque functions or classes. This creates several issues for an AI-native OS:
1.  **Introspection Gap**: The system cannot know what a handler accepts without running it or parsing external docs.
2.  **Routing Complexity**: Systems rely on "magic strings" or manual registration maps to route messages to handlers.
3.  **State Leaks**: Class-based handlers often accumulate hidden state, violating the functional purity required for reliable replay and testing.
4.  **Blocking Semantics**: Promise-based handlers (`async (msg) => response`) enforce a request/response model, making it difficult to implement streaming, 1-to-N events, or backpressure.

### The Solution
The **System Capability Module** pattern solves these by:
1.  **Schema as Source of Truth**: The Capability Object exports Zod schemas that the Kernel introspects to determine routing keys (`type`) and validation rules.
2.  **Static Definition**: The Capability is a plain object, not a class instance. It is immutable and stateless.
3.  **Stream Processors**: Execution is defined as a `TransformStream`, enabling true Event-Driven Architecture (EDA) with backpressure and non-blocking concurrency.

---

## 3. Goals & Non-Goals

### Goals
1.  Define the normative interface for a System Capability.
2.  Establish the **Static Capability Object** pattern as the standard for all Kernel extensions.
3.  Mandate **Stream-based processing** (EDA) over Promise-based handling.
4.  Enforce **Introspection-first** design for LLM discoverability.

### Non-Goals
1.  Defining specific capabilities (e.g., `Memory`, `Http`).
2.  Specifying the internal implementation of the Kernel Registry.
3.  Defining the wire protocol (covered in RFC 0024).

---

## 4. Detailed Design

### 4.1 Terminology (Normative)

*   **Capability**: The static configuration object (the "Blueprint"). It is immutable and stateless.
*   **Factory**: A pure function within the Capability that instantiates the runtime logic.
*   **Processor**: The `TransformStream<OsMessage, OsMessage>` returned by the Factory. It executes the logic.
*   **Inbound Schema**: The Zod schema defining the message(s) the Capability accepts (Commands/Queries).
*   **Outbound Schema**: The Zod schema defining the message(s) the Capability emits (Replies/Events).

### 4.2 The Capability Interface (Normative)

All System Capabilities **MUST** implement the following contract. This interface is the "Driver Development Kit" (DDK) for PromptWar̊e ØS.

```typescript
interface Capability<InboundSchema, OutboundSchema> {
  /**
   * Human-readable description for LLM introspection (Syscall.Describe).
   * MUST explain "what" and "why", not "how".
   */
  description: string;

  /**
   * The Zod schema for the inbound message (Command/Query).
   * MUST include .describe() for LLM introspection.
   * MUST validate `kind` (command|query) and `type` (e.g. Memory.Get).
   */
  inbound: InboundSchema;

  /**
   * The Zod schema for the outbound message (Reply/Event).
   * MUST include .describe() for LLM introspection.
   */
  outbound: OutboundSchema;

  /**
   * The reactive processor factory.
   * Returns a fresh TransformStream that accepts Inbound OsMessages and emits Outbound OsMessages.
   * MUST NOT throw exceptions; MUST emit error messages.
   */
  factory: () => TransformStream<OsMessage, OsMessage>;
}
```

### 4.3 The Static Object Pattern (Normative)

Implementations **MUST** adhere to the following structural rules:

1.  **Atomic Named Exports**: Capabilities **MUST** be exported as named constants.
    *   ✅ `export const SyscallPing = { ... }`
    *   ❌ `export default class Ping { ... }`
    *   ❌ `export function createPing() { ... }`

2.  **Implicit Routing**: Capabilities **MUST NOT** define separate routing keys. The Kernel **MUST** introspect `cap.inbound.shape.type` (the Zod literal) to determine the routing key.
    *   *Rationale*: Ensures the Schema and the Router never drift out of sync.

3.  **Statelessness**: The Capability Object **MUST** be stateless. Any required state (e.g., database connections) **MUST** be managed via the `Context` passed to the stream or external subsystems (like `Memory`), never stored on the Capability object itself.

### 4.4 The Processor Contract (Normative)

The `factory` function **MUST** return a `TransformStream` that adheres to these behavioral rules:

1.  **Input**: The `writable` side receives `OsMessage` objects. The Processor **MAY** assume these messages have already been validated against the `inbound` schema by the Kernel.
2.  **Output**: The `readable` side emits `OsMessage` objects. These **MUST** conform to the `outbound` schema or be of `kind: "error"`.
3.  **No Throwing**: Processors **MUST NOT** throw exceptions. All failures **MUST** be emitted as `kind: "error"` messages.
4.  **Backpressure**: Processors **MUST** respect stream backpressure. If the downstream consumer is slow, the Processor **SHOULD** pause consumption.
5.  **1-to-N Emission**: A single Inbound message **MAY** trigger zero, one, or multiple Outbound messages (e.g., a Command triggering an Event and then a Reply).

### 4.5 Introspection & Discovery

The Kernel uses the Capability Object to support `Syscall.Describe` without instantiating the Processor.

1.  **Description**: The `description` field is returned verbatim to the LLM.
2.  **Schema Extraction**: The Kernel extracts the JSON Schema from `inbound` and `outbound` Zod schemas to generate the tool definition.

---

## 5. Compatibility

This RFC formalizes the pattern introduced in the "Static Capability Refactor" (Jan 2026).

*   **Backward Compatibility**: This is a breaking change for any legacy handlers using the `(ctx, msg) => Promise` pattern. All such handlers **MUST** be migrated to the `TransformStream` pattern.
*   **Forward Compatibility**: The `Capability` interface is versioned implicitly. Future extensions (e.g., adding `examples` or `cost`) can be added as optional fields to the object without breaking existing processors.

---

## 6. Rationale

### 6.1 Why Static Objects?
Static objects are easier to analyze, test, and bundle than classes or factory functions. They force a separation of data (Schema) and behavior (Factory), which aligns with the "Code as Data" philosophy of AI-native systems.

### 6.2 Why Streams instead of Promises?
Promises enforce a 1-to-1 Request/Response model. This is insufficient for an OS that needs to support:
*   **Events**: One command triggering multiple updates.
*   **Progress**: Long-running tasks emitting status updates.
*   **Backpressure**: Preventing fast producers from overwhelming slow consumers.
*   **Cancellation**: Aborting a stream is cleaner than cancelling a Promise chain.

### 6.3 Why Introspection via Schema?
Duplicating the routing key (once in the registry map, once in the schema) leads to drift. By forcing the Kernel to read the Schema, we guarantee that **what is validated is exactly what is routed**.

---

## 7. Alternatives Considered

### 7.1 Class-based Handlers
*   *Approach*: `class PingHandler { handle(msg) { ... } }`
*   *Rejection*: Classes encourage internal state and make static analysis (introspection) harder. They also tend to hide the schema definition inside the class logic.

### 7.2 Functional Handlers
*   *Approach*: `const ping = (msg) => response`
*   *Rejection*: Simple functions lack a standard place to attach metadata (Description, Schemas). We would need a separate "Definition" object anyway. Bundling them into a single Capability object keeps everything cohesive.

---

## 8. Security Considerations

### 8.1 Input Validation
The Kernel **MUST** validate all Inbound messages against `cap.inbound` *before* passing them to the Processor. This ensures that the Processor code only ever deals with valid, safe data types.

### 8.2 Error Containment
Because Processors are Streams, an error in one Processor does not crash the Kernel. The Kernel **MUST** monitor the stream and, if a Processor crashes (throws), catch the error and emit a standard `kind: "error"` message to the consumer.

---

## 9. Implementation Plan

1.  **Define Interface**: Create `os/kernel/schema/capability.ts` with the `Capability` interface.
2.  **Refactor Capabilities**: Convert all existing capabilities (`ping`, `memory`, `fetch`, etc.) to the Static Object pattern.
3.  **Update Registry**: Modify `registry.ts` to accept `Capability[]` and introspect them.
4.  **Update Dispatch**: Update `dispatch.ts` to support the new interface for testing.

*Note: As of Jan 2026, this implementation plan has been executed and verified.*

---

## 10. Future Directions

### 10.1 Dynamic Capabilities
The Static Object pattern makes it easy to serialize a Capability definition (Schema + Code string) and send it over the wire. This paves the way for **Runtime Capability Registration** (RFC 0024, Superpower 3), where an LLM can author a new Capability and register it instantly.

---

## 11. Unresolved Questions

None.

---

## 12. References

### PromptWar̊e ØS References
*   [RFC 0024: CQRS Message Schema](0024-cqrs-message-schema.md)
*   [RFC 0019: Kernel ABI & Syscall Interface](0019-kernel-abi-syscall.md)

### External References
*   [Streams API Specification](https://streams.spec.whatwg.org/)
*   [Zod Documentation](https://zod.dev/)

---

End of RFC 0031

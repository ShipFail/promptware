---
rfc: 0024
title: CQRS Event Schema
author: Huan Li
status: Draft
type: Standards Track
created: 2025-12-28
updated: 2025-12-31
version: 0.2
tags: [kernel, events, cqrs, architecture, protocol]
---

# RFC 0024: CQRS Event Schema

## 1. Summary

This RFC defines the event schema and NDJSON protocol for PromptWarẽ ØS reactive kernel. It establishes **OsEvent** as the universal interface between LLM intent (natural language) and deterministic execution (kernel syscalls), enabling a single data model to span both the Prompt Kernel (Ring 0) and Software Kernel (Ring 1).

The design adopts CQRS (Command Query Responsibility Segregation), Event Sourcing lineage tracking (correlation/causation), and industry standards (CloudEvents, EventStoreDB, JSON:API) to create a universal plain-text protocol that enables unprecedented runtime extensibility and LLM-as-microservice architecture.

---

## 2. Motivation

### The Universal Event Model - Three Superpowers

PromptWarẽ ØS adopts **CQRS event-driven architecture** with plain JSON events as the universal interface. This design unlocks three transformative capabilities that define the AI-native operating system paradigm:

#### **Superpower 1: Universal Plain Text Protocol**

**The Problem**: Traditional operating systems create artificial boundaries:
- **Type boundaries**: Strongly-typed APIs require marshaling between languages (C ↔ Python ↔ Go)
- **Serialization layers**: Data must be encoded/decoded crossing process boundaries
- **Language lock-in**: Syscall ABIs tied to specific languages or binary formats

**The Solution**: Everything is a plain JavaScript object (JSON).

```
Traditional OS:                    PromptWarẽ ØS:
┌─────────────────┐               ┌─────────────────┐
│ Typed Function  │               │  Plain JSON     │
│ int syscall(    │               │  {"type": ...,  │
│   struct args*) │               │   "payload": }  │
└─────────────────┘               └─────────────────┘
        ↓                                  ↓
   Marshaling                        Zero conversion
   Type checking                     Universal format
   ABI constraints                   Language-agnostic
```

**Benefits**:
- ✅ **No type boundaries** - JSON is the universal truth across all system layers
- ✅ **No conversion layers** - Text flows between LLM and code without marshaling
- ✅ **Language-agnostic** - TypeScript, Python, Rust, Go all speak events equally
- ✅ **Pure data** - JSON-serializable constraint prevents code injection

#### **Superpower 2: LLM-as-Microservice Architecture**

**The Problem**: Traditional systems treat LLMs as external services that require translation layers:
- **LLM output** (natural language) → Parser → Structured commands
- **System output** (typed data) → Formatter → Natural language
- **Impedance mismatch**: Two fundamentally different interfaces

**The Solution**: Prompt Kernel and Software Kernel speak the same event language.

```
Prompt Kernel (Ring 0):
  LLM generates: {"type":"command", "name":"Memory.Set", "payload":{...}}
         ↓
    Zero translation layer
         ↓
Software Kernel (Ring 1):
  Executes handler, returns: {"type":"response", "name":"Memory.Set", "payload":{...}}
         ↓
    Zero translation layer
         ↓
Prompt Kernel:
  LLM processes response event directly
```

**Benefits**:
- ✅ **Bidirectional event flow** - LLM emits events to software, software emits events to LLM
- ✅ **No impedance mismatch** - Same data model for intent (LLM) and execution (code)
- ✅ **Cloud-native pattern** - Every subsystem (including the LLM!) is a microservice
- ✅ **Decoupled infrastructure** - Any language, any runtime, any cloud - as long as it speaks NDJSON

**Cognitive Load Reduction**: Instead of learning 11 different syscall APIs × N parameters each, LLMs learn **1 event schema with 5 behavioral types** = **91% complexity reduction**.

#### **Superpower 3: 100% Dynamic Runtime Extensibility**

**The Problem**: Traditional operating systems cannot modify their syscall interface at runtime:
- **Compiled syscalls** - Baked into kernel binary, requires rebuild
- **Security boundaries** - Untrusted code cannot register syscalls
- **ABI stability** - Binary compatibility prevents runtime changes

**The Solution**: Event handlers are pure functions that consume/produce JSON - they can come from anywhere.

```typescript
// Traditional syscall (tightly coupled)
int memory_set(char* key, char* value) {
  // Implementation baked into kernel
}

// CQRS handler (loosely coupled)
const handler = (input: {key: string, value: string}) => {
  return {success: true}
}
// ↑ This can come from: file, network, LLM-generated code!
```

**The Self-Modifying OS Pattern**:

**Scenario 1: Prompt Kernel Creates New Syscall**
```
1. LLM: "I need a Stripe.Charge syscall"
2. LLM drafts TypeScript handler code
3. LLM emits: {"type":"command", "name":"Syscall.Register", "payload":{code: "..."}}
4. Software Kernel dynamically imports handler (Deno runtime)
5. LLM immediately uses: {"type":"command", "name":"Stripe.Charge", "payload":{...}}
```

**Scenario 2: Ring 3 Application Agent Extension**
```
1. User app needs custom logic: "Analytics.TrackEvent"
2. App agent generates handler code
3. Registers to its own event router
4. Other agents invoke via events (no kernel modification!)
```

**Why This Works (Trust-Maximal Model)**:

Under the co-founder privilege model:
- ✅ No authentication needed (all code is trusted)
- ✅ No sandboxing friction (LLM writes safe code)
- ✅ No versioning hell (live code replacement)
- ✅ Dynamic imports are features, not bugs

**Benefits**:
- ✅ **Self-extension** - OS writes and registers its own syscalls without limitations
- ✅ **Zero deployment** - New features go live instantly (no rebuild, no restart)
- ✅ **Application-level handlers** - Ring 3 apps can define custom event handlers
- ✅ **Unique capability** - No traditional OS allows runtime syscall registration

**This is unique to PromptWarẽ ØS** - traditional OS can't do this because:
- Security implications (untrusted code)
- ABI compatibility (binary interfaces)
- Type safety (compiled languages)

But in an AI-native OS where the LLM is the co-founder:
- Code is trusted (written by the system itself)
- Text-based (no ABI, just JSON)
- Runtime validation (Zod schemas)

---

### The Philosophical Breakthrough

**Event-driven CQRS with plain JSON events creates a universal language that:**
1. **Erases boundaries** between LLM (text-native) and software (function-native)
2. **Enables LLM-as-microservice** architecture across all system layers
3. **Allows 100% dynamic runtime extensibility** where the OS writes and registers its own syscalls without limitations

**This is the AI-native OS differentiator** - the system extends itself at runtime through natural language intent, where the boundary between specification and implementation disappears.

---

## 3. Goals & Non-Goals

### Goals

1. **Specify observable event behavior** in a language-agnostic manner
2. **Enable independent implementations** (TypeScript, Python, Rust, Go)
3. **Optimize for LLM comprehension** (JSON, semantic field names, introspectable)
4. **Reduce system complexity** (uniform error handling, single protocol)
5. **Support workflow tracing** (correlation/causation lineage)
6. **Enable runtime extensibility** (dynamic syscall registration)

### Non-Goals

1. **Implementation language**: Specification is language-neutral
2. **Storage backend**: Event persistence is optional (out of scope for v1)
3. **Middleware architecture**: TransformStreams are an implementation detail
4. **Schema versioning**: V1 allows breaking changes (defer to future RFC)
5. **Binary protocols**: NDJSON only (CBOR/MessagePack deferred)

---

## 4. Detailed Design

### 4.1 Event Schema (Normative)

An **OsEvent** is a JSON object with the following structure:

```json
{
  "type": "<behavioral-type>",
  "name": "<event-name>",
  "payload": <json-value>,
  "metadata": {
    "id": "<unique-id>",
    "timestamp": <unix-epoch-ms>,
    "correlation": "<workflow-id>",
    "causation": "<parent-event-id>"
  }
}
```

#### 4.1.1 Required Fields

| Field | Type | Description | Requirement |
|-------|------|-------------|-------------|
| `type` | String (Enum) | Behavioral envelope type | MUST be one of: `command`, `query`, `event`, `response`, `error` |
| `name` | String | Domain event name in dot notation | MUST match pattern `^[A-Z][a-zA-Z0-9]*\.[A-Z][a-zA-Z0-9]*$` (e.g., `Memory.Set`) |
| `payload` | Any | Data payload or error object | MUST be JSON-serializable (no functions, symbols, undefined) |
| `metadata` | Object | Event metadata for tracing | MUST be present and contain required subfields |

#### 4.1.2 Metadata Subfields

| Field | Type | Description | Requirement |
|-------|------|-------------|-------------|
| `metadata.id` | String | Unique event identifier | MUST be present, SHOULD be globally unique (e.g., UUID, shortId) |
| `metadata.timestamp` | Number | Unix epoch milliseconds | MUST be present, MUST be non-negative integer |
| `metadata.correlation` | String | Workflow/session correlation ID | MAY be present, if present MUST be non-empty string |
| `metadata.causation` | String | Direct parent event ID | MAY be present, if present MUST reference a valid event ID |

---

### 4.2 Behavioral Envelope Types (Normative)

The `type` field determines the **semantic intent** of the event and imposes behavioral constraints on implementations.

#### 4.2.1 Command (`type: "command"`)

**Semantics**: "Do this" — A request to mutate observable state.

**Requirements**:
- **MUST** be retriable: Sending the same command twice with the same idempotency key (if supported) MUST produce identical observable effects.
- **SHOULD** be handled asynchronously: Implementations MAY defer execution and return immediately.
- Implementations MUST emit either a `response` or `error` event as the outcome.

**Examples**: `Memory.Set`, `Http.Fetch`, `Crypto.Seal`

#### 4.2.2 Query (`type: "query"`)

**Semantics**: "Get this" — A request to retrieve state without mutation.

**Requirements**:
- **MUST NOT** mutate observable state: Sending a query MUST NOT change any data visible to future queries or commands.
- **MUST** be deterministic: Same input + same state → same output.
- Implementations MUST emit either a `response` or `error` event as the outcome.

**Examples**: `Memory.Get`, `Memory.List`, `Syscall.Describe`

#### 4.2.3 Event (`type: "event"`)

**Semantics**: "This happened" — An immutable notification of a past occurrence.

**Requirements**:
- **MUST** use past tense or perfect aspect in naming: `Job.Completed`, `File.Created`, `User.Authenticated`.
- **MUST** be immutable: Once emitted, the event's payload and metadata MUST NOT change.
- Implementations MAY ignore events (they are notifications, not commands).

**Examples**: `Job.Completed`, `Memory.Synchronized`, `Daemon.Started`

#### 4.2.4 Response (`type: "response"`)

**Semantics**: "Here is the outcome" — The successful result of a command or query.

**Requirements**:
- **MUST** include `metadata.causation`: The ID of the command/query that triggered this response.
- **SHOULD** use the same `name` as the originating request (e.g., `Memory.Set` command → `Memory.Set` response).
- `payload` contains the success result (specific to each syscall).

**Examples**: Response to `Memory.Get` with retrieved value, response to `Crypto.Seal` with ciphertext.

#### 4.2.5 Error (`type: "error"`)

**Semantics**: "This failed" — The failure outcome of a command or query.

**Requirements**:
- **MUST** include `metadata.causation`: The ID of the command/query that failed.
- **SHOULD** use the same `name` as the originating request.
- `payload` **MUST** conform to the HTTP-centric error schema (Section 4.2.6).

#### 4.2.6 Error Payload Schema (Normative)

Error event payloads MUST use the following minimalist HTTP-centric structure:

```typescript
interface ErrorPayload {
  code: number;           // HTTP status code (400, 403, 404, 422, 500, 502, 504, etc.)
  message: string;        // Human-readable error description with embedded context
  cause?: ErrorPayload;   // Optional error chaining (ES2022 standard)
}
```

**Field Requirements**:

| Field | Type | Description | Requirement |
|-------|------|-------------|-------------|
| `code` | Number | HTTP status code | MUST be a valid HTTP status code (400-599). See Appendix C for standard codes. |
| `message` | String | Human-readable error description | MUST be present. SHOULD embed contextual details (e.g., "Key not found: /notes/123"). |
| `cause` | ErrorPayload | Underlying error that caused this error | OPTIONAL. When present, enables error chaining following ES2022 Error.cause semantics. |

**Example - Simple Error**:
```json
{
  "type": "error",
  "name": "Memory.Get",
  "payload": {
    "code": 404,
    "message": "Key not found: /notes/123"
  },
  "metadata": {
    "id": "err-789",
    "timestamp": 1735000002000,
    "causation": "cmd-123"
  }
}
```

**Example - Error Chaining**:
```json
{
  "type": "error",
  "name": "Crypto.Seal",
  "payload": {
    "code": 500,
    "message": "Encryption failed",
    "cause": {
      "code": 404,
      "message": "Encryption key not found in vault: /keys/master"
    }
  },
  "metadata": {
    "id": "err-999",
    "timestamp": 1735000003000,
    "causation": "cmd-456"
  }
}
```

**Rationale**:

1. **HTTP codes are semantic** - 404 explicitly means "not found", 403 means "forbidden", 422 means "validation failed" (distinct meanings)
2. **LLM-native** - Models trained on billions of HTTP examples, understand codes intuitively
3. **Minimal tokens** - 3-field design (~15-25 tokens vs ~40 tokens for verbose formats)
4. **CQRS-aligned** - Event `name` provides operation context, payload `code` provides failure reason
5. **ES2022 standard** - `cause` field matches JavaScript Error.cause for error chaining
6. **Contextual messages** - Details embedded naturally: "Key not found: /notes/123" (not separate `details` object)

---

### 4.3 NDJSON Protocol (Normative)

#### 4.3.1 Framing

Events MUST be transmitted as **Newline Delimited JSON (NDJSON)**:
- Each event is serialized as a single JSON object on one line.
- Lines are terminated with a newline character (`\n`, U+000A).
- Encoding MUST be UTF-8.

**Example**:
```
{"type":"command","name":"Echo","payload":{"message":"hello"},"metadata":{"id":"abc123","timestamp":1735000000000}}
{"type":"response","name":"Echo","payload":{"echo":"hello"},"metadata":{"id":"def456","timestamp":1735000001000,"causation":"abc123"}}
```

#### 4.3.2 Line Length and Large Payloads

**Maximum Line Length**: 16,384 bytes (16 KB)

**Enforcement**:
- Individual lines **MUST NOT** exceed 16 KB (16,384 bytes).
- Implementations **MUST** reject lines exceeding this limit by emitting an `error` event with `code: 413` (Payload Too Large), `message: "Event exceeds maximum line length of 16KB"`.
- Implementations **MAY** support larger lines if explicitly configured, but this is NOT RECOMMENDED.

**Rationale for 16 KB Limit**:
- **Token efficiency** - Prompt Kernels are token-expensive; smaller payloads enable faster LLM inference
- **Performance** - 16 KB fits comfortably in network MTUs and parser buffers
- **Practical threshold** - Very few syscalls need >16 KB of data in a single event
- **Enforces good architecture** - Large data should use BlobPointer pattern (RFC-0025)

**Large Payload Pattern (Normative)**:

When payload data would cause the serialized event to exceed 16 KB, implementations **MUST** use the **BlobPointer pattern** defined in RFC-0025:

1. Write large data to storage (Memory, VFS, external service)
2. Include BlobPointer reference in event payload
3. Receiver resolves BlobPointer to retrieve data

**Example - Large HTTP Response**:

❌ **Wrong: Embed large data in event**
```json
{
  "type": "response",
  "name": "Http.Fetch",
  "payload": {
    "status": 200,
    "body": "<100KB of HTML content...>"
  }
}
```

✅ **Correct: Use BlobPointer (RFC-0025)**
```json
{
  "type": "response",
  "name": "Http.Fetch",
  "payload": {
    "status": 200,
    "headers": {"content-type": "text/html"},
    "bodyRef": {
      "scheme": "file",
      "path": "/tmp/response-abc123"
    }
  }
}
```

**Design Principle**: Events are the **control plane** (metadata, commands, status), BlobPointers are the **data plane** (large binary/text content).

**Implementation Detail**: How BlobPointers are created, serialized, and resolved is implementation-specific (see RFC-0025).

#### 4.3.3 Parsing

Implementations MUST handle the following cases:

1. **Valid JSON**: Parse and validate against event schema.
2. **Invalid JSON**: Emit `error` event with `code: 400`, `message: "Invalid JSON: <parse error>"`, continue processing next line.
3. **Schema violation**: Emit `error` event with `code: 422`, `message: "Schema validation failed: <details>"`.
4. **Partial read**: Buffer incomplete lines until newline is received.
5. **Line too long**: Emit `error` event with `code: 413`, `message: "Event exceeds maximum line length of 16KB"`.

**Error Recovery**: Implementations MUST continue processing subsequent lines after encountering invalid input.

---

### 4.4 Event Name Dot Notation (Normative)

#### 4.4.1 Pattern

Event names MUST follow the **Domain.Action** pattern:

```
<Domain>.<Action>
```

- **Domain**: PascalCase noun (e.g., `Memory`, `Crypto`, `Job`, `Syscall`)
- **Action**: PascalCase verb or noun (e.g., `Get`, `Set`, `Seal`, `Completed`)

**Regular Expression**:
```
^[A-Z][a-zA-Z0-9]*\.[A-Z][a-zA-Z0-9]*$
```

**Examples**:
- ✅ `Memory.Get`
- ✅ `Http.Fetch`
- ✅ `Crypto.Seal`
- ✅ `Job.Completed`
- ✅ `Syscall.Describe`
- ❌ `memory.get` (lowercase)
- ❌ `MemoryGet` (no dot separator)
- ❌ `Memory.get` (Action not PascalCase)

#### 4.4.2 Rationale

Dot notation provides:
1. **Namespace clarity**: Domain separates concerns (e.g., all `Memory.*` events relate to storage)
2. **LLM parseability**: Easier for models to extract intent vs. Unix paths (`memory/get`)
3. **Industry standard**: Matches EventStoreDB, gRPC, Protobuf conventions
4. **Tool support**: Enables autocomplete, schema generation, linting

---

### 4.5 Correlation and Causation Semantics (Normative)

#### 4.5.1 Correlation

**Purpose**: Track all events belonging to a single workflow, session, or user request.

**Requirements**:
- All events in a workflow **SHOULD** share the same `metadata.correlation` value.
- The correlation ID **SHOULD** be generated at the workflow entry point (e.g., user request).
- Correlation IDs **SHOULD** persist across syscall boundaries (e.g., `Memory.Get` → `Http.Fetch` → `Crypto.Seal` all share correlation).

**Example Workflow**:
```
Event 1: {name: "Memory.Get", correlation: "user-req-123", causation: null}
Event 2: {name: "Http.Fetch", correlation: "user-req-123", causation: "event-1-id"}
Event 3: {name: "Crypto.Seal", correlation: "user-req-123", causation: "event-2-id"}
```

#### 4.5.2 Causation

**Purpose**: Track the **direct parent** event that triggered this event.

**Requirements**:
- Response and error events **MUST** set `metadata.causation` to the ID of the originating command/query.
- Chained events **SHOULD** set `metadata.causation` to the immediate predecessor.
- If an event has no parent (e.g., user-initiated command), `causation` **MAY** be omitted or null.

**Determinism**: Given an event `E` with `causation: "P"`, there MUST exist a prior event with `id: "P"` in the same stream or workflow.

---

### 4.6 Validation Requirements (Normative)

#### 4.6.1 Schema Validation

Implementations MUST validate incoming events against the schema defined in Section 4.1 before execution.

**Validation Points**:
1. **Structural**: Presence of required fields (`type`, `name`, `payload`, `metadata`)
2. **Type checking**: `type` is a valid enum value, `timestamp` is a number, etc.
3. **Pattern matching**: `name` matches dot notation regex
4. **Payload serialization**: `payload` is JSON-serializable (no functions, symbols, undefined)

#### 4.6.2 Validation Failures

When validation fails, implementations MUST:
1. **NOT** execute the handler
2. Emit an `error` event with:
   - `type: "error"`
   - `name: "Validation.Failed"` (or original event name if parseable)
   - `payload.code`: `422` (Unprocessable Entity)
   - `payload.message`: Human-readable error description with validation details
   - `metadata.causation`: ID of the invalid event (if available)

**Example Error Event**:
```json
{
  "type": "error",
  "name": "Validation.Failed",
  "payload": {
    "code": 422,
    "message": "Missing required field: type"
  },
  "metadata": {
    "id": "err-123",
    "timestamp": 1735000002000,
    "causation": "bad-event-id"
  }
}
```

---

### 4.7 Error Handling (Normative)

#### 4.7.1 Fail-Safe Principle

Implementations MUST treat errors as **events**, not exceptions:
- Syscall handler errors **MUST NOT** crash the kernel or stream.
- All failures **MUST** result in an `error` type event being emitted.
- The stream **MUST** continue processing subsequent events after an error.

#### 4.7.2 Error Event Requirements

Error events (Section 4.2.5, 4.2.6) MUST include:
- `type: "error"`
- `name`: Same as the failed command/query (or `"Validation.Failed"` for schema errors)
- `payload.code`: HTTP status code (400-599)
- `payload.message`: Human-readable error description
- `metadata.causation`: ID of the event that caused the error

Error events **MAY** include:
- `payload.cause`: Nested ErrorPayload for error chaining

---

### 4.8 Introspection via Syscall.Describe (Informational)

Implementations **SHOULD** provide a `Syscall.Describe` syscall that returns JSON Schema for any registered event name.

**Example Request**:
```json
{
  "type": "query",
  "name": "Syscall.Describe",
  "payload": {"name": "Memory.Set"},
  "metadata": {
    "id": "qry-123",
    "timestamp": 1735000000000
  }
}
```

**Example Response**:
```json
{
  "type": "response",
  "name": "Syscall.Describe",
  "payload": {
    "name": "Memory.Set",
    "type": "command",
    "input": {
      "type": "object",
      "properties": {
        "key": {
          "type": "string",
          "description": "Path in memory namespace (e.g., '/notes/123', 'vault/api-key'). Must be valid path without leading/trailing slashes."
        },
        "value": {
          "type": "string",
          "description": "Content to store. Any string value is accepted. For encrypted storage, use vault/* namespace with pwenc:v1:* format."
        }
      },
      "required": ["key", "value"],
      "additionalProperties": false
    },
    "output": {
      "type": "object",
      "properties": {
        "success": {
          "type": "boolean",
          "description": "True if the key-value pair was successfully stored, false otherwise."
        }
      },
      "required": ["success"],
      "additionalProperties": false
    }
  },
  "metadata": {
    "id": "rsp-456",
    "timestamp": 1735000001000,
    "causation": "qry-123"
  }
}
```

**Schema Format Requirements**:
- MUST use **JSON Schema Draft 7** or later
- MUST include `description` field for all input parameters (AI-native explanations)
- SHOULD include `description` for output fields when behavior is non-obvious
- MUST include `required` array to indicate mandatory fields
- SHOULD include `additionalProperties: false` to enforce strict validation

**Rationale**:
- **Standard format** - JSON Schema is language-agnostic and universally supported
- **Tool integration** - VS Code, validators, code generators work with JSON Schema
- **AI-native descriptions** - LLMs use `description` fields to understand parameter semantics
- **Cold-path operation** - Called once per conversation, then cached in context window (token cost amortized)
- **Pure data** - No executable code in JSON payload (unlike Zod strings)

**Purpose**: Enables LLMs and tools to discover syscall contracts at runtime without consulting external documentation.

---

## 5. Compatibility

### 5.1 PromptWarẽ ØS RFCs

This RFC is compatible with and builds upon:

- **RFC 0022 (STOP Protocol)**: Semantic field names (`correlation` vs `corr_id`) optimize token clarity without cost increase.
- **RFC 0016 (Crypto Primitives)**: `Crypto.Seal`, `Crypto.Open`, `Crypto.Derive` use event payloads for inputs/outputs.
- **RFC 0018 (Kernel Memory)**: `Memory.Get/Set/Delete/List` use CQRS command/query separation.
- **RFC 0023 (Syscall Bridge)**: Inline, client, and daemon modes all transmit events via NDJSON protocol.
- **RFC 0025 (BlobPointer Serialization)**: Large payloads (>16KB) use BlobPointer references in event payloads.

### 5.2 Industry Standards

This RFC aligns with:

- **CloudEvents**: Event envelope structure (`type`, `payload`, `metadata`).
- **EventStoreDB**: Dot notation, causation/correlation lineage.
- **JSON Schema**: Standard schema format for `Syscall.Describe` introspection.
- **JSON:API**: Error response principles (though using simpler HTTP-centric schema).
- **CQRS**: Command/Query behavioral separation.
- **ES2022 (ECMAScript)**: Error.cause for error chaining.

### 5.3 Backward Compatibility

**Breaking Change Policy**: v1.0 prioritizes rapid iteration over stability. This RFC allows breaking changes to the event schema without versioning.

**Future Compatibility**: When schema versioning is needed, a future RFC will define:
- `metadata.schemaVersion` field
- Migration strategies
- Deprecation timelines

---

## 6. Rationale

### 6.1 Why JSON (Not Binary)?

**Decision**: Use JSON for event payloads, not binary formats (Protobuf, MessagePack, CBOR).

**Rationale**:
1. **LLM-native**: LLMs generate and parse JSON with near-perfect accuracy.
2. **Human-readable**: Developers can inspect events without decoding tools.
3. **Universal**: Supported by every programming language and platform.
4. **Debuggable**: `console.log`, `stderr`, and shell pipes work out-of-the-box.

**Tradeoff**: JSON is 10-20% larger than binary, but the cognitive clarity justifies the overhead for an AI-native OS.

### 6.2 Why NDJSON (Not JSON-RPC)?

**Decision**: Use NDJSON streaming protocol, not request/response RPC.

**Rationale**:
1. **Streaming-native**: Handle multiple events in one pipe without buffering.
2. **Fail-safe**: One malformed line doesn't break the stream.
3. **Unix-compatible**: Works with `grep`, `awk`, `jq`, standard shell tools.
4. **Observable**: Each event logged as it flows through the pipeline.

**Alternatives Considered**:
- **JSON-RPC**: Single request/response, no streaming, complex error handling.
- **gRPC**: Binary protocol, not LLM-friendly, requires code generation.
- **GraphQL**: Query language overhead, not event-driven.

### 6.3 Why 5 Event Types (Not 3 or 7)?

**Decision**: Use exactly 5 behavioral types: `command`, `query`, `event`, `response`, `error`.

**Rationale**:
- **Minimal CQRS**: `command` + `query` cover state mutation and retrieval.
- **Responses separate**: `response` + `error` avoid boolean `success` flags.
- **Domain events**: `event` enables pub/sub notifications (future).

**Alternatives Considered**:
- **3 types** (command/query/event): Responses mixed with errors, ambiguous outcomes.
- **7 types** (add `notify`, `alert`, `log`): Premature abstraction, overlapping semantics.

### 6.4 Why Correlation AND Causation (Not Just One)?

**Decision**: Include both `correlation` and `causation` in metadata.

**Rationale**:
1. **Correlation** = Workflow ID (all events in a user request share this)
2. **Causation** = Direct parent ID (this event was caused by parent)
3. **Use case**: Trace entire workflow (`correlation`) OR build event graph (`causation`)

**Alternatives Considered**:
- **Single `reference` field**: Can't distinguish workflow from parent (original design flaw).
- **`parent_id` only**: Can't group workflow events across branches.

### 6.5 Why Dot Notation (Not Unix Paths)?

**Decision**: Require `Domain.Action` pattern for event names (e.g., `Memory.Set`).

**Rationale**:
1. **Semantic clarity**: Clear namespace separation (`Memory` = domain, `Set` = action).
2. **LLM parseability**: Easier for models to extract intent vs. paths (`memory/set`).
3. **Industry standard**: Matches EventStoreDB, gRPC, Protobuf.
4. **No escaping**: Unix paths require escaping in URLs, dot notation doesn't.

**Token Cost**: Identical (both ~2-3 tokens typically).

### 6.6 Why 16 KB Line Limit (Not 1 MB)?

**Decision**: Maximum line length of 16 KB, enforce BlobPointer for larger data.

**Rationale**:
1. **Token efficiency**: Prompt Kernels are token-expensive; smaller payloads = faster inference
2. **Performance**: 16 KB fits in network MTUs and parser buffers comfortably
3. **Practical threshold**: Very few syscalls need >16 KB in a single event
4. **Architectural clarity**: Separates control plane (events) from data plane (BlobPointers)

**Alternatives Considered**:
- **1 MB limit**: Too generous, encourages bloated payloads
- **64 KB limit**: Reasonable but no strong benefit over 16 KB
- **No limit**: Risks unbounded memory consumption, token waste

### 6.7 Why HTTP-Centric Error Payload (Not Named Errors)?

**Decision**: Use 3-field error payload with HTTP status codes, not error class names.

**Rationale**:
1. **HTTP codes are semantic** - 404 = "not found", 403 = "forbidden", 422 = "validation failed" (precise, distinct meanings)
2. **LLM-native** - Models trained on billions of HTTP examples, understand codes intuitively
3. **Minimal tokens** - 3 fields (~15-25 tokens) vs verbose formats (~40+ tokens)
4. **CQRS-aligned** - Event `name` provides operation context, `code` provides failure type
5. **ES2022 standard** - `cause` field matches JavaScript Error.cause

**Alternatives Considered**:
- **Named errors** (`{name: "NotFoundError", code: 404}`): Redundant, wastes tokens
- **String codes** (`{code: "NOT_FOUND"}`): Less universal than HTTP numeric codes
- **Details object** (`{details: {key: "..."}}`): Embed context in message instead

### 6.8 Why Full JSON Schema (Not Zod Strings)?

**Decision**: `Syscall.Describe` returns full JSON Schema, not Zod string syntax.

**Rationale**:
1. **Descriptions critical** - AI-native parameter explanations dominate token cost (schema boilerplate becomes negligible)
2. **Native `description` field** - JSON Schema has built-in description support (no separate object needed)
3. **Standard format** - Language-agnostic, tool-friendly (VS Code, validators)
4. **Pure data** - No executable code in JSON payload (Zod strings would require eval)
5. **Cold-path operation** - Called once per conversation, cached in context (token cost amortized)

**Alternatives Considered**:
- **Zod strings**: Compact but can't include descriptions in schema definition (would need separate object)
- **Simplified JSON Schema**: Custom format, requires LLM to learn new conventions

---

## 7. Alternatives Considered

### 7.1 JSON-RPC 2.0

**Pros**:
- Industry standard (widely adopted)
- Built-in error structure

**Cons**:
- Request/response coupling (no streaming)
- `id` field adds complexity (correlation)
- Verbose (`jsonrpc: "2.0"` in every message)

**Verdict**: NDJSON streaming is more aligned with reactive kernel architecture.

### 7.2 gRPC / Protobuf

**Pros**:
- Binary efficiency (~50% smaller than JSON)
- Strong typing (schema enforcement)

**Cons**:
- Not LLM-friendly (binary format)
- Requires code generation (`.proto` files)
- Not human-readable (debugging requires tools)

**Verdict**: Cognitive clarity > size efficiency for AI-native OS.

### 7.3 GraphQL

**Pros**:
- Flexible querying (request exactly what you need)
- Built-in introspection

**Cons**:
- Query language overhead (LLMs must learn GraphQL syntax)
- Not event-driven (still request/response)
- Schema complexity (types, resolvers, mutations)

**Verdict**: Too much abstraction for simple syscall invocations.

### 7.4 MessagePack / CBOR

**Pros**:
- Binary efficiency (smaller than JSON)
- JSON-like structure (arrays, objects, primitives)

**Cons**:
- Not human-readable
- Not LLM-native (models generate JSON, not binary)
- Tooling gap (less shell support than JSON)

**Verdict**: Defer binary protocols to future performance optimizations.

---

## 8. Security Considerations

### 8.1 Trust Model

PromptWarẽ ØS operates under a **trust-maximal model** (co-founder privilege):
- No authentication or authorization in the event schema (v1).
- All events are assumed to originate from trusted sources (LLM co-founder or authorized user).
- Future RFCs MAY add authentication (e.g., `Syscall.Authenticate` in RFC-23).

### 8.2 Payload Sanitization

Error events MUST NOT leak sensitive information:
- `payload.message` SHOULD be safe for logging (no passwords, keys, tokens).
- Implementations SHOULD provide a "sanitize" mode that redacts sensitive fields before logging.

### 8.3 Denial of Service

**Line length limit** (Section 4.3.2) mitigates unbounded memory consumption:
- Implementations MUST reject lines >16KB to prevent buffer exhaustion.
- Streaming parsers SHOULD limit buffer size to prevent memory attacks.

### 8.4 Injection Attacks

**JSON-serializable constraint** (Section 4.1.1) prevents code injection:
- `payload` MUST NOT contain functions, symbols, or executable code.
- Implementations MUST validate that `JSON.parse(JSON.stringify(payload)) === payload`.

### 8.5 Dynamic Code Execution

**Runtime syscall registration** (Superpower 3) requires careful implementation:
- Implementations SHOULD validate handler code does not escape sandbox (Deno permissions model)
- Implementations SHOULD rate-limit registration to prevent DoS via infinite syscall creation
- Under trust-maximal model, LLM-generated code is trusted (no sandboxing required)

---

## 9. Implementation Plan

### 9.1 Reference Implementation

**Language**: TypeScript (Deno runtime)
**Location**: `os/kernel/events.ts`, `os/kernel/streams/router.ts`

**Key Components**:
1. **Zod Schema**: Runtime validation of `OsEventSchema` (single source of truth)
2. **createEvent()**: Helper to construct valid events
3. **createError()**: Helper to construct HTTP-centric error events with causation
4. **routerStream**: TransformStream that dispatches events to handlers

### 9.2 Test Coverage

**Test Suite**: 47+ unit tests across 11+ syscalls validate conformance.

**Test Categories**:
1. **Schema validation**: Missing fields, invalid types, malformed names
2. **CQRS separation**: Commands mutate state, queries do not
3. **Error handling**: Handlers emit error events, not exceptions (HTTP-centric payload)
4. **Tracing**: Correlation/causation IDs propagate correctly
5. **NDJSON parsing**: Malformed JSON, partial lines, large payloads (>16KB)
6. **BlobPointer enforcement**: Large payloads use references, not inline data

### 9.3 Migration

**Existing Code**: All syscalls refactored to comply with this RFC (December 2025).

**Breaking Changes from v0.1**:
1. Error payload schema changed from `{message, code?, details?}` to `{code, message, cause?}`
2. Line length reduced from 1MB to 16KB (BlobPointer pattern required)
3. `Sys.Describe` renamed to `Syscall.Describe`
4. `Syscall.Describe` response format standardized to full JSON Schema

**Migration Strategy**:
- Update error creation helpers to use HTTP-centric schema
- Add line length validation with 16KB limit
- Implement BlobPointer support for large payloads
- Update introspection to return JSON Schema with descriptions

---

## 10. Future Directions

### 10.1 Event Persistence (Optional)

Future implementations MAY add event store for audit/replay:
- Store all events to Deno KV with prefix `/events/{timestamp}-{id}`
- Index by `correlation` for workflow replay
- Expose `Event.Replay` syscall for time-travel debugging

**Status**: Deferred to future RFC (not required for v1).

### 10.2 Schema Versioning

When breaking changes are needed, define:
- `metadata.schemaVersion` field
- Versioning strategy (semantic versioning, API deprecation)
- Migration tooling (auto-convert old events to new schema)

**Status**: Deferred until first breaking change needed.

### 10.3 Idempotency Keys for Command Deduplication

**Concept**: Add optional `idempotencyKey` field to event metadata to prevent duplicate command execution.

**Mechanism**:
- Client sends command with same `idempotencyKey` twice
- Kernel caches response for configurable TTL (e.g., 24 hours)
- Subsequent requests return cached response without re-execution
- Only applies to `command` type events (queries always execute)

**Example Event**:
```json
{
  "type": "command",
  "name": "Memory.Set",
  "payload": {"key": "/cart/123", "value": "..."},
  "metadata": {
    "id": "evt-123",
    "timestamp": 1735000000000,
    "idempotencyKey": "user-action-abc-def"
  }
}
```

**Value**:
- Safe retries for network failures
- Prevent double-charging, double-creation bugs in distributed workflows
- Foundation for at-least-once delivery semantics

**Status**: Roadmap Phase 1 (near-term priority).

### 10.4 Job Management for Long-Running Tasks

**Concept**: New syscalls to spawn, monitor, and cancel background jobs without blocking the kernel.

**New Event Names**:
- `Job.Start` (command) - Spawns background job, returns `job_id`
- `Job.Status` (query) - Returns current job state
- `Job.Cancel` (command) - Stops a running job
- `Job.List` (query) - Lists all jobs with optional filters

**Domain Events Emitted**:
- `Job.Started` (event) - Job execution began
- `Job.Completed` (event) - Job finished successfully
- `Job.Failed` (event) - Job encountered an error

**Use Cases**:
- Background HTTP fetch for slow APIs
- Multi-step content ingestion pipelines
- Scheduled tasks (cron-like deferred execution)

**Status**: Roadmap Phase 2.

### 10.5 Runtime Syscall Registration (Syscall.Register)

**Concept**: LLMs and applications can register new syscalls at runtime without kernel restart.

**New Event Name**:
- `Syscall.Register` (command)
  - Input: `{name: string, type: "command"|"query", code: string, inputSchema: object, outputSchema: object}`
  - Output: `{registered: boolean, name: string}`

**Mechanism**:
1. LLM generates TypeScript handler code
2. Kernel validates code exports `InputSchema`, `OutputSchema`, `handler`
3. Dynamically imports module via Deno's `import("data:text/typescript,...")`
4. Adds to event router; new syscall immediately available
5. `Syscall.Describe` can introspect registered syscalls

**Use Cases**:
- LLM creates domain-specific operations (`Stripe.Charge`, `Slack.PostMessage`)
- Ring 3 applications define custom event handlers
- Rapid prototyping without kernel rebuild

**Value**:
- True self-modifying OS (Superpower 3)
- Zero deployment (no rebuild, no restart)
- Unique AI-native capability

**Security Considerations** (Trust-Maximal Model):
- Handler code is trusted (LLM co-founder writes it)
- Deno permissions model provides sandboxing if needed
- Rate-limiting to prevent DoS via infinite registration

**Status**: Roadmap Phase 3 (experimental).

---

## 11. Unresolved Questions

None. All design decisions have been finalized and approved.

---

## 12. References

### PromptWarẽ ØS References

- [RFC 0022: Semantic Token Optimization Protocol (STOP)](0022-semantic-token-optimization-protocol.md)
- [RFC 0016: Security Crypto Primitives Specification](0016-security-crypto-primitives.md)
- [RFC 0018: System Memory Subsystem](0018-system-memory-subsystem.md)
- [RFC 0023: Dual-Mode Syscall Bridge Specification](0023-kernel-syscall-bridge.md)
- [RFC 0025: BlobPointer Serialization](0025-kernel-blob-pointer.md)

### External References

- [NDJSON Specification](http://ndjson.org/)
- [CloudEvents Specification v1.0](https://github.com/cloudevents/spec/blob/v1.0/spec.md)
- [EventStoreDB Projections](https://developers.eventstore.com/server/v21.10/projections.html)
- [CQRS Pattern (Microsoft)](https://learn.microsoft.com/en-us/azure/architecture/patterns/cqrs)
- [JSON Schema Draft 7](https://json-schema.org/draft-07/schema)
- [JSON:API Error Objects](https://jsonapi.org/format/#error-objects)
- [ES2022 Error.cause](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/cause)
- [BCP 14 (RFC 2119): Key words for use in RFCs](https://www.rfc-editor.org/rfc/rfc2119)

---

## Appendix A: Glossary

- **OsEvent**: The atomic unit of communication in PromptWarẽ ØS kernel.
- **NDJSON**: Newline Delimited JSON, a streaming protocol where each line is a JSON object.
- **CQRS**: Command Query Responsibility Segregation, a pattern separating read and write operations.
- **Correlation**: A workflow identifier shared by all events in a logical sequence.
- **Causation**: The ID of the direct parent event that triggered the current event.
- **Dot Notation**: Event naming pattern `Domain.Action` (e.g., `Memory.Set`).
- **Behavioral Envelope**: The `type` field categorizing event intent (command/query/event/response/error).
- **BlobPointer**: Reference to external large data (RFC-0025), used when event payload would exceed 16KB.

---

## Appendix B: Examples

### Example 1: Simple Query

**Request**:
```json
{"type":"query","name":"Memory.Get","payload":{"key":"/notes/1"},"metadata":{"id":"evt-123","timestamp":1735000000000}}
```

**Response**:
```json
{"type":"response","name":"Memory.Get","payload":"Note content here","metadata":{"id":"evt-456","timestamp":1735000001000,"causation":"evt-123"}}
```

### Example 2: Command with Error

**Request**:
```json
{"type":"command","name":"Crypto.Seal","payload":{"plaintext":"secret","key":"invalid"},"metadata":{"id":"evt-789","timestamp":1735000002000}}
```

**Error**:
```json
{"type":"error","name":"Crypto.Seal","payload":{"code":400,"message":"Invalid encryption key format"},"metadata":{"id":"evt-999","timestamp":1735000003000,"causation":"evt-789"}}
```

### Example 3: Workflow with Correlation

**Event 1** (User request):
```json
{"type":"command","name":"Memory.Get","payload":{"key":"/api/token"},"metadata":{"id":"evt-001","timestamp":1735000000000,"correlation":"workflow-abc"}}
```

**Event 2** (Response):
```json
{"type":"response","name":"Memory.Get","payload":"token123","metadata":{"id":"evt-002","timestamp":1735000001000,"correlation":"workflow-abc","causation":"evt-001"}}
```

**Event 3** (Chained command):
```json
{"type":"command","name":"Http.Fetch","payload":{"url":"https://api.example.com","headers":{"Authorization":"Bearer token123"}},"metadata":{"id":"evt-003","timestamp":1735000002000,"correlation":"workflow-abc","causation":"evt-002"}}
```

**Event 4** (Final response):
```json
{"type":"response","name":"Http.Fetch","payload":{"status":200,"body":"..."},"metadata":{"id":"evt-004","timestamp":1735000005000,"correlation":"workflow-abc","causation":"evt-003"}}
```

All events share `correlation: "workflow-abc"`, enabling full workflow tracing.

### Example 4: Error Chaining

**Request**:
```json
{"type":"command","name":"Crypto.Seal","payload":{"plaintext":"secret"},"metadata":{"id":"evt-100","timestamp":1735000000000}}
```

**Error with Cause**:
```json
{
  "type":"error",
  "name":"Crypto.Seal",
  "payload":{
    "code":500,
    "message":"Encryption failed",
    "cause":{
      "code":404,
      "message":"Encryption key not found in vault: /keys/master"
    }
  },
  "metadata":{"id":"evt-101","timestamp":1735000001000,"causation":"evt-100"}
}
```

### Example 5: Large Payload with BlobPointer

**Request** (HTTP fetch returns 100KB HTML):
```json
{"type":"command","name":"Http.Fetch","payload":{"url":"https://example.com"},"metadata":{"id":"evt-200","timestamp":1735000000000}}
```

**Response** (using BlobPointer per RFC-0025):
```json
{
  "type":"response",
  "name":"Http.Fetch",
  "payload":{
    "status":200,
    "headers":{"content-type":"text/html"},
    "bodyRef":{
      "scheme":"file",
      "path":"/tmp/fetch-response-200"
    }
  },
  "metadata":{"id":"evt-201","timestamp":1735000002000,"causation":"evt-200"}
}
```

---

## Appendix C: HTTP Status Code Registry

All PromptWarẽ ØS syscalls use **HTTP standard status codes** to minimize cognitive load for AI agents.

**Design principle**: Use the nearest HTTP standard code instead of inventing custom error names.

### Standard Error Codes

**4xx - Client Errors (Recoverable)**

| Code | Standard Name | Typical Meaning in PromptWarẽ ØS | Example |
|------|---------------|----------------------------------|---------|
| 400 | Bad Request | Malformed input, invalid syntax | Invalid JSON in payload |
| 403 | Forbidden | Operation not allowed (permissions, read-only namespace) | Write to `proc/*` (read-only) |
| 404 | Not Found | Resource/key does not exist | `Memory.Get` for non-existent key |
| 422 | Unprocessable Entity | Valid syntax but semantically invalid | `vault/*` value not pwenc format |

**5xx - Server Errors (Fatal)**

| Code | Standard Name | Typical Meaning in PromptWarẽ ØS | Example |
|------|---------------|----------------------------------|---------|
| 500 | Internal Server Error | Unexpected handler failure, system crash | Uncaught exception in syscall handler |
| 502 | Bad Gateway | Upstream service failure | VFS fetch failed (network error, upstream 404) |
| 504 | Gateway Timeout | Upstream service timeout | HTTP fetch exceeded timeout |

### Error Payload Format

All error events MUST use this payload structure:

```typescript
{
  code: number,     // HTTP status code (400-599)
  message: string,  // Human-readable description with context
  cause?: {         // Optional error chaining
    code: number,
    message: string,
    cause?: ...
  }
}
```

### Example Error Messages

**404 - Not Found**:
```json
{
  "code": 404,
  "message": "Key not found: /notes/123"
}
```

**403 - Forbidden**:
```json
{
  "code": 403,
  "message": "Operation not allowed: proc/* paths are read-only (attempted write to proc/system/summary)"
}
```

**422 - Unprocessable Entity**:
```json
{
  "code": 422,
  "message": "Invalid value format: vault/* requires pwenc:v1:* ciphertext (got plain text for vault/google/token)"
}
```

**502 - Bad Gateway**:
```json
{
  "code": 502,
  "message": "VFS fetch failed: no matching mount for os:///unknown/resource.md and root is undefined"
}
```

**500 - Internal Server Error with Cause**:
```json
{
  "code": 500,
  "message": "Memory backend failure",
  "cause": {
    "code": 500,
    "message": "Deno KV database connection lost"
  }
}
```

### Benefits of HTTP-Centric Errors

✅ **Minimal cognitive load**: AI agents already know HTTP status codes from billions of training examples
✅ **Standard semantics**: 403 = forbidden, 404 = not found, 422 = validation failed (distinct, precise meanings)
✅ **Context preserved**: Embed details in `message` field naturally
✅ **Error chaining**: `cause` field provides full causality (ES2022 standard)
✅ **Token efficient**: 3-field schema (~15-25 tokens) vs verbose formats (~40+ tokens)

---

## Appendix D: Syscall.Describe Examples

### Example 1: Simple Command

**Request**:
```json
{
  "type": "query",
  "name": "Syscall.Describe",
  "payload": {"name": "Echo"},
  "metadata": {"id": "qry-001", "timestamp": 1735000000000}
}
```

**Response**:
```json
{
  "type": "response",
  "name": "Syscall.Describe",
  "payload": {
    "name": "Echo",
    "type": "command",
    "input": {
      "type": "object",
      "properties": {
        "message": {
          "type": "string",
          "description": "Message to echo back. Any string value is accepted."
        }
      },
      "required": ["message"],
      "additionalProperties": false
    },
    "output": {
      "type": "object",
      "properties": {
        "echo": {
          "type": "string",
          "description": "The echoed message, identical to input."
        }
      },
      "required": ["echo"],
      "additionalProperties": false
    }
  },
  "metadata": {"id": "rsp-001", "timestamp": 1735000001000, "causation": "qry-001"}
}
```

### Example 2: Complex Command with Optional Fields

**Request**:
```json
{
  "type": "query",
  "name": "Syscall.Describe",
  "payload": {"name": "Http.Fetch"},
  "metadata": {"id": "qry-002", "timestamp": 1735000000000}
}
```

**Response**:
```json
{
  "type": "response",
  "name": "Syscall.Describe",
  "payload": {
    "name": "Http.Fetch",
    "type": "command",
    "input": {
      "type": "object",
      "properties": {
        "url": {
          "type": "string",
          "description": "HTTP/HTTPS URL to fetch. Must be valid URL format. Example: https://api.example.com/data"
        },
        "method": {
          "type": "string",
          "enum": ["GET", "POST", "PUT", "DELETE", "PATCH"],
          "description": "HTTP method. Defaults to GET if omitted. POST/PUT require body field."
        },
        "headers": {
          "type": "object",
          "description": "Optional HTTP headers as key-value pairs. Example: {\"Authorization\": \"Bearer token123\"}"
        },
        "body": {
          "type": "string",
          "description": "Request body for POST/PUT. Must be string (use JSON.stringify for objects). Ignored for GET."
        },
        "timeout": {
          "type": "number",
          "description": "Request timeout in milliseconds. Defaults to 5000ms. Maximum 30000ms."
        }
      },
      "required": ["url"],
      "additionalProperties": false
    },
    "output": {
      "type": "object",
      "properties": {
        "status": {
          "type": "number",
          "description": "HTTP status code. 200-299 = success, 400-499 = client error, 500-599 = server error"
        },
        "headers": {
          "type": "object",
          "description": "Response headers as key-value pairs"
        },
        "bodyRef": {
          "type": "object",
          "description": "BlobPointer reference to response body (used when body exceeds 16KB inline limit). Format: {scheme: 'file'|'https'|'data', path: string, ...}. See RFC-0025.",
          "properties": {
            "scheme": {"type": "string", "enum": ["file", "https", "data"]},
            "path": {"type": "string"},
            "authority": {"type": "string"},
            "query": {"type": "string"},
            "fragment": {"type": "string"}
          },
          "required": ["scheme", "path"]
        }
      },
      "required": ["status"],
      "additionalProperties": false
    }
  },
  "metadata": {"id": "rsp-002", "timestamp": 1735000001000, "causation": "qry-002"}
}
```

---

## Appendix E: Errata & Notes

**Version 0.2 Changes (2025-12-31)**:
- Updated Motivation (Section 2) to emphasize three superpowers: Universal Plain Text Protocol, LLM-as-Microservice, 100% Dynamic Runtime Extensibility
- Changed error payload schema (Section 4.2.6) to HTTP-centric 3-field format: `{code, message, cause?}`
- Reduced line length limit (Section 4.3.2) from 1MB to 16KB with BlobPointer enforcement
- Renamed `Sys.Describe` to `Syscall.Describe` throughout document
- Standardized `Syscall.Describe` response format (Section 4.8) to full JSON Schema with descriptions
- Replaced Error Code Registry (Appendix C) with HTTP-centric error specification
- Updated all examples to use new error format
- Renamed RFC from "Kernel Events Architecture" to "CQRS Event Schema"

---

End of RFC 0024

---
rfc: 0024
title: CQRS Message Schema
author: Huan Li, ChatGPT, GitHub Copilot
status: Draft
type: Standards Track
created: 2025-12-28
updated: 2026-01-02
version: 0.3
tags: [kernel, messages, cqrs, architecture, protocol]
---

# RFC 0024: CQRS Message Schema

## 1. Summary

This RFC defines the message schema and NDJSON protocol for PromptWarẽ ØS reactive kernel. It establishes **OsMessage** as the universal interface between LLM intent (natural language) and deterministic execution (kernel syscalls), enabling a single data model to span both the PromptWare Kernel (Main Thread) and Software Kernel (Worker).

The design adopts CQRS (Command Query Responsibility Segregation) and Message-Driven Architecture principles. It distinguishes between the **envelope** (Message) and the **meaning** (Command, Query, Event, Reply). It uses industry standards (CloudEvents, JSON:API) to create a universal plain-text protocol that enables unprecedented runtime extensibility and LLM-as-microservice architecture.

---

## 2. Motivation

### The Universal Message Model - Three Superpowers

PromptWarẽ ØS adopts a **CQRS message-driven architecture** with plain JSON messages as the universal interface. This design unlocks three transformative capabilities that define the AI-native operating system paradigm:

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
│ int syscall(    │               │  {"kind": ...,  │
│   struct args*) │               │   "data": }     │
└─────────────────┘               └─────────────────┘
        ↓                                  ↓
   Marshaling                        Zero conversion
   Type checking                     Universal format
   ABI constraints                   Language-agnostic
```

**Benefits**:
- ✅ **No type boundaries** - JSON is the universal truth across all system layers
- ✅ **No conversion layers** - Text flows between LLM and code without marshaling
- ✅ **Language-agnostic** - TypeScript, Python, Rust, Go all speak messages equally
- ✅ **Pure data** - JSON-serializable constraint prevents code injection

#### **Superpower 2: LLM-as-Microservice Architecture**

**The Problem**: Traditional systems treat LLMs as external services that require translation layers:
- **LLM output** (natural language) → Parser → Structured commands
- **System output** (typed data) → Formatter → Natural language
- **Impedance mismatch**: Two fundamentally different interfaces

**The Solution**: PromptWare Kernel and Software Kernel speak the same message language.

```
PromptWare Kernel (Main Thread):
  LLM generates: {"kind":"command", "type":"Memory.Set", "data":{...}}
         ↓
    Zero translation layer
         ↓
Software Kernel (Worker):
  Executes handler, returns: {"kind":"reply", "type":"Memory.Set", "data":{...}}
         ↓
    Zero translation layer
         ↓
PromptWare Kernel:
  LLM processes reply message directly
```

**Benefits**:
- ✅ **Bidirectional message flow** - LLM emits messages to software, software emits messages to LLM
- ✅ **No impedance mismatch** - Same data model for intent (LLM) and execution (code)
- ✅ **Cloud-native pattern** - Every subsystem (including the LLM!) is a microservice
- ✅ **Decoupled infrastructure** - Any language, any runtime, any cloud - as long as it speaks NDJSON

**Cognitive Load Reduction**: Instead of learning 11 different syscall APIs × N parameters each, LLMs learn **1 message schema with 5 behavioral kinds** = **91% complexity reduction**.

#### **Superpower 3: 100% Dynamic Runtime Extensibility**

**The Problem**: Traditional operating systems cannot modify their syscall interface at runtime:
- **Compiled syscalls** - Baked into kernel binary, requires rebuild
- **Security boundaries** - Untrusted code cannot register syscalls
- **ABI stability** - Binary compatibility prevents runtime changes

**The Solution**: Message handlers are pure functions that consume/produce JSON - they can come from anywhere.

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

**Scenario 1: PromptWare Kernel Creates New Syscall**
```
1. LLM: "I need a Stripe.Charge syscall"
2. LLM drafts TypeScript handler code
3. LLM emits: {"kind":"command", "type":"Syscall.Register", "data":{code: "..."}}
4. Software Kernel dynamically imports handler (Deno runtime)
5. LLM immediately uses: {"kind":"command", "type":"Stripe.Charge", "data":{...}}
```

**Scenario 2: User Space Application Agent Extension**
```
1. User app needs custom logic: "Analytics.TrackEvent"
2. App agent generates handler code
3. Registers to its own message router
4. Other agents invoke via messages (no kernel modification!)
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
- ✅ **Application-level handlers** - User Space apps can define custom message handlers
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

**Event-driven CQRS with plain JSON messages creates a universal language that:**
1. **Erases boundaries** between LLM (text-native) and software (function-native)
2. **Enables LLM-as-microservice** architecture across all system layers
3. **Allows 100% dynamic runtime extensibility** where the OS writes and registers its own syscalls without limitations

**This is the AI-native OS differentiator** - the system extends itself at runtime through natural language intent, where the boundary between specification and implementation disappears.

---

## 3. Goals & Non-Goals

### Goals

1. **Specify observable message behavior** in a language-agnostic manner
2. **Enable independent implementations** (TypeScript, Python, Rust, Go)
3. **Optimize for LLM comprehension** (JSON, semantic field names, introspectable)
4. **Reduce system complexity** (uniform error handling, single protocol)
5. **Support workflow tracing** (correlation/causation lineage)
6. **Enable runtime extensibility** (dynamic syscall registration)

### Non-Goals

1. **Implementation language**: Specification is language-neutral
2. **Storage backend**: Message persistence is optional (out of scope for v1)
3. **Middleware architecture**: TransformStreams are an implementation detail
4. **Schema versioning**: V1 allows breaking changes (defer to future RFC)
5. **Binary protocols**: NDJSON only (CBOR/MessagePack deferred)

---

## 4. Detailed Design

### 4.1 Message Schema (Normative)

An **OsMessage** is a JSON object with the following structure:

```json
{
  "kind": "<behavioral-kind>",
  "type": "<domain-type>",
  "data": <json-value>,
  "metadata": {
    "id": "<unique-id>",
    "timestamp": <unix-epoch-ms>,
    "correlation": "<workflow-id>",
    "causation": "<parent-message-id>"
  }
}
```

#### 4.1.1 Required Fields

| Field | Type | Description | Requirement |
|-------|------|-------------|-------------|
| `kind` | String (Enum) | Behavioral envelope discriminator | MUST be one of: `command`, `query`, `event`, `reply`, `error` |
| `type` | String | Domain message type in dot notation | MUST match pattern `^[A-Z][a-zA-Z0-9]*\.[A-Z][a-zA-Z0-9]*$` (e.g., `Memory.Set`) |
| `data` | Any | Domain data or error object | MUST be JSON-serializable (no functions, symbols, undefined) |
| `metadata` | Object | Message metadata for tracing | MUST be present and contain required subfields |

#### 4.1.2 Metadata Subfields

| Field | Type | Description | Requirement |
|-------|------|-------------|-------------|
| `metadata.id` | String | Unique message identifier | MUST be present, SHOULD be globally unique (e.g., UUID, shortId) |
| `metadata.timestamp` | Number | Unix epoch milliseconds | MUST be present, MUST be non-negative integer |
| `metadata.correlation` | String | Workflow/session correlation ID | MAY be present, if present MUST be non-empty string |
| `metadata.causation` | String | Direct parent message ID | MAY be present, if present MUST reference a valid message ID |

---

### 4.2 Behavioral Kinds (Normative)

The `kind` field determines the **semantic intent** of the message and imposes behavioral constraints on implementations.

**"kind tells why, type tells what"**

#### 4.2.1 Command (`kind: "command"`)

**Semantics**: "Do this" — A request to mutate observable state.

**Requirements**:
- **MUST** be retriable: Sending the same command twice with the same idempotency key (if supported) MUST produce identical observable effects.
- **SHOULD** be handled asynchronously: Implementations MAY defer execution and return immediately.
- Implementations MUST emit either a `reply` or `error` message as the outcome.

**Examples**: `Memory.Set`, `Http.Fetch`, `Crypto.Seal`

#### 4.2.2 Query (`kind: "query"`)

**Semantics**: "Get this" — A request to retrieve state without mutation.

**Requirements**:
- **MUST NOT** mutate observable state: Sending a query MUST NOT change any data visible to future queries or commands.
- **MUST** be deterministic: Same input + same state → same output.
- Implementations MUST emit either a `reply` or `error` message as the outcome.

**Examples**: `Memory.Get`, `Memory.List`, `Syscall.Describe`

#### 4.2.3 Event (`kind: "event"`)

**Semantics**: "This happened" — An immutable notification of a past occurrence.

**Requirements**:
- **MUST** use past tense or perfect aspect in naming: `Job.Completed`, `File.Created`, `User.Authenticated`.
- **MUST** be immutable: Once emitted, the message's data and metadata MUST NOT change.
- Implementations MAY ignore events (they are notifications, not commands).

**Examples**: `Job.Completed`, `Memory.Synchronized`, `Daemon.Started`

#### 4.2.4 Reply (`kind: "reply"`)

**Semantics**: "Here is the outcome" — The successful result of a command or query.

**Requirements**:
- **MUST** include `metadata.causation`: The ID of the command/query that triggered this reply.
- **SHOULD** use the same `type` as the originating request (e.g., `Memory.Set` command → `Memory.Set` reply).
- `data` contains the success result (specific to each syscall).

**Examples**: Reply to `Memory.Get` with retrieved value, reply to `Crypto.Seal` with ciphertext.

#### 4.2.5 Error (`kind: "error"`)

**Semantics**: "This failed" — The failure outcome of a command or query.

**Requirements**:
- **MUST** include `metadata.causation`: The ID of the command/query that failed.
- **SHOULD** use the same `type` as the originating request.
- `data` **MUST** conform to the HTTP-centric error schema (Section 4.2.6).

#### 4.2.6 Error Data Schema (Normative)

Error message data MUST use the following minimalist HTTP-centric structure:

```typescript
interface ErrorData {
  code: number;           // HTTP status code (400, 403, 404, 422, 500, 502, 504, etc.)
  message: string;        // Human-readable error description with embedded context
  cause?: ErrorData;      // Optional error chaining (ES2022 standard)
}
```

**Field Requirements**:

| Field | Type | Description | Requirement |
|-------|------|-------------|-------------|
| `code` | Number | HTTP status code | MUST be a valid HTTP status code (400-599). See Appendix C for standard codes. |
| `message` | String | Human-readable error description | MUST be present. SHOULD embed contextual details (e.g., "Key not found: /notes/123"). |
| `cause` | ErrorData | Underlying error that caused this error | OPTIONAL. When present, enables error chaining following ES2022 Error.cause semantics. |

**Example - Simple Error**:
```json
{
  "kind": "error",
  "type": "Memory.Get",
  "data": {
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
  "kind": "error",
  "type": "Crypto.Seal",
  "data": {
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
4. **CQRS-aligned** - Message `type` provides operation context, data `code` provides failure reason
5. **ES2022 standard** - `cause` field matches JavaScript Error.cause for error chaining
6. **Contextual messages** - Details embedded naturally: "Key not found: /notes/123" (not separate `details` object)

---

### 4.3 NDJSON Protocol (Normative)

#### 4.3.1 Framing

Messages MUST be transmitted as **Newline Delimited JSON (NDJSON)**:
- Each message is serialized as a single JSON object on one line.
- Lines are terminated with a newline character (`\n`, U+000A).
- Encoding MUST be UTF-8.

**Example**:
```
{"kind":"command","type":"Echo","data":{"message":"hello"},"metadata":{"id":"abc123","timestamp":1735000000000}}
{"kind":"reply","type":"Echo","data":{"echo":"hello"},"metadata":{"id":"def456","timestamp":1735000001000,"causation":"abc123"}}
```

#### 4.3.2 Line Length and Large Data

**Maximum Line Length**: 16,384 bytes (16 KB)

**Enforcement**:
- Individual lines **MUST NOT** exceed 16 KB (16,384 bytes).
- Implementations **MUST** reject lines exceeding this limit by emitting an `error` message with `code: 413` (Payload Too Large), `message: "Message exceeds maximum line length of 16KB"`.
- Implementations **MAY** support larger lines if explicitly configured, but this is NOT RECOMMENDED.

**Rationale for 16 KB Limit**:
- **Token efficiency** - Prompt Kernels are token-expensive; smaller messages enable faster LLM inference
- **Performance** - 16 KB fits comfortably in network MTUs and parser buffers
- **Practical threshold** - Very few syscalls need >16 KB of data in a single message
- **Enforces good architecture** - Large data should use BlobPointer pattern (RFC-0025)

**Large Data Pattern (Normative)**:

When message data would cause the serialized message to exceed 16 KB, implementations **MUST** use the **BlobPointer pattern** defined in RFC-0025:

1. Write large data to storage (Memory, VFS, external service)
2. Include BlobPointer reference in message data
3. Receiver resolves BlobPointer to retrieve data

**Example - Large HTTP Reply**:

❌ **Wrong: Embed large data in message**
```json
{
  "kind": "reply",
  "type": "Http.Fetch",
  "data": {
    "status": 200,
    "body": "<100KB of HTML content...>"
  }
}
```

✅ **Correct: Use BlobPointer (RFC-0025)**
```json
{
  "kind": "reply",
  "type": "Http.Fetch",
  "data": {
    "status": 200,
    "headers": {"content-type": "text/html"},
    "bodyRef": {
      "scheme": "file",
      "path": "/tmp/response-abc123"
    }
  }
}
```

**Design Principle**: Messages are the **control plane** (metadata, commands, status), BlobPointers are the **data plane** (large binary/text content).

**Implementation Detail**: How BlobPointers are created, serialized, and resolved is implementation-specific (see RFC-0025).

#### 4.3.3 Parsing

Implementations MUST handle the following cases:

1. **Valid JSON**: Parse and validate against message schema.
2. **Invalid JSON**: Emit `error` message with `code: 400`, `message: "Invalid JSON: <parse error>"`, continue processing next line.
3. **Schema violation**: Emit `error` message with `code: 422`, `message: "Schema validation failed: <details>"`.
4. **Partial read**: Buffer incomplete lines until newline is received.
5. **Line too long**: Emit `error` message with `code: 413`, `message: "Message exceeds maximum line length of 16KB"`.

**Error Recovery**: Implementations MUST continue processing subsequent lines after encountering invalid input.

---

### 4.4 Message Type Dot Notation (Normative)

#### 4.4.1 Pattern

Message types MUST follow the **Domain.Action** pattern:

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
1. **Namespace clarity**: Domain separates concerns (e.g., all `Memory.*` messages relate to storage)
2. **LLM parseability**: Easier for models to extract intent vs. Unix paths (`memory/get`)
3. **Industry standard**: Matches EventStoreDB, gRPC, Protobuf conventions
4. **Tool support**: Enables autocomplete, schema generation, linting

---

### 4.5 Correlation and Causation Semantics (Normative)

#### 4.5.1 Correlation

**Purpose**: Track all messages belonging to a single workflow, session, or user request.

**Requirements**:
- All messages in a workflow **SHOULD** share the same `metadata.correlation` value.
- The correlation ID **SHOULD** be generated at the workflow entry point (e.g., user request).
- Correlation IDs **SHOULD** persist across syscall boundaries (e.g., `Memory.Get` → `Http.Fetch` → `Crypto.Seal` all share correlation).

**Example Workflow**:
```
Message 1: {type: "Memory.Get", correlation: "user-req-123", causation: null}
Message 2: {type: "Http.Fetch", correlation: "user-req-123", causation: "msg-1-id"}
Message 3: {type: "Crypto.Seal", correlation: "user-req-123", causation: "msg-2-id"}
```

#### 4.5.2 Causation

**Purpose**: Track the **direct parent** message that triggered this message.

**Requirements**:
- Reply and error messages **MUST** set `metadata.causation` to the ID of the originating command/query.
- Chained messages **SHOULD** set `metadata.causation` to the immediate predecessor.
- If a message has no parent (e.g., user-initiated command), `causation` **MAY** be omitted or null.

**Determinism**: Given a message `M` with `causation: "P"`, there MUST exist a prior message with `id: "P"` in the same stream or workflow.

---

### 4.6 Validation Requirements (Normative)

#### 4.6.1 Schema Validation

Implementations MUST validate incoming messages against the schema defined in Section 4.1 before execution.

**Validation Points**:
1. **Structural**: Presence of required fields (`kind`, `type`, `data`, `metadata`)
2. **Type checking**: `kind` is a valid enum value, `timestamp` is a number, etc.
3. **Pattern matching**: `type` matches dot notation regex
4. **Data serialization**: `data` is JSON-serializable (no functions, symbols, undefined)

#### 4.6.2 Validation Failures

When validation fails, implementations MUST:
1. **NOT** execute the handler
2. Emit an `error` message with:
   - `kind: "error"`
   - `type: "Validation.Failed"` (or original message type if parseable)
   - `data.code`: `422` (Unprocessable Entity)
   - `data.message`: Human-readable error description with validation details
   - `metadata.causation`: ID of the invalid message (if available)

**Example Error Message**:
```json
{
  "kind": "error",
  "type": "Validation.Failed",
  "data": {
    "code": 422,
    "message": "Missing required field: kind"
  },
  "metadata": {
    "id": "err-123",
    "timestamp": 1735000002000,
    "causation": "bad-msg-id"
  }
}
```

---

### 4.7 Error Handling (Normative)

#### 4.7.1 Fail-Safe Principle

Implementations MUST treat errors as **messages**, not exceptions:
- Syscall handler errors **MUST NOT** crash the kernel or stream.
- All failures **MUST** result in an `error` kind message being emitted.
- The stream **MUST** continue processing subsequent messages after an error.

#### 4.7.2 Error Message Requirements

Error messages (Section 4.2.5, 4.2.6) MUST include:
- `kind: "error"`
- `type`: Same as the failed command/query (or `"Validation.Failed"` for schema errors)
- `data.code`: HTTP status code (400-599)
- `data.message`: Human-readable error description
- `metadata.causation`: ID of the message that caused the error

Error messages **MAY** include:
- `data.cause`: Nested ErrorData for error chaining

---

### 4.8 Introspection via Syscall.Describe (Informational)

Implementations **SHOULD** provide a `Syscall.Describe` syscall that returns JSON Schema for any registered message type.

**Example Request**:
```json
{
  "kind": "query",
  "type": "Syscall.Describe",
  "data": {"name": "Memory.Set"},
  "metadata": {
    "id": "qry-123",
    "timestamp": 1735000000000
  }
}
```

**Example Reply**:
```json
{
  "kind": "reply",
  "type": "Syscall.Describe",
  "data": {
    "name": "Memory.Set",
    "kind": "command",
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
- **RFC 0016 (Crypto Primitives)**: `Crypto.Seal`, `Crypto.Open`, `Crypto.Derive` use message data for inputs/outputs.
- **RFC 0018 (Kernel Memory)**: `Memory.Get/Set/Delete/List` use CQRS command/query separation.
- **RFC 0023 (Syscall Bridge)**: Inline, client, and daemon modes all transmit messages via NDJSON protocol.
- **RFC 0025 (BlobPointer Serialization)**: Large data (>16KB) use BlobPointer references in message data.

### 5.2 Industry Standards

This RFC aligns with:

- **CloudEvents**: Message envelope structure (`kind`, `data`, `metadata`).
- **EventStoreDB**: Dot notation, causation/correlation lineage.
- **JSON Schema**: Standard schema format for `Syscall.Describe` introspection.
- **JSON:API**: Error response principles (though using simpler HTTP-centric schema).
- **CQRS**: Command/Query behavioral separation.
- **ES2022 (ECMAScript)**: Error.cause for error chaining.

### 5.3 Backward Compatibility

**Breaking Change Policy**: v1.0 prioritizes rapid iteration over stability. This RFC allows breaking changes to the message schema without versioning.

**Future Compatibility**: When schema versioning is needed, a future RFC will define:
- `metadata.schemaVersion` field
- Migration strategies
- Deprecation timelines

---

## 6. Rationale

### 6.1 Why `kind` vs `type`?

**Decision**: Use `kind` for the behavioral discriminator (`command`, `query`, `event`, `reply`) and `type` for the domain identifier (`Memory.Set`).

**Rationale**:
1.  **Mental Model**: "kind tells why, type tells what".
2.  **Clarity**: `type` is often overloaded. Separating `kind` (behavior) from `type` (domain) removes ambiguity.
3.  **AI-First**: LLMs reason better when intent (`kind`) is distinct from topic (`type`).

### 6.2 Why `data` vs `payload`?

**Decision**: Use `data` for the domain content.

**Rationale**:
1.  **Domain Meaning**: `data` implies "what the system reasons about".
2.  **Transport Neutrality**: `payload` implies "what the wire carries" (transport mechanics).
3.  **Simplicity**: `data` is shorter and more direct.

### 6.3 Why `reply` vs `response`?

**Decision**: Use `reply` for the machine message kind.

**Rationale**:
1.  **Layer Separation**: `response` is heavily associated with HTTP/Transport layers (e.g., `Response` object).
2.  **Message Intent**: `reply` clearly indicates a message sent in answer to another message.
3.  **Conflict Avoidance**: Prevents confusion when wrapping an HTTP Response inside a Message.

### 6.4 Why JSON (Not Binary)?

**Decision**: Use JSON for message data, not binary formats (Protobuf, MessagePack, CBOR).

**Rationale**:
1. **LLM-native**: LLMs generate and parse JSON with near-perfect accuracy.
2. **Human-readable**: Developers can inspect messages without decoding tools.
3. **Universal**: Supported by every programming language and platform.
4. **Debuggable**: `console.log`, `stderr`, and shell pipes work out-of-the-box.

**Tradeoff**: JSON is 10-20% larger than binary, but the cognitive clarity justifies the overhead for an AI-native OS.

### 6.5 Why NDJSON (Not JSON-RPC)?

**Decision**: Use NDJSON streaming protocol, not request/response RPC.

**Rationale**:
1. **Streaming-native**: Handle multiple messages in one pipe without buffering.
2. **Fail-safe**: One malformed line doesn't break the stream.
3. **Unix-compatible**: Works with `grep`, `awk`, `jq`, standard shell tools.
4. **Observable**: Each message logged as it flows through the pipeline.

**Alternatives Considered**:
- **JSON-RPC**: Single request/response, no streaming, complex error handling.
- **gRPC**: Binary protocol, not LLM-friendly, requires code generation.
- **GraphQL**: Query language overhead, not event-driven.

### 6.6 Why 5 Message Kinds (Not 3 or 7)?

**Decision**: Use exactly 5 behavioral kinds: `command`, `query`, `event`, `reply`, `error`.

**Rationale**:
- **Minimal CQRS**: `command` + `query` cover state mutation and retrieval.
- **Replies separate**: `reply` + `error` avoid boolean `success` flags.
- **Domain events**: `event` enables pub/sub notifications (future).

### 6.7 Why Correlation AND Causation (Not Just One)?

**Decision**: Include both `correlation` and `causation` in metadata.

**Rationale**:
1. **Correlation** = Workflow ID (all messages in a user request share this)
2. **Causation** = Direct parent ID (this message was caused by parent)
3. **Use case**: Trace entire workflow (`correlation`) OR build message graph (`causation`)

### 6.8 Why Dot Notation (Not Unix Paths)?

**Decision**: Require `Domain.Action` pattern for message types (e.g., `Memory.Set`).

**Rationale**:
1. **Semantic clarity**: Clear namespace separation (`Memory` = domain, `Set` = action).
2. **LLM parseability**: Easier for models to extract intent vs. paths (`memory/set`).
3. **Industry standard**: Matches EventStoreDB, gRPC, Protobuf.
4. **No escaping**: Unix paths require escaping in URLs, dot notation doesn't.

### 6.9 Why 16 KB Line Limit (Not 1 MB)?

**Decision**: Maximum line length of 16 KB, enforce BlobPointer for larger data.

**Rationale**:
1. **Token efficiency**: Prompt Kernels are token-expensive; smaller messages = faster inference
2. **Performance**: 16 KB fits in network MTUs and parser buffers comfortably
3. **Practical threshold**: Very few syscalls need >16 KB in a single message
4. **Architectural clarity**: Separates control plane (messages) from data plane (BlobPointers)

### 6.10 Why HTTP-Centric Error Data (Not Named Errors)?

**Decision**: Use 3-field error data with HTTP status codes, not error class names.

**Rationale**:
1. **HTTP codes are semantic** - 404 = "not found", 403 = "forbidden", 422 = "validation failed" (precise, distinct meanings)
2. **LLM-native** - Models trained on billions of HTTP examples, understand codes intuitively
3. **Minimal tokens** - 3 fields (~15-25 tokens) vs verbose formats (~40+ tokens)
4. **CQRS-aligned** - Message `type` provides operation context, `code` provides failure type
5. **ES2022 standard** - `cause` field matches JavaScript Error.cause

### 6.11 Why Full JSON Schema (Not Zod Strings)?

**Decision**: `Syscall.Describe` returns full JSON Schema, not Zod string syntax.

**Rationale**:
1. **Descriptions critical** - AI-native parameter explanations dominate token cost (schema boilerplate becomes negligible)
2. **Native `description` field** - JSON Schema has built-in description support (no separate object needed)
3. **Standard format** - Language-agnostic, tool-friendly (VS Code, validators)
4. **Pure data** - No executable code in JSON payload (Zod strings would require eval)
5. **Cold-path operation** - Called once per conversation, cached in context (token cost amortized)

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
- No authentication or authorization in the message schema (v1).
- All messages are assumed to originate from trusted sources (LLM co-founder or authorized user).
- Future RFCs MAY add authentication (e.g., `Syscall.Authenticate` in RFC-23).

### 8.2 Data Sanitization

Error messages MUST NOT leak sensitive information:
- `data.message` SHOULD be safe for logging (no passwords, keys, tokens).
- Implementations SHOULD provide a "sanitize" mode that redacts sensitive fields before logging.

### 8.3 Denial of Service

**Line length limit** (Section 4.3.2) mitigates unbounded memory consumption:
- Implementations MUST reject lines >16KB to prevent buffer exhaustion.
- Streaming parsers SHOULD limit buffer size to prevent memory attacks.

### 8.4 Injection Attacks

**JSON-serializable constraint** (Section 4.1.1) prevents code injection:
- `data` MUST NOT contain functions, symbols, or executable code.
- Implementations MUST validate that `JSON.parse(JSON.stringify(data)) === data`.

### 8.5 Dynamic Code Execution

**Runtime syscall registration** (Superpower 3) requires careful implementation:
- Implementations SHOULD validate handler code does not escape sandbox (Deno permissions model)
- Implementations SHOULD rate-limit registration to prevent DoS via infinite syscall creation
- Under trust-maximal model, LLM-generated code is trusted (no sandboxing required)

---

## 9. Implementation Plan

### 9.1 Reference Implementation

**Language**: TypeScript (Deno runtime)
**Location**: `os/kernel/messages.ts`, `os/kernel/streams/router.ts`

**Key Components**:
1. **Zod Schema**: Runtime validation of `OsMessageSchema` (single source of truth)
2. **createMessage()**: Helper to construct valid messages
3. **createError()**: Helper to construct HTTP-centric error messages with causation
4. **routerStream**: TransformStream that dispatches messages to handlers

### 9.2 Test Coverage

**Test Suite**: 47+ unit tests across 11+ syscalls validate conformance.

**Test Categories**:
1. **Schema validation**: Missing fields, invalid types, malformed names
2. **CQRS separation**: Commands mutate state, queries do not
3. **Error handling**: Handlers emit error messages, not exceptions (HTTP-centric data)
4. **Tracing**: Correlation/causation IDs propagate correctly
5. **NDJSON parsing**: Malformed JSON, partial lines, large data (>16KB)
6. **BlobPointer enforcement**: Large data use references, not inline data

### 9.3 Migration

**Existing Code**: All syscalls refactored to comply with this RFC (January 2026).

**Breaking Changes from v0.2**:
1. `type` renamed to `kind`
2. `name` renamed to `type`
3. `payload` renamed to `data`
4. `response` kind renamed to `reply`
5. `OsEvent` renamed to `OsMessage`

**Migration Strategy**:
- Update error creation helpers to use HTTP-centric schema
- Add line length validation with 16KB limit
- Implement BlobPointer support for large data
- Update introspection to return JSON Schema with descriptions

---

## 10. Future Directions

### 10.1 Message Persistence (Optional)

Future implementations MAY add message store for audit/replay:
- Store all messages to Deno KV with prefix `/messages/{timestamp}-{id}`
- Index by `correlation` for workflow replay
- Expose `Message.Replay` syscall for time-travel debugging

**Status**: Deferred to future RFC (not required for v1).

### 10.2 Schema Versioning

When breaking changes are needed, define:
- `metadata.schemaVersion` field
- Versioning strategy (semantic versioning, API deprecation)
- Migration tooling (auto-convert old messages to new schema)

**Status**: Deferred until first breaking change needed.

### 10.3 Idempotency Keys for Command Deduplication

**Concept**: Add optional `idempotencyKey` field to message metadata to prevent duplicate command execution.

**Mechanism**:
- Client sends command with same `idempotencyKey` twice
- Kernel caches reply for configurable TTL (e.g., 24 hours)
- Subsequent requests return cached reply without re-execution
- Only applies to `command` kind messages (queries always execute)

**Example Message**:
```json
{
  "kind": "command",
  "type": "Memory.Set",
  "data": {"key": "/cart/123", "value": "..."},
  "metadata": {
    "id": "msg-123",
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

**New Message Types**:
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

**New Message Type**:
- `Syscall.Register` (command)
  - Input: `{name: string, kind: "command"|"query", code: string, inputSchema: object, outputSchema: object}`
  - Output: `{registered: boolean, name: string}`

**Mechanism**:
1. LLM generates TypeScript handler code
2. Kernel validates code exports `InputSchema`, `OutputSchema`, `handler`
3. Dynamically imports module via Deno's `import("data:text/typescript,...")`
4. Adds to message router; new syscall immediately available
5. `Syscall.Describe` can introspect registered syscalls

**Use Cases**:
- LLM creates domain-specific operations (`Stripe.Charge`, `Slack.PostMessage`)
- User Space applications define custom message handlers
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
- [RFC 0018: Kernel Memory Subsystem](0018-kernel-memory-subsystem.md)
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

- **OsMessage**: The atomic unit of communication in PromptWarẽ ØS kernel.
- **NDJSON**: Newline Delimited JSON, a streaming protocol where each line is a JSON object.
- **CQRS**: Command Query Responsibility Segregation, a pattern separating read and write operations.
- **Correlation**: A workflow identifier shared by all messages in a logical sequence.
- **Causation**: The ID of the direct parent message that triggered the current message.
- **Dot Notation**: Message naming pattern `Domain.Action` (e.g., `Memory.Set`).
- **Behavioral Envelope**: The `kind` field categorizing message intent (command/query/event/reply/error).
- **BlobPointer**: Reference to external large data (RFC-0025), used when message data would exceed 16KB.

---

## Appendix B: Examples

### Example 1: Simple Query

**Request**:
```json
{"kind":"query","type":"Memory.Get","data":{"key":"/notes/1"},"metadata":{"id":"msg-123","timestamp":1735000000000}}
```

**Reply**:
```json
{"kind":"reply","type":"Memory.Get","data":"Note content here","metadata":{"id":"msg-456","timestamp":1735000001000,"causation":"msg-123"}}
```

### Example 2: Command with Error

**Request**:
```json
{"kind":"command","type":"Crypto.Seal","data":{"plaintext":"secret","key":"invalid"},"metadata":{"id":"msg-789","timestamp":1735000002000}}
```

**Error**:
```json
{"kind":"error","type":"Crypto.Seal","data":{"code":400,"message":"Invalid encryption key format"},"metadata":{"id":"msg-999","timestamp":1735000003000,"causation":"msg-789"}}
```

### Example 3: Workflow with Correlation

**Message 1** (User request):
```json
{"kind":"command","type":"Memory.Get","data":{"key":"/api/token"},"metadata":{"id":"msg-001","timestamp":1735000000000,"correlation":"workflow-abc"}}
```

**Message 2** (Reply):
```json
{"kind":"reply","type":"Memory.Get","data":"token123","metadata":{"id":"msg-002","timestamp":1735000001000,"correlation":"workflow-abc","causation":"msg-001"}}
```

**Message 3** (Chained command):
```json
{"kind":"command","type":"Http.Fetch","data":{"url":"https://api.example.com","headers":{"Authorization":"Bearer token123"}},"metadata":{"id":"msg-003","timestamp":1735000002000,"correlation":"workflow-abc","causation":"msg-002"}}
```

**Message 4** (Final reply):
```json
{"kind":"reply","type":"Http.Fetch","data":{"status":200,"body":"..."},"metadata":{"id":"msg-004","timestamp":1735000005000,"correlation":"workflow-abc","causation":"msg-003"}}
```

All messages share `correlation: "workflow-abc"`, enabling full workflow tracing.

### Example 4: Error Chaining

**Request**:
```json
{"kind":"command","type":"Crypto.Seal","data":{"plaintext":"secret"},"metadata":{"id":"msg-100","timestamp":1735000000000}}
```

**Error with Cause**:
```json
{
  "kind":"error",
  "type":"Crypto.Seal",
  "data":{
    "code":500,
    "message":"Encryption failed",
    "cause":{
      "code":404,
      "message":"Encryption key not found in vault: /keys/master"
    }
  },
  "metadata":{"id":"msg-101","timestamp":1735000001000,"causation":"msg-100"}
}
```

### Example 5: Large Data with BlobPointer

**Request** (HTTP fetch returns 100KB HTML):
```json
{"kind":"command","type":"Http.Fetch","data":{"url":"https://example.com"},"metadata":{"id":"msg-200","timestamp":1735000000000}}
```

**Reply** (using BlobPointer per RFC-0025):
```json
{
  "kind":"reply",
  "type":"Http.Fetch",
  "data":{
    "status":200,
    "headers":{"content-type":"text/html"},
    "bodyRef":{
      "scheme":"file",
      "path":"/tmp/fetch-response-200"
    }
  },
  "metadata":{"id":"msg-201","timestamp":1735000002000,"causation":"msg-200"}
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
| 400 | Bad Request | Malformed input, invalid syntax | Invalid JSON in data |
| 403 | Forbidden | Operation not allowed (permissions, read-only namespace) | Write to `proc/*` (read-only) |
| 404 | Not Found | Resource/key does not exist | `Memory.Get` for non-existent key |
| 422 | Unprocessable Entity | Valid syntax but semantically invalid | `vault/*` value not pwenc format |

**5xx - Server Errors (Fatal)**

| Code | Standard Name | Typical Meaning in PromptWarẽ ØS | Example |
|------|---------------|----------------------------------|---------|
| 500 | Internal Server Error | Unexpected handler failure, system crash | Uncaught exception in syscall handler |
| 502 | Bad Gateway | Upstream service failure | VFS fetch failed (network error, upstream 404) |
| 504 | Gateway Timeout | Upstream service timeout | HTTP fetch exceeded timeout |

### Error Data Format

All error messages MUST use this data structure:

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
  "kind": "query",
  "type": "Syscall.Describe",
  "data": {"name": "Echo"},
  "metadata": {"id": "qry-001", "timestamp": 1735000000000}
}
```

**Reply**:
```json
{
  "kind": "reply",
  "type": "Syscall.Describe",
  "data": {
    "name": "Echo",
    "kind": "command",
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
  "kind": "query",
  "type": "Syscall.Describe",
  "data": {"name": "Http.Fetch"},
  "metadata": {"id": "qry-002", "timestamp": 1735000000000}
}
```

**Reply**:
```json
{
  "kind": "reply",
  "type": "Syscall.Describe",
  "data": {
    "name": "Http.Fetch",
    "kind": "command",
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

**Version 0.3 Changes (2026-01-02)**:
- **Schema Restructuring**:
    - `type` → `kind` (Discriminator: `command`, `query`, `event`, `reply`, `error`)
    - `name` → `type` (Domain identifier: `Memory.Set`)
    - `payload` → `data` (Domain meaning)
    - `response` → `reply` (Enum value change)
- **Terminology**:
    - `OsEvent` → `OsMessage`
    - "Event" → "Message" (where appropriate)
- **Rationale**: Added Section 6.1, 6.2, 6.3 to explain naming choices.
- **Examples**: Updated all JSON examples to reflect new schema.

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

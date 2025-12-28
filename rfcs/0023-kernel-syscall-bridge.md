---
rfc: 0023
title: Dual-Mode Syscall Bridge Specification
author: PromptWare OS Project
status: Draft
type: Standards Track
created: 2025-12-28
updated: 2025-12-28
version: 1.0
tags: [kernel, syscall, ipc, daemon, unix-socket]
---

# RFC 0023: Dual-Mode Syscall Bridge Specification

## 1. Summary

This RFC specifies a **dual-mode syscall bridge** for PromptWare OS: a single Deno TypeScript entrypoint that runs as a **client (CLI)** by default and transparently spawns a **daemon (server)** on-demand. The client and daemon communicate via a **Unix domain socket** using **NDJSON** frames carrying `OsEvent` envelopes (CQRS-style).

The design goal is to provide a **syscall singularity interface** between the Prompt Kernel and the Software Kernel: a uniform, stream-oriented mechanism for submitting syscall events and receiving responses/events without external service configuration.

---

## 2. Motivation

PromptWare OS bridges two worlds:

* **Prompt Kernel (Ring 0):** Natural language intent, high-level orchestration.
* **Software Kernel (Ring 1):** Deterministic execution via TypeScript syscalls.

A recurring need is a **single, robust execution bridge** that:

1. Works as a CLI (invoked repeatedly), but can maintain long-lived runtime context in a daemon.
2. Requires **no external configuration** (no systemd/launchd requirement for MVP).
3. Uses a **stream-native** interface so both kernels can treat syscalls as pipelines.
4. Provides clear failure modes when a syscall/event is unsupported.

This RFC delivers that bridge.

---

## 3. Goals & Non-Goals

### Goals

The bridge MUST:

* Provide a **single entrypoint** with two roles:
  * **Client mode** (default)
  * **Daemon mode** (internal; spawned by client)
* Provide **transparent bootstrap**:
  * client attempts socket connection
  * if unavailable, client spawns daemon (detached)
  * client retries until connected or fails fast
* Use **Unix domain sockets** on macOS and Linux.
* Use **NDJSON** framing with a standard `OsEvent` envelope.
* Validate every incoming message using `OsEventSchema`.
* Support **streaming dispatch**: process events line-by-line, emit outputs, flush, repeat.
* Treat **missing handlers** as a first-class error (emit `error`, continue processing).
* Exchange a **mandatory connection prologue** (`Syscall.Authenticate`) as the first server→client message on every new connection.
  * Authentication is **optional** by configuration: if no SSH public key is configured, the bridge operates in **open mode**, but the prologue MUST still be exchanged.
* Provide a **manual shutdown command** (`Syscall.Shutdown`).

### Non-Goals

This RFC does NOT specify:

* Business domain logic (job models, schedulers, provider adapters, etc.).
* Durable persistence (KV/SQLite/files) for daemon state.
* Subscription channels / pubsub fanout semantics.
* Cross-platform support beyond macOS and Linux.
* Binary distribution (`deno compile`) or installer packaging.

---

## 4. Detailed Design

### 4.1 Terminology

* **Bridge:** The overall client+daemon framework.
* **Client:** The default CLI role; connects to the daemon and streams events.
* **Daemon:** The server role; listens on a Unix socket, dispatches events to handlers.
* **Handler:** A registered syscall implementation as a `TransformStream<OsEvent, OsEvent>`.
* **NDJSON:** Newline-delimited JSON, one object per line.
* **EOF:** End-of-input on the connection (client half-closes write end).

The key words **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**, and **MAY** are to be interpreted as described in BCP 14.

### 4.2 Protocol

#### 4.2.1 Envelope: `OsEvent`

All messages MUST conform to the following schema (Zod representation):

```typescript
export const OsEventSchema = z.object({
  type: z
    .enum(["command", "query", "event", "response", "error"])
    .describe("Behavioral envelope type"),
  name: z.string().describe("Domain event name (e.g. Memory.Set)"),
  payload: z.unknown().describe("Data payload or error object"),
  metadata: z
    .object({
      id: z.string().describe("Unique event ID"),
      timestamp: z.number().describe("Unix epoch ms"),
      correlation: z.string().optional().describe("Workflow/session ID"),
      causation: z.string().optional().describe("Direct parent event ID"),
    })
    .optional()
    .describe("Event metadata for routing and lineage"),
});
```

#### 4.2.2 Framing: NDJSON

* The transport format MUST be **NDJSON**.
* Each line MUST contain a single JSON object that parses into an `OsEvent`.
* Lines MUST be UTF-8.
* Each frame MUST be terminated by `\n`.

#### 4.2.3 Streaming Semantics

For each client connection:

* The daemon MUST read input frames until **EOF**.
* The daemon MUST process frames **in order**, **one line at a time**.
* For each valid input event:
  * the daemon MUST dispatch it immediately (streaming)
  * the daemon MUST write any output events produced by the handler
  * the daemon MUST flush output before reading the next input line
* After EOF is reached, the daemon MUST close the connection once all pending output is flushed.

#### 4.2.4 Metadata Responsibility

* The bridge framework MUST NOT automatically create or modify metadata.
* Correlation/causation assignment is left to handler implementations.

#### 4.2.5 Connection Prologue: Optional Authentication

On every new client connection, the daemon MUST send the first frame to the client:

* `type: "command"`
* `name: "Syscall.Authenticate"`

The client MUST read this first frame and MUST send a corresponding `response` before the daemon will accept and process subsequent frames.

The daemon MAY be configured with an SSH public key (loading location is implementation-defined). If an SSH public key is configured, the daemon MUST require signature verification. If no SSH public key is configured, the daemon MUST operate in **open mode**.

Open mode is signaled by an authentication payload with `scheme: "none"`.

Signature mode is signaled by an authentication payload with `scheme: "signature"` and a challenge suitable for signing.

If signature verification fails, the daemon MUST close the connection immediately.

### 4.3 Reserved Syscall Names

#### 4.3.1 `Syscall.Authenticate`

**Purpose:** mandatory connection prologue; optional authentication by configuration.

* Daemon MUST send `Syscall.Authenticate` as the first frame on every new connection:
  * `type: "command"`
  * `name: "Syscall.Authenticate"`
* Client MUST respond before any other client-originated frames are processed:
  * `type: "response"`
  * `name: "Syscall.Authenticate"`

The daemon authentication `payload` MUST include a `scheme` field.

**Open mode (no SSH public key configured):**

```json
{"scheme":"none"}
```

In open mode, the client MUST still send a response (payload MAY be empty).

**Signature mode (SSH public key configured):**

```json
{"scheme":"signature","challenge":"<base64>"}
```

In signature mode, the client response payload MUST include a signature over the provided challenge. The signing mechanism and key access are implementation-defined. The server MUST verify the signature using the configured SSH public key.

If verification fails, the daemon MUST close the connection immediately. If verification succeeds, the daemon MUST continue processing subsequent frames.

#### 4.3.2 `Syscall.Shutdown`

**Purpose:** manual daemon shutdown.

* Client MAY send a `command` named `Syscall.Shutdown`.
* Daemon SHOULD:
  * stop accepting new connections,
  * finish processing current input frames,
  * flush outputs,
  * close active connections,
  * remove the socket file,
  * exit.

Authorization relies on Unix socket directory permissions (see Security Considerations).

### 4.4 Architecture

#### 4.4.1 Process Roles

**Client (default)**

The client is responsible for:

* Computing the Unix socket path (deterministic, no external config).
* Connecting to the daemon.
* Spawning the daemon if not reachable.
* Streaming input events to the daemon.
* Half-closing the write end to signal EOF.
* Streaming daemon output to the client stdout.
* Exiting only when the daemon closes the connection.

**Daemon (`--mode=daemon`)**

The daemon is responsible for:

* Creating/ensuring a private runtime directory.
* Binding a Unix domain socket and accepting connections.
* Performing NDJSON decode + schema validation.
* Dispatching events to registered handlers.
* Emitting errors for invalid or unsupported events.
* Running indefinitely until killed or `Syscall.Shutdown` is received.

#### 4.4.2 Stream-First Data Plane

All IO SHOULD be modeled as pipes:

* Client: `ReadableStream<OsEvent>` → `TransformStream<OsEvent, bytes>` → socket write
* Client: socket read → `TransformStream<bytes, OsEvent>` → stdout (NDJSON)
* Daemon: socket read → decode → validate → dispatch → encode → socket write

Handlers MUST be expressed as:

```typescript
TransformStream<OsEvent, OsEvent>
```

#### 4.4.3 Dispatch Registry

The daemon maintains a registry of handlers.

* Keys SHOULD be based on `OsEvent.name`.
* Implementations MAY also key on `type` if needed.

**Unsupported request rule:**

* If an input `OsEvent` is valid but no handler is registered for it, the daemon MUST emit an `error` OsEvent indicating the request is unsupported, then continue processing subsequent input events.

### 4.5 Lifecycle Algorithms

#### 4.5.1 Socket Path Computation

The socket path MUST be deterministic and require no user configuration.

Recommended order:

1. If `$XDG_RUNTIME_DIR` is set, use it.
2. Else if `$TMPDIR` is set, use it.
3. Else use `/tmp`.

The bridge MUST create a private directory (mode `0700`) under the chosen base directory, and place the socket file inside it.

#### 4.5.2 Client Bootstrap (Connect → Spawn → Retry)

Client MUST:

1. Compute `sockPath`.
2. Attempt to connect.
3. If connect fails:
   * Spawn daemon (detached), then retry connect with bounded exponential backoff.
4. Once connected:
   * Read the first server frame (`Syscall.Authenticate`).
   * Send the required `response` frame.
   * Only then begin streaming any subsequent client-originated events.

If the client cannot connect within the timeout window, it MUST exit with an error.

#### 4.5.3 Daemon Single-Instance & Stale Socket Cleanup

Daemon startup MUST:

1. Ensure private runtime directory exists (`0700`).
2. If socket path exists:
   * Attempt to connect.
   * Attempt to read the first server→client frame within a short timeout window.
   * If a valid `OsEvent` is received and its `name` is `Syscall.Authenticate`, another daemon is running; the new daemon MUST exit.
   * Otherwise, treat as stale: remove the socket file and continue.
3. Bind and listen on the socket.

#### 4.5.4 Per-Connection Processing Loop

For each connection, the daemon MUST:

1. **Send prologue:** write one NDJSON frame `Syscall.Authenticate`, then flush.
2. **Read auth response:** read client frames until it receives a valid `response` for `Syscall.Authenticate` or until EOF.
   * Invalid frames during this phase MUST result in `error` output and continued reading.
   * If EOF occurs before a valid authentication response, the daemon MUST close the connection.
   * If signature verification is required and fails, the daemon MUST close the connection immediately.
3. **Process batch:** after successful authentication (or open-mode response), process the remaining frames in a streaming loop until EOF:

```
while not EOF:
  read one NDJSON line
  parse JSON; validate with OsEventSchema
  invalid -> emit error; continue
  missing handler -> emit error; continue
  dispatch valid event immediately (streaming)
  get response event(s) from handler stream
  write event(s), flush
repeat
close connection when EOF reached and pending outputs flushed
```

### 4.6 Error Handling

#### 4.6.1 Invalid Frames

* If a line cannot be parsed as JSON, daemon MUST emit an `error` event and continue.
* If JSON parses but fails `OsEventSchema`, daemon MUST emit an `error` event and continue.

#### 4.6.2 Unsupported Events

If an `OsEvent` is valid but unsupported (no handler), daemon MUST emit an `error` event indicating:

* `name` is unsupported
* expected registration/action: "register a handler and retry"

Daemon MUST continue processing subsequent events.

#### 4.6.3 Client Exit Status

* The client MUST wait for server close.
* The client SHOULD exit non-zero if any `error` events were observed on the stream.

---

## 5. Compatibility

This RFC aligns with:

* **RFC 0022 (STOP Protocol)**: Uses semantic field names in OsEvent schema
* **Kernel Events Architecture**: Uses the standardized OsEvent envelope from `os/kernel/events.ts`

This RFC introduces a new transport layer (Unix socket + daemon) but maintains full compatibility with the existing event schema and CQRS semantics.

**Migration Path**: Existing direct CLI invocations will continue to work. The daemon mode is opt-in via the transparent bootstrap mechanism.

---

## 6. Rationale

* **Unix socket + NDJSON** provides a minimal, debuggable, composable local IPC.
* **Dual-mode single entrypoint** removes operational friction for early PromptWare OS workflows.
* **Stream-first** aligns with Deno primitives and enables syscall pipelines.
* **Auth-prologue liveness detection** is stronger than connect-only checks while remaining minimal.
* **Explicit unsupported error** encourages syscall registration and iterative system growth.

---

## 7. Alternatives Considered

1. **HTTP/REST API**: More complex, requires port management, CORS, etc. Unix sockets are simpler for local IPC.

2. **MessagePack/Protobuf**: Would add binary encoding complexity. NDJSON is human-readable, debuggable with standard Unix tools.

3. **Systemd/Launchd Integration**: Adds external dependencies. Self-bootstrapping daemon requires no system configuration.

4. **Named Pipes (FIFOs)**: Less flexible than Unix sockets for bidirectional streaming.

5. **gRPC**: Too heavyweight for local IPC, requires code generation, harder to debug.

---

## 8. Security Considerations

* The runtime directory containing the socket MUST be created with permissions `0700`.
* The socket path MUST be located inside that directory.
* For URL-based invocation, the bridge MUST allow only `https:` URLs.
* For determinism, URL-based invocations SHOULD be pinned (tag/commit/checksum) by the caller.
* Optional SSH signature authentication provides cryptographic verification when needed.
* Open mode (no authentication) is acceptable for single-user development environments.

---

## 9. Implementation Plan

### Phase 1: Core Bridge
- [ ] Implement client mode with socket connection logic
- [ ] Implement daemon mode with Unix socket listener
- [ ] Implement NDJSON framing (encode/decode streams)
- [ ] Implement OsEvent validation
- [ ] Implement transparent daemon spawn on client startup

### Phase 2: Protocol
- [ ] Implement `Syscall.Authenticate` prologue exchange
- [ ] Implement open mode (scheme: "none")
- [ ] Implement handler registry and dispatch
- [ ] Implement `Syscall.Shutdown` handler

### Phase 3: Hardening
- [ ] Implement stale socket detection (auth-prologue liveness)
- [ ] Implement error handling (invalid frames, unsupported events)
- [ ] Add daemon logging
- [ ] Add integration tests

### Phase 4: Optional Authentication
- [ ] Implement signature mode (scheme: "signature")
- [ ] SSH public key loading
- [ ] Challenge generation and verification

---

## 10. Future Directions

Future RFCs MAY introduce:

* Subscription/event-bus semantics
* Durable persistence for daemon state
* Protocol versioning and handshake negotiation
* Alternative transports (TCP, WebSocket)
* **Bidirectional request initiation**, where the daemon may emit `command` or `query` frames for which responses may arrive in later client sessions (deferred responses).

For deferred responses, implementations SHOULD use `metadata.causation` to reference the originating request `metadata.id`.

---

## 11. Unresolved Questions

* Exact socket directory naming scheme (app name, uid, collision strategy).
* Exact error payload structure for parse/validation/unsupported.
* Exact authentication challenge format and signature encoding.
* How deferred responses are stored/routed across CLI sessions (implementation detail; out of scope).

---

## 12. References

### PromptWare OS References

* [RFC 0022: Semantic Token Optimization Protocol](0022-semantic-token-optimization-protocol.md)
* [RFC 0015: Kernel Core Architecture](0015-kernel-core-arch.md)
* [RFC 0019: Kernel ABI Syscall Specification](0019-kernel-abi-syscall.md)

### External References

* [RFC 2119: Key words for use in RFCs to Indicate Requirement Levels](https://www.rfc-editor.org/rfc/rfc2119)
* [NDJSON Specification](http://ndjson.org/)
* [Unix Domain Sockets](https://en.wikipedia.org/wiki/Unix_domain_socket)

---

## Appendix A: Reference Implementation Notes (Non-Normative)

* Client and daemon can be implemented with Deno's unix socket support (`transport: "unix"`).
* Framing can use line readers/writers, backed by `TextEncoderStream` / `TextDecoderStream` and custom NDJSON transforms.
* Zod validation should be applied per message; a future fast-path may skip it under controlled flags.

---

## Appendix: Errata & Notes

None.

---

End of RFC 0023

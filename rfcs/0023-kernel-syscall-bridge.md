---
rfc: 0023
title: Dual-Mode Syscall Bridge (OsEvent Singularity)
author: PromptWare OS Project
status: Draft
type: Standards Track
created: 2025-12-28
updated: 2025-12-29
version: 1.1
tags: [kernel, syscall, ipc, daemon, unix-socket, inline, origin]
---

# RFC 0023: Dual-Mode Syscall Bridge (OsEvent Singularity)

## 1. Summary

This RFC defines a **syscall singularity interface** for PromptWare OS: a single Deno TypeScript entrypoint that implements the **W3C Web Worker** messaging protocol over a Unix domain socket.

*   **Prompt Kernel (Main Thread)**: The CLI client that spawns and controls the worker.
*   **Software Kernel (Worker Thread)**: The daemon that executes syscalls in the background.
*   **Syscall Bridge (MessagePort)**: The bidirectional NDJSON transport layer.

The bridge uses **NDJSON** as its wire format and a common `OsEvent` envelope to unify CQRS-style commands, queries, responses, and errors. A **mandatory first-message prologue** (`Syscall.Authenticate`) is exchanged on every connection to support optional SSH public-key signature authentication (or open mode).

---

## 2. Motivation

PromptWare OS aims to maximize the Linux analogy while operating in an LLM-native environment. The architecture needs a syscall layer that:

*   **Aligns with W3C Standards**: Uses `postMessage` and `onmessage` semantics familiar to all JS/TS developers and AI models.
*   **Is Stream-Native**: Pipes in/out, easy composition.
*   **Is Operationally Frictionless**: No external service manager required; self-bootstrapping.
*   **Is Explicit**: Clear separation between the "Intent" (Prompt Kernel) and the "Execution" (Software Kernel).

This RFC specifies the minimal robust bridge framework, excluding domain/business logic.

---

## 3. Goals & Non-Goals

### Goals

The bridge MUST:

1.  Implement the **W3C Worker Interface** semantics:
    *   **Main Thread**: `worker.postMessage()` / `worker.onmessage`
    *   **Worker Thread**: `self.postMessage()` / `self.onmessage`
2.  Provide a **single entrypoint** with multiple modes:
    *   **Client mode** (Main Thread Proxy)
    *   **Daemon mode** (Worker Host)
    *   **Inline mode** (In-process Worker)
3.  Use **Unix domain sockets** for the transport layer (MessagePort).
4.  Use **NDJSON** framing and validate every message using `OsEventSchema`.
5.  Enforce a **mandatory connection prologue** (`Syscall.Authenticate`).

### Non-Goals

This RFC does NOT specify:

*   Domain/business syscalls (job models, scheduling).
*   Durable state storage (KV/SQLite).
*   Cross-platform support beyond macOS and Linux.

---

## 4. Detailed Design

### 4.1 Conformance Language

The key words **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**, and **MAY** are to be interpreted as described in BCP 14.

### 4.2 Terminology & Architecture

We adopt the **W3C Web Worker** terminology to describe the system components, creating a "Rosetta Stone" mapping between Linux concepts and Web concepts.

| PromptWare Concept | Web Standard (W3C) | Linux Implementation |
| :--- | :--- | :--- |
| **Prompt Kernel** | **Main Thread** | CLI Client (`client.ts`) |
| **Software Kernel** | **Worker Thread** | Daemon Process (`daemon.ts`) |
| **Syscall Transport** | **MessageChannel** | Unix Domain Socket |

*   **Main Thread (Prompt Kernel)**: The Client/CLI. It represents the "User" or "Orchestrator".
*   **Worker Thread (Software Kernel)**: The Daemon. It represents the "Service" or "Execution Context".
*   **MessageChannel (Transport)**: The Unix Socket connection carrying NDJSON frames.

### 4.3 The Bridge Interface

The interface is defined from two distinct perspectives: the **Host** (Main Thread) and the **Guest** (Worker Thread).

#### 4.3.1 Host Interface (Prompt Kernel Perspective)
*Context: The CLI Client (`client.ts`)*

The Host holds a reference to the Worker (the `worker` object).

*   **`worker.postMessage(msg, transfer)`**:
    *   **Action**: Serializes `msg` to NDJSON and writes to the socket.
    *   **Direction**: Main Thread $\to$ Worker Thread.
    *   **Semantics**: "I am sending a command to the kernel."
*   **`worker.onmessage(handler)`**:
    *   **Action**: Reads NDJSON from the socket, deserializes, and invokes `handler`.
    *   **Direction**: Worker Thread $\to$ Main Thread.
    *   **Semantics**: "The kernel sent me a response."

#### 4.3.2 Guest Interface (Software Kernel Perspective)
*Context: The Daemon (`daemon.ts`)*

The Guest runs inside the Worker Global Scope (`self`).

*   **`self.onmessage(handler)`**:
    *   **Action**: Reads NDJSON from the socket, deserializes, and invokes `handler` (The Dispatcher).
    *   **Direction**: Main Thread $\to$ Worker Thread.
    *   **Semantics**: "I received a command from the user."
*   **`self.postMessage(msg)`**:
    *   **Action**: Serializes `msg` to NDJSON and writes to the socket.
    *   **Direction**: Worker Thread $\to$ Main Thread.
    *   **Semantics**: "I am sending a result back to the user."

### 4.4 Data Model: `OsEvent`

All frames MUST parse into the following schema (Zod representation):

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

#### 4.3.1 Metadata Policy

* The bridge framework MUST NOT automatically create, modify, or infer metadata.
* Correlation/causation conventions are implementation-defined.

### 4.4 Wire Format: NDJSON

* The transport format MUST be **NDJSON**.
* Each line MUST contain exactly one JSON object.
* Lines MUST be UTF-8.
* Each frame MUST be terminated by `\n`.

### 4.5 Protocol Semantics

#### 4.5.1 Streaming Dispatch

For each client connection:

* The daemon MUST read input frames until **EOF**.
* The daemon MUST process frames **in order**, **one line at a time**.
* For each valid input event:
  * the daemon MUST dispatch it immediately (streaming)
  * the daemon MUST write any output events produced by the handler
  * the daemon MUST flush output before reading the next input line
* After EOF is reached, the daemon MUST close the connection once all pending output is flushed.

#### 4.5.2 Connection Prologue: Optional Authentication

On every new client connection, the daemon MUST send the first frame to the client:

* `type: "command"`
* `name: "Syscall.Authenticate"`

The client MUST read this first frame and MUST send a corresponding `response` before the daemon will accept and process subsequent frames.

The daemon MAY be configured with an SSH public key (loading location is implementation-defined). If an SSH public key is configured, the daemon MUST require signature verification. If no SSH public key is configured, the daemon MUST operate in **open mode**.

Open mode is signaled by an authentication payload with `scheme: "none"`.

Signature mode is signaled by an authentication payload with `scheme: "signature"` and a challenge suitable for signing.

If signature verification fails, the daemon MUST close the connection immediately.

### 4.6 Reserved Syscall Events

The following events are reserved by the bridge framework.

#### 4.6.1 Syscall.Authenticate (Mandatory Prologue)

Mandatory connection prologue; optional authentication by configuration.

*   **Topic**: `Syscall.Authenticate`
*   **Type**: `command` (Sent by Daemon to Client)
*   **Data Schema (Daemon Request)**:
    ```json
    {
      "scheme": "string ('none' | 'signature')",
      "challenge": "string (Optional base64 challenge for signature scheme)"
    }
    ```
*   **Success Event**: `type: "response"` (Sent by Client to Daemon)
    ```json
    {
      "signature": "string (Optional base64 signature if scheme='signature')"
    }
    ```
*   **Error Event**: `type: "error"` (Connection closed immediately)

**Behavior**:
1.  Daemon sends `Syscall.Authenticate` as the first frame.
2.  Client MUST respond with a valid `response` event.
3.  If verification fails, Daemon closes connection.

#### 4.6.2 Syscall.Shutdown

Manual daemon shutdown.

*   **Topic**: `Syscall.Shutdown`
*   **Type**: `command`
*   **Data Schema**: `{}` (Empty)
*   **Success Event**: `type: "response"`
    ```json
    {
      "success": true
    }
    ```
*   **Error Event**: `type: "error"`

**Behavior**:
1.  Daemon stops accepting new connections.
2.  Flushes pending outputs.
3.  Closes active connections and exits.

### 4.5 Architecture

#### 4.5.1 Process Roles

**Main Thread Proxy (Client Mode)**

The client is responsible for:

* Computing the Unix socket path (deterministic, no external config).
* Connecting to the daemon.
* Spawning the daemon if not reachable.
* Streaming input events to the daemon.
* Half-closing the write end to signal EOF.
* Streaming daemon output to the client stdout.
* Exiting only when the daemon closes the connection.

**Worker Host (Daemon Mode)** (`--mode=daemon`)

The daemon is responsible for:

* Creating/ensuring a private runtime directory.
* Binding a Unix domain socket and accepting connections.
* Performing NDJSON decode + schema validation.
* Dispatching events to registered handlers.
* Emitting errors for invalid or unsupported events.
* Running indefinitely until killed or `Syscall.Shutdown` is received.

**Inline Mode** (`--mode=inline` / `--no-daemon`)

Inline mode runs the bridge without daemonizing.

* No Unix socket is created.
* The CLI executes the same decode/validate/dispatch/encode pipeline **in-process**.
* The prologue MUST still be honored:
  * inline runtime emits a `Syscall.Authenticate` prologue frame to the client pipeline
  * client pipeline MUST respond before subsequent events are processed

Inline mode is intended for:

* tests/CI and deterministic one-shot runs
* environments where background daemons are undesirable
* debugging handler behavior without IPC

#### 4.5.2 Stream-First Data Plane

All IO SHOULD be modeled as pipes:

* Client: `ReadableStream<OsEvent>` → `TransformStream<OsEvent, bytes>` → socket write
* Client: socket read → `TransformStream<bytes, OsEvent>` → stdout (NDJSON)
* Daemon: socket read → decode → validate → dispatch → encode → socket write

Handlers MUST be expressed as:

```typescript
TransformStream<OsEvent, OsEvent>
```

#### 4.5.3 Dispatch Registry

The daemon maintains a registry of handlers.

* Keys SHOULD be based on `OsEvent.name`.
* Implementations MAY also key on `type` if needed.

**Unsupported request rule:**

* If an input `OsEvent` is valid but no handler is registered for it, the daemon MUST emit an `error` OsEvent indicating the request is unsupported, then continue processing subsequent input events.

### 4.6 Lifecycle Algorithms

#### 4.6.1 Socket Path Computation

The socket path MUST be deterministic and require no user configuration.

Recommended order:

1. If `$XDG_RUNTIME_DIR` is set, use it.
2. Else if `$TMPDIR` is set, use it.
3. Else use `/tmp`.

The bridge MUST create a private directory (mode `0700`) under the chosen base directory, and place the socket file inside it.

### 4.7 URL vs Local Invocation Policy

The bridge may be invoked from a local file path or a URL.

* URL invocations MUST be `https:`.
* URL invocations SHOULD be pinned (tag/commit/checksum) for determinism.

The exact mechanism for locating the entrypoint for self-spawn is implementation-defined.

---

### 4.8 Lifecycle Algorithms

#### 4.8.1 Client Bootstrap (Connect → Spawn → Retry)

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

#### 4.8.2 Daemon Single-Instance & Stale Socket Cleanup

Daemon startup MUST:

1. Ensure private runtime directory exists (`0700`).
2. If socket path exists:
   * Attempt to connect.
   * Attempt to read the first server→client frame within a short timeout window.
   * If a valid `OsEvent` is received and its `name` is `Syscall.Authenticate`, another daemon is running; the new daemon MUST exit.
   * Otherwise, treat as stale: remove the socket file and continue.
3. Bind and listen on the socket.

#### 4.8.3 Per-Connection Processing Loop

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

#### 4.8.4 Client Exit Semantics

* Client MUST half-close write end after sending all input frames.
* Client MUST continue reading until daemon closes the connection.

### 4.9 Error Handling

#### 4.9.1 Invalid Frames

* If a line cannot be parsed as JSON, daemon MUST emit an `error` event and continue.
* If JSON parses but fails `OsEventSchema`, daemon MUST emit an `error` event and continue.

#### 4.9.2 Unsupported Events

If an `OsEvent` is valid but unsupported (no handler), daemon MUST emit an `error` indicating:

* the request is unsupported
* the caller should register/implement the handler and retry

Daemon MUST continue processing subsequent frames.

#### 4.9.3 Client Exit Code

Client SHOULD exit non-zero if any `error` frames were observed on stdout.

---

## 5. Compatibility

This RFC aligns with:

* **RFC 0022 (STOP Protocol)**: Uses semantic field names in OsEvent schema
* **Kernel Events Architecture**: Uses the standardized OsEvent envelope from `os/kernel/events.ts`

This RFC introduces a new transport layer (Unix socket + daemon) but maintains full compatibility with the existing event schema and CQRS semantics.

**Migration Path**: Existing direct CLI invocations will continue to work. The daemon mode is opt-in via the transparent bootstrap mechanism.

---

## 6. Rationale

* **NDJSON + OsEvent**: a small, debuggable, stream-composable syscall format.
* **Mandatory prologue**: provides a universal connection state gate (open or authenticated).
* **Streaming dispatch**: aligns with Deno streams and CLI pipeline ergonomics.
* **Explicit unsupported errors**: accelerates syscall implementation and registration.
* **Inline mode**: enables deterministic execution and testing without daemon lifecycle concerns.

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
* The socket MUST reside inside that directory.
* When signature mode is enabled, the daemon MUST close connections that fail verification immediately.
* URL invocation MUST be `https:` and SHOULD be pinned for determinism.
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

Future RFCs MAY add:

* durable persistence for daemon state
* subscription/pubsub semantics
* protocol versioning
* bidirectional request initiation (daemon emits `command`/`query`) with **deferred responses** across future CLI sessions

For deferred responses, implementations SHOULD use `metadata.causation` to reference the originating request `metadata.id`.

---

## 11. Unresolved Questions

* Exact socket directory naming scheme (app name, uid, multi-tenant strategy).
* Exact error payload contract (`code`, `message`, `details`).
* Authentication challenge format and signature encoding details.
* Exact self-spawn mechanism for URL vs local file invocation.
* How deferred responses are stored/routed across CLI sessions (out of scope).

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

## Appendix B: Origin Parameter Implementation (Non-Normative)

This appendix describes how the origin parameter (defined normatively in **RFC 0015 Section 4.3.1**) is passed through the syscall bridge in the reference implementation.

### B.1. Overview

The origin parameter is the security principal for mutable state isolation. The normative requirements (provision, normalization, isolation, immutability, security) are specified in **RFC 0015 Section 4.3.1**. This appendix describes **how** the reference implementation satisfies those requirements.

### B.2. Passing Mechanism

#### B.2.1. Runtime Location Flag (Deno)

The reference implementation uses Deno's `--location` flag to pass the origin parameter:

```bash
# Inline mode with origin
deno run -A --location=https://my-os.local/ syscall.ts Memory.Set /key value

# Daemon mode with origin
deno run -A --location=https://acme.com/ syscall.ts --mode=daemon
```

#### B.2.2. Why `--location`?

Deno's `--location` flag provides:
- **Automatic isolation**: `Deno.openKv()` respects location for storage namespacing
- **W3C standard**: Uses standard location API for compatibility
- **Transparent to syscalls**: Individual syscall implementations don't need to parse origin
- **Process-level enforcement**: Runtime guarantees isolation at the process boundary

### B.3. Origin Normalization Implementation

The reference implementation normalizes origin values according to **RFC 0015 Section 4.3.1** requirements:

#### B.3.1. Normalization Function (Reference)

```typescript
/**
 * Normalizes origin parameter per RFC 0015 Section 4.3.1
 * This is a reference implementation (non-normative)
 */
function normalizeOrigin(origin: string | undefined, root: string): string {
  // Rule 3: Fallback to root if undefined or empty
  if (!origin || origin.trim() === "") {
    return root;
  }

  // Rule 1: If valid URL, use as-is
  try {
    new URL(origin);
    return origin; // Valid URL
  } catch {
    // Not a valid URL, proceed to name normalization
  }

  // Rule 2: Name format normalization
  const normalized = origin
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "") // Remove non-alphanumeric except hyphens
    .replace(/^-+|-+$/g, "");   // Trim leading/trailing hyphens

  return `https://${normalized}.local/`;
}
```

#### B.3.2. Normalization Examples

As specified in **RFC 0015 Section 4.3.1**, the reference implementation produces these transformations:

| Input | Normalized Output | Rule Applied |
|-------|------------------|--------------|
| `https://acme.com/` | `https://acme.com/` | Valid URL (Rule 1) |
| `https://my-os.local/` | `https://my-os.local/` | Valid URL (Rule 1) |
| `my-os` | `https://my-os.local/` | Name format (Rule 2) |
| `MyCompany_OS` | `https://mycompany-os.local/` | Name format (Rule 2) |
| `My OS!` | `https://my-os.local/` | Name format (Rule 2) |
| `undefined` | `<root parameter>` | Fallback (Rule 3) |
| `""` | `<root parameter>` | Fallback (Rule 3) |

### B.4. Integration Points

#### B.4.1. Inline Mode

In inline mode, the origin is passed when launching the syscall process:

```typescript
// Read origin from boot configuration (RFC 0014)
const origin = bootConfig.origin;
const root = bootConfig.root;

// Normalize origin
const normalizedOrigin = normalizeOrigin(origin, root);

// Launch syscall with --location
const cmd = new Deno.Command(Deno.execPath(), {
  args: [
    "run", "-A",
    `--location=${normalizedOrigin}`,
    "syscall.ts",
    "Memory.Set",
    "/key",
    "value"
  ],
});
```

#### B.4.2. Daemon Mode

In daemon mode, the origin is set when the daemon process starts:

```bash
# Daemon started with origin from boot config
deno run -A --location=https://my-os.local/ syscall.ts --mode=daemon
```

All client connections to this daemon inherit the daemon's origin enforcement:
- Daemon's `Deno.openKv()` uses the `--location` value for storage isolation
- Clients cannot override the origin (enforced by process boundary)
- All syscalls executed by this daemon operate under the same origin

#### B.4.3. Client Mode

Client mode connects to an existing daemon, which already has its origin configured. The client does NOT pass origin (the daemon's origin is already set):

```bash
# Client connects to daemon (daemon's origin applies)
echo '{"type":"command","name":"Memory.Set","payload":{"key":"/foo","value":"bar"}}' \
  | deno run -A syscall.ts
```

### B.5. Security Implementation

The reference implementation satisfies **RFC 0015 Section 4.3.1** security requirements:

#### B.5.1. Trusted Source

Origin value comes from bootloader configuration (**RFC 0014** front matter):

```yaml
---
root: https://raw.githubusercontent.com/org/repo/main/os/
origin: my-os
init: /agents/shell.md
---
```

The PromptWare Kernel (Main Thread) reads this configuration and passes the normalized origin to the Software Kernel via `--location`.

#### B.5.2. No User Override

User-space code cannot override origin because:
- Origin is set at **process launch time** via `--location` flag
- Deno runtime enforces the location value for all storage APIs
- No API exists to change location after process start
- Syscall implementations don't parse origin directly

#### B.5.3. Runtime Enforcement

Deno's runtime guarantees:
- `Deno.openKv()` respects `--location` for storage partitioning
- `Deno.openKv(":memory:")` still respects location for isolation
- Different location values → completely isolated KV namespaces
- Same location value → shared KV namespace

### B.6. Alternative Implementations

While the reference implementation uses `--location`, other implementations MAY use:

#### B.6.1. Environment Variables

```bash
export PWOS_ORIGIN="https://my-os.local/"
deno run -A syscall.ts Memory.Set /key value
```

Syscalls would read `Deno.env.get("PWOS_ORIGIN")` and use it to partition storage.

#### B.6.2. Process Context Object

```typescript
// Global context set at process start
globalThis.__pwosContext = {
  origin: "https://my-os.local/",
  root: "https://github.com/.../os/",
};

// Syscalls read from global context
const kv = await Deno.openKv(globalThis.__pwosContext.origin);
```

#### B.6.3. Storage Prefix

```typescript
// Syscalls manually prefix keys with origin
const origin = normalizeOrigin(config.origin, config.root);
const prefixedKey = [origin, ...userKey];
const kv = await Deno.openKv();
await kv.set(prefixedKey, value);
```

**Note**: All alternative implementations MUST satisfy the normative requirements in **RFC 0015 Section 4.3.1** (provision, normalization, isolation, immutability, security).

### B.7. Testing Origin Isolation

Reference test cases to verify origin isolation:

```typescript
// Test Case 1: Different origins = isolated storage
const kv1 = await Deno.openKv(); // --location=https://tenant-a.local/
await kv1.set(["key"], "value-a");

const kv2 = await Deno.openKv(); // --location=https://tenant-b.local/
const result = await kv2.get(["key"]);
assert(result.value === null); // Should NOT see tenant-a's data

// Test Case 2: Same origin = shared storage
const kv3 = await Deno.openKv(); // --location=https://tenant-a.local/
const result2 = await kv3.get(["key"]);
assert(result2.value === "value-a"); // Should see tenant-a's data
```

---

## Appendix C: Errata & Notes

None.

---

End of RFC 0023

---
rfc: 0032
title: CQRS Event Loop Processor
author: Huan Li, GitHub Copilot
status: Draft
type: Standards Track
created: 2026-01-06
updated: 2026-01-06
version: 0.1
tags: [kernel, cqrs, event-loop, worker, scheduler, adapters]
---

# RFC 0032: CQRS Event Loop Processor

## 1. Summary

This RFC defines the **CQRS Event Loop Processor** for PromptWare OS: a **Web-native**, **Worker-aligned**, **Deno-native** event loop that routes **OsMessage** (RFC 0024) between:

- **Adapters** (transport glue; message sources/sinks)
- **Capability Actors** (business logic executors; Worker-shaped mailboxes)

The CQRS Event Loop:

- Performs **validation, normalization, routing, dispatch, fan-out, and reply delivery**
- Executes **zero business logic**
- Implements **priority lanes** with a **Control Plane (microtask lane)** and a **User Plane (macrotask lanes)**
- Supports **timer-driven message scheduling** (“`setTimeout` for CQRS commands”) using **Web timers**

The design is intentionally aligned 1:1 with:

- The **Deno runtime model** (V8 + Web APIs + per-Worker event loop + async ops driven by Rust runtime)
- The **W3C Worker messaging model** (postMessage + message events + structured clone)


## 2. Motivation

PromptWare OS is built around **CQRS + EDA** where every action is a message. As the number of capabilities grows, the system needs one place that enforces:

- **Deterministic routing**: `(kind,type)` → destination capability actor(s)
- **Correct lineage**: `metadata.causation` and `metadata.correlation`
- **Non-blocking coordination**: routing never waits on business logic
- **System-level reliability** under maximum trust

The CQRS Event Loop is the system’s **coordination primitive**.


## 3. Goals & Non-Goals

### 3.1 Goals

1. Define a **normative event loop algorithm** for processing OsMessages with priority lanes.
2. Define a **Worker-shaped Capability Actor contract** (duck typed to the W3C Worker surface).
3. Define **boot-time routing discovery** by introspecting capability schemas (finite `(kind,type)` pairs).
4. Define a **timer scheduling design** that is Web-native and Deno-native (no custom scheduler metaphors).
5. Keep the CQRS Event Loop **routing-only**: no domain logic.

### 3.2 Non-Goals

1. Durable persistence of the message bus (future standards-track work).
2. Authorization/permissions: PromptWare OS uses a maximum-trust model.
3. Defining every transport adapter (only a minimal NDJSON socket adapter is described).


## 4. Terminology

- **OsMessage**: CQRS envelope defined in RFC 0024.
- **Turn**: processing of exactly one inbound OsMessage, followed by microtask bookkeeping.
- **Control Plane**: system-originated messages that coordinate the loop itself (faults, timers, supervision signals).
- **User Plane**: application commands/queries/events.
- **Lane**: an ordered message queue processed with strict priority.
- **Capability**: a module exporting schemas + `spawn()` to create a running actor.
- **Capability Actor**: a running instance with a mailbox, aligned to Worker message semantics.
- **Adapter**: transport glue that converts external I/O into inbound OsMessages and writes outbound OsMessages.


## 5. Deno Event Loop Workflow (Conceptual Model)

This section describes Deno’s event loop at the level required to map concepts 1:1. It does not define Deno internals; it defines the *workflow* the runtime presents to user code.

### 5.1 One event loop per Worker runtime

In Deno, a **Worker-like runtime** is the unit of concurrency: each runtime has its own JavaScript execution context and its own event loop.

**Mapping**: Each Capability Actor is Worker-shaped, and the CQRS Event Loop is itself a Worker-like coordinator.

### 5.2 Two-step cycle: macrotask → microtask drain

Web runtimes (including Deno) use a two-level scheduling model:

1. **Macrotasks**: message events, timers, I/O readiness callbacks.
2. **Microtasks**: promise jobs and `queueMicrotask` jobs, drained at the end of a macrotask turn.

**Workflow**:

- Run a macrotask callback (e.g., message event handler)
- Drain microtasks to completion
- Yield to the host to await the next macrotask

**Mapping**: The CQRS Event Loop processes exactly one inbound OsMessage as a macrotask “turn”, then drains a microtask lane for atomic bookkeeping.

### 5.3 Async ops drive readiness, not callbacks

In Deno, I/O and timers are driven by the host runtime as asynchronous operations. JavaScript observes readiness through standard Web mechanisms (Promise resolution, timers, and message events). Conceptually:

- The runtime tracks pending async work.
- When some work becomes ready, the runtime schedules a runnable task.
- JavaScript runs the task callback.
- Microtasks drain.
- Control yields back to the runtime to drive remaining async work.

**Mapping**: Adapters and actors are the sources of readiness. The CQRS Event Loop reacts to inbound OsMessages and outbound message events; it does not block waiting for capability execution.

### 5.4 Timers as a standard Web source

Timers (`setTimeout`, `setInterval`) are standard Web APIs. In Deno they schedule future macrotasks.

**Mapping**: “`setTimeout` for CQRS commands” is implemented by scheduling a future message emission that re-enters the CQRS Event Loop as a normal inbound message.

### 5.5 I/O as async work

I/O (sockets, files, fetch) is driven by the host runtime and becomes runnable work when ready.

**Mapping**: Adapters are message sources driven by async I/O. When I/O yields a line/frame, the adapter emits an inbound OsMessage into the event loop.

### 5.6 Deno-style turn workflow (step-by-step)

The CQRS Event Loop RFC relies on a small set of Deno-consistent, observable behaviors:

1. A message arrives (I/O readiness, timer firing, or Worker message event).
2. The runtime schedules a task to run JavaScript.
3. JavaScript handles that task.
4. Microtasks drain.
5. The runtime resumes driving pending async work.

**Mapping**: A CQRS “turn” corresponds to steps (3) and (4): route/dispatch one inbound OsMessage, then finalize bookkeeping.


## 6. W3C Worker Messaging Model (Normative Reference Frame)

The CQRS Event Loop and Capability Actors MUST align to Worker messaging semantics.

### 6.1 The essential surface

A Worker-like actor is defined by:

- **Inbound**: `postMessage(data)`
- **Outbound**: message events delivered to:
  - `onmessage = (event) => { ... }`, or
  - `addEventListener("message", handler)`

**Mapping**: The CQRS Event Loop MUST interact with Capability Actors using only this surface (plus optional lifecycle hooks), even when actors are implemented in-process for MVP.

### 6.2 MessageEvent shape

Outbound delivery MUST use the Worker convention that data is carried on the event object:

- `event.type === "message"`
- `event.data` contains the structured-cloned payload

For PromptWare OS:

- `event.data` MUST be an OsMessage.

### 6.3 Structured clone

Worker messages use structured clone semantics. For the CQRS Event Loop this means:

- OsMessages MUST be JSON-serializable.
- Implementations MUST NOT rely on identity/pointer sharing across the message boundary.

This aligns with RFC 0024’s “pure JSON” constraint.

### 6.4 Error channels (optional, recommended)

Workers also have error-side channels (e.g., `error`, `messageerror`). For MVP, this RFC does not require a full error event surface, but it is recommended because it simplifies supervision and fault attribution.

If an actor supports these, the CQRS Event Loop SHOULD listen to them:

- `"error"`: unhandled exceptions that escaped the actor
- `"messageerror"`: structured clone / message decode failures


## 7. Architecture

### 7.1 Roles

1. **CQRS Event Loop (central router)**
   - Validates and routes messages
   - Dispatches to Capability Actors
   - Fans out events
   - Maintains pending request mapping (reply delivery)
   - Owns scheduling lanes and supervision signals

2. **Capability Actors (business logic)**
   - Receive messages from the loop
   - Execute domain logic
   - Emit events and terminal outcomes (reply/error)

3. **Adapters (transport glue)**
   - Convert external I/O into OsMessages
   - Write outbound OsMessages to external transports

### 7.2 Control Plane vs User Plane

To enable strict priority lanes without expanding the OsMessage schema, this RFC defines a convention:

- **Control Plane** message types MUST use the `Sys.*` domain.
  - Examples: `Sys.RoutingError`, `Sys.ActorFault`, `Sys.TimerFired`
- All other domains are treated as **User Plane**.

This convention is routing-only policy and does not grant permissions.

This convention does not imply exclusivity of lanes: the CQRS Event Loop may classify any OsMessage into the System Lane based on ingress context (Section 8.2).


## 8. Event Lanes and Scheduling Algorithm (Normative)

### 8.1 Lanes

The CQRS Event Loop MUST implement the following lanes:

1. **Microtask Lane (Control Plane)**
   - Purpose: atomic bookkeeping at end-of-turn
   - Source: internal loop actions only
   - Priority: highest

2. **System Lane (Macrotask / Control Plane)**
   - Purpose: system-originated routing and supervision signals
   - Source: the loop itself, internal system components (e.g., Timer), and any inbound classified as System
   - Priority: higher than user lane

3. **User Lane (Macrotask / User Plane)**
   - Purpose: application commands/queries/events
   - Source: adapters and actors

Additional user lanes (e.g., per-tenant) are future work; MVP uses one user lane.

### 8.2 Message classification into lanes

Every inbound OsMessage MUST be classified into exactly one macrotask lane.

Classification rule (MVP, deterministic):

1. **Ingress classification wins**: when an OsMessage is enqueued into the loop, it MUST be enqueued with an explicit lane chosen by the ingress source:
   - `System Lane`, or
   - `User Lane`.

2. **Defaulting rule**:
   - External adapters (e.g., NDJSON socket) MUST enqueue inbound messages into the User Lane.
   - Internal loop mechanisms and internal system components MAY enqueue into the System Lane.

3. **Type-based rule (recommended default)**:
   - If a source does not specify a lane explicitly, the loop MUST classify by `type`:
     - If `type` matches `^Sys\.` then System Lane.
     - Otherwise User Lane.

This preserves a simple convention (`Sys.*`) while allowing non-`Sys.*` messages to enter the System Lane when the system explicitly chooses to prioritize them.

### 8.3 The “Turn” algorithm

A **turn** is triggered by exactly one inbound macrotask message.

**Turn invariants**:

- The CQRS Event Loop MUST process at most one macrotask message per turn.
- The CQRS Event Loop MUST then drain the microtask lane to completion.
- The CQRS Event Loop MUST then yield back to the host runtime.

### 8.4 Lane selection

When starting a new turn, the loop MUST choose the next macrotask message using this strict priority order:

1. System Lane
2. User Lane

If both are empty, the loop is idle.

### 8.5 Microtask lane semantics (Control Plane bookkeeping)

The microtask lane exists to preserve Web-style “end-of-turn finalization” semantics.

The CQRS Event Loop MAY schedule microtasks to:

- resolve pending maps
- enqueue outbound NDJSON frames (buffering only)
- emit observability signals

Microtasks MUST be routing-only.

To prevent starvation by self-scheduling:

- Microtasks MUST be bounded and MUST NOT enqueue unbounded further microtasks.
- Any microtask that needs I/O MUST schedule that I/O through an adapter and return.

### 8.6 Router work budget

To preserve non-blocking behavior:

- Router work per turn MUST be bounded and routing-only.
- The loop MUST NOT execute capability logic.
- Fan-out MUST be implemented as dispatching to N actors, not executing handlers inline.

### 8.7 Pseudocode (Normative Behavior)

The loop behavior can be described as:

```ts
while (alive) {
  const inbound = systemLane.shift() ?? userLane.shift();
  if (!inbound) {
    await waitForNextInbound();
    continue;
  }

  // (1) message event handling (macrotask)
  routeAndDispatch(inbound);

  // (2) microtask drain (end-of-turn)
  while (microtaskLane.hasItems()) {
    const task = microtaskLane.shift();
    task();
  }

  // (3) yield to host runtime
  await yieldToRuntime();
}
```

`yieldToRuntime()` MUST be implemented using standard Web scheduling (e.g., awaiting a resolved promise or a queued microtask boundary), not a custom phase model.

### 8.8 Priority lanes vs fairness

Priority lanes are about correctness and operability: system coordination must remain responsive even under heavy user load.

Fairness is achieved by the turn boundary:

- Only one macrotask message is routed per turn.
- No capability work is executed in the loop.
- Slow actors never block the loop because dispatch is mailbox-based.

This yields a Deno-consistent “reactor” model: the loop remains responsive because it only routes and yields.


## 9. Routing Laws (Normative)

### 9.1 Routing by kind

These routing rules build on RFC 0024.

1. **`kind: "command"`**
   - MUST route to exactly one capability actor.
   - Actor MAY emit 0..N events and MUST emit exactly one terminal `reply` or `error`.

   Terminality enforcement (MVP): the loop MUST NOT treat a missing terminal outcome as an immediate fault. Instead, terminality is enforced by timeout via `Sys.RequestTimeout` (Section 12.7).

2. **`kind: "query"`**
   - MUST route to exactly one capability actor.
   - Actor MUST emit exactly one terminal `reply` or `error`.

   Terminality enforcement (MVP): same as command. Missing terminal outcome becomes a fault only after a timeout-driven `Sys.RequestTimeout` fires.

3. **`kind: "event"`**
   - MUST fan out to zero or more subscribed capability actors.
   - Events MUST NOT require replies.

4. **`kind: "reply"`**
   - MUST be delivered to the pending requester identified by `metadata.causation`.
   - MUST NOT be broadcast.

5. **`kind: "error"`**
   - If it answers a request, it MUST be delivered using the same rule as `reply`.
   - Otherwise it MAY be delivered to an error sink and/or observability sink.

### 9.2 Lineage rules (causation first)

- Every OsMessage MUST include `metadata.id` and `metadata.timestamp`.
- For any output emitted as a consequence of processing an inbound message, the actor MUST set:
  - `metadata.causation = inbound.metadata.id`
- `metadata.correlation` SHOULD be propagated unchanged when present.

For request/reply joins, the CQRS Event Loop MUST treat `metadata.causation` as the primary join key. Correlation is grouping, not matching.


## 10. Capability Model (Greenfield, Worker-Shaped)

This RFC defines the greenfield capability contract used by the CQRS Event Loop.

### 10.1 Capability export

A capability module MUST export a static object with:

- `description: string`
- `inbound: ZodSchema` (routable finite `(kind,type)` set)
- `outbound: ZodSchema`
- `spawn(): CapabilityActor`

### 10.2 CapabilityActor interface (duck typed to Worker)

A CapabilityActor MUST provide:

- `postMessage(message: OsMessage): void`

And MUST emit outbound messages using Worker-style message events:

- Either it supports `onmessage = (event) => { ... }`
- Or it supports `addEventListener("message", handler)`

Outbound message events MUST have:

- `event.data` equal to an OsMessage object.

### 10.3 Buffered mailbox (MVP requirement)

To prevent actor slowness from blocking routing:

- `postMessage` MUST be non-blocking.
- Each actor MUST implement an internal **buffered mailbox**.
- The actor MUST process messages from its mailbox asynchronously.

### 10.4 Serialized handling (MVP requirement)

For determinism and minimum cognitive load:

- Each actor MUST process inbound messages **one at a time** (FIFO).

Concurrency inside a capability actor is future work.


## 11. Capability Discovery (Boot-Time Schema Introspection)

The CQRS Event Loop MUST build routing tables by introspecting each capability’s `inbound` schema.

### 11.1 Discoverable requirement (finite set)

A capability is routable only if its inbound schema yields a finite set of `(kind,type)` handles.

MVP rule (lowest ambiguity):

- `inbound` MUST be a union of branches
- each branch MUST contain:
  - `kind: z.literal(...)`
  - `type: z.literal("Domain.Action")`

Capabilities that declare infinite handlers (e.g., `type: z.string()`) MUST be rejected at boot.

### 11.2 Handler uniqueness

For MVP strictness:

- `(kind,type)` MUST map to exactly one capability for commands and queries.
- If two capabilities claim the same `(kind,type)`, boot MUST fail.

### 11.3 Event subscriptions

Event fan-out MUST use explicit subscriptions in MVP.

Each capability MUST declare:

- `subscribes: string[]` where each string matches the RFC 0024 type regex.

The loop builds:

- `subscriptionsIndex[eventType] -> capabilityId[]`


## 12. `setTimeout` for CQRS Commands (Timer Scheduling)

This RFC supports timer-driven message scheduling using standard Web timers.

### 12.1 Design goal

Enable: “emit this OsMessage after a delay” without embedding timer logic into domain capabilities.

The scheduling mechanism MUST:

- Be Worker-aligned (message-driven)
- Produce a future macrotask (a future inbound message)
- Preserve lineage and correlation

It MUST also remain Deno-native:

- Use standard Web timers (`setTimeout`) inside a Worker-like runtime.
- Do not introduce a custom timing wheel or phase model.

### 12.2 Timer capability (recommended MVP)

The system SHOULD ship a built-in `Timer` capability actor.

- It is a capability actor like any other.
- It owns timer state in-memory (MVP).
- It uses `setTimeout` to schedule future emissions.

This keeps the CQRS Event Loop routing-only while still providing timing as a Web-native mechanism.

### 12.3 Message types

The Timer capability defines these message types:

- `Timer.Set` (command)
   - Input: `{ delayMs: number, message: OsMessageTemplate }` OR `{ dueAt: number, message: OsMessageTemplate }`
      - `delayMs` is relative delay in milliseconds.
      - `dueAt` is absolute epoch milliseconds.
  - Output (reply): `{ timerId: string }`

- `Timer.Cancel` (command)
  - Input: `{ timerId: string }`
  - Output (reply): `{ cancelled: boolean }`

- `Timer.Fired` (event)
  - Data: `{ timerId: string }`

The Timer capability MUST also re-emit the scheduled `message` back into the CQRS Event Loop when the timer fires.

#### 12.3.1 OsMessageTemplate (normative)

The scheduled message is a template because it is not “on the bus” until it is fired.

`OsMessageTemplate` MUST contain:

- `kind`
- `type`
- `data`

`OsMessageTemplate` MAY contain `metadata.correlation` and other trace fields, but MUST NOT require `metadata.id` or `metadata.timestamp`.

When the timer fires, the Timer capability MUST construct a real OsMessage by assigning:

- a fresh `metadata.id`
- a fresh `metadata.timestamp`

The constructed OsMessage MUST set:

- `metadata.causation = <Timer.Set.metadata.id>`

and then emitting it into the CQRS Event Loop as a normal inbound message.

### 12.4 Timer actor semantics

When the Timer actor receives `Timer.Set`:

1. It validates the schedule request.
2. It allocates a `timerId`.
3. It calls `setTimeout` with the computed delay.
4. It replies with `kind:"reply"` answering `Timer.Set`.

When the timeout fires:

1. It emits `Timer.Fired` (event).
2. It emits the scheduled OsMessage back to the loop.

Lineage requirements when firing:

- `Timer.Fired.metadata.causation` MUST equal the originating `Timer.Set.metadata.id`.
- The scheduled OsMessage constructed from the template MUST set `metadata.causation` to the originating `Timer.Set.metadata.id`.

The Timer actor MUST treat the scheduled OsMessage as opaque data: it MUST NOT inspect, rewrite, or route it.

### 12.5 Lane mapping for timers

- `Timer.Set` and `Timer.Cancel` are User Plane commands.
- The internal timer firing signal MAY be expressed as a Control Plane message, but the scheduled `message` MUST re-enter the loop as a normal inbound message and be routed normally.

### 12.6 Lineage requirements

When a Timer schedules a message:

- The scheduled message template SHOULD preserve the requester’s `metadata.correlation` (if present).
- When the timer fires, the emitted OsMessage MUST set `metadata.causation` to the `Timer.Set.metadata.id`.

This ensures time-delayed work remains traceable.

### 12.7 Timeouts for commands/queries (recommended MVP pattern)

To support request timeouts without embedding timing logic in every domain capability:

- The requester MAY schedule a `Timer.Set` whose scheduled message is a `Sys.RequestTimeout` command containing the original request id.
- The CQRS Event Loop routes `Sys.RequestTimeout` with System Lane priority.
- If the request is still pending, the loop resolves it with a terminal `kind:"error"` answer.

This keeps timeouts as routing-level reliability, not business logic.

### 12.8 `Sys.RequestTimeout` (normative contract)

`Sys.RequestTimeout` is a Control Plane command handled by the CQRS Event Loop itself. It exists to implement timeout-driven soft faulting without executing domain logic.

#### 12.8.1 Message shape

- **Kind**: `command`
- **Type**: `Sys.RequestTimeout`
- **Data**:
   - `requestId: string` (the `metadata.id` of the original command/query)

When the CQRS Event Loop receives `Sys.RequestTimeout`:

1. If `requestId` is not present in the pending table, the loop MUST ignore the message (it is stale).
2. If `requestId` is present and still pending, the loop MUST resolve that request with a terminal `kind:"error"` outcome and MUST remove it from the pending table.

#### 12.8.2 Timeout error envelope

The emitted error MUST satisfy RFC 0024 error rules:

- `kind: "error"`
- `type`: MUST equal the original request’s `type` (e.g., `Memory.Get`)
- `metadata.causation`: MUST equal the original request’s `metadata.id`
- `metadata.correlation`: SHOULD equal the original request’s `metadata.correlation` (if present)

The error `data` SHOULD use:

- `code: 504`
- `message: "Request timed out"`

The loop MAY include structured context in the message (e.g., requested type, elapsed time) as long as it remains JSON.

This error is a soft reliability outcome, not a capability fault.


## 13. Adapter Contract (NDJSON over Unix Socket, MVP)

The MVP transport is NDJSON framing over a Unix socket.

### 13.1 Framing

- Each line is one JSON object.
- Each object MUST parse into an OsMessage and validate against RFC 0024.

### 13.2 Parse and schema errors

If parsing fails or schema validation fails, the adapter MUST emit exactly one `kind:"error"` OsMessage describing the issue.

### 13.3 Request/reply mapping

Replies and errors answer requests by causation:

- `answer.metadata.causation === request.metadata.id`

The CQRS Event Loop MUST maintain a per-connection pending map keyed by request id.

### 13.4 Backpressure

The adapter MUST respect socket backpressure and treat buffered outbound frames as pending work for liveness.

### 13.5 Egress policy (MVP)

For maximum simplicity, the NDJSON adapter MUST write only terminal outcomes for requests:

- `kind: "reply"`
- `kind: "error"`

The adapter MUST NOT stream `kind: "event"` frames to the client by default.

Event streaming is future work and can be introduced via an explicit subscription mechanism.


## 14. Pending Request Table (MVP, Normative)

The CQRS Event Loop MUST maintain a pending request table to deliver terminal outcomes (`reply` / `error`) back to the correct requester.

### 14.1 What is a “request”

For MVP, a request is any inbound OsMessage of:

- `kind: "command"`, or
- `kind: "query"`

received from an external adapter (e.g., the NDJSON socket).

### 14.2 Key and value

The pending request table MUST be keyed by:

- `requestId = request.metadata.id`

Each value MUST contain enough information to complete reply delivery:

- `adapterId` (which adapter instance owns the return channel)
- `connectionId` (or connection context handle)
- `requestType` (original request `type`, used to shape timeout errors)
- `correlation` (optional, for propagation)
- `timeoutTimerId` (optional, if a timeout was scheduled via Timer)

### 14.3 Insertion

When the CQRS Event Loop accepts an external `command` or `query` for routing:

1. It MUST insert a pending entry for `request.metadata.id` before dispatching to the capability actor.
2. If an entry already exists for that request id, the loop MUST treat it as a duplicate request id and MUST emit a `kind:"error"` back to the adapter.

### 14.4 Timeout scheduling (recommended)

If timeout behavior is enabled for the adapter:

1. The loop SHOULD schedule a timeout by issuing `Timer.Set` with an `OsMessageTemplate` of type `Sys.RequestTimeout`.
2. The loop SHOULD store the returned `timerId` in the pending entry.

### 14.5 Resolution on `reply` / `error`

When the CQRS Event Loop receives an inbound `reply` or `error`:

1. It MUST interpret `metadata.causation` as the answered request id.
2. If `metadata.causation` matches an entry in the pending table:
   - The loop MUST deliver the outcome to the corresponding adapter connection.
   - The loop MUST remove the pending entry.
   - If `timeoutTimerId` exists, the loop SHOULD cancel it via `Timer.Cancel`.
3. If `metadata.causation` does not match any pending entry:
   - The loop MUST NOT deliver it to any external adapter.
   - The loop SHOULD emit a `Sys.OrphanOutcome` observability event to the internal error/trace sink.

This preserves determinism and prevents “late replies” from being misdelivered.

### 14.6 Resolution on timeout

When `Sys.RequestTimeout` fires for a pending `requestId`, the loop resolves it as specified in Section 12.8.

If a reply arrives after timeout resolution, it is treated as an orphan outcome (Section 14.5).

### 14.7 Client disconnect

If an adapter connection closes while requests remain pending:

1. The adapter MUST notify the CQRS Event Loop of the disconnect.
2. The loop MUST remove all pending entries associated with that connection.
3. For each removed pending entry, the loop SHOULD cancel `timeoutTimerId` if present.
4. Late outcomes for removed entries MUST be treated as orphan outcomes.

This is a reliability rule, not a security rule.


## 15. Boot Procedure (MVP)

On boot, the CQRS Event Loop MUST:

1. Load capability modules.
2. Validate each capability object shape.
3. Introspect inbound schemas and build handler index.
4. Register event subscriptions.
5. Spawn each capability actor and attach outbound listeners.
6. Start adapters.

The loop is ready when handlers/subscriptions are built, actors are listening, and adapters are accepting input.


## 16. Liveness and Quiescence

The CQRS Event Loop remains alive while any of the following exist:

- any adapter is active and can produce inbound messages
- any pending request awaits a terminal reply/error
- any timers are scheduled
- any outbound frames are buffered

The loop is quiescent when none exist.


## 17. Observability (MVP, High Signal)

The CQRS Event Loop SHOULD emit minimal, structured observability events (as OsMessages) for:

- routing decisions (selected capability id)
- missing handler (routing error)
- actor faults
- timer schedule/fired/cancel

These events SHOULD be Control Plane types (`Sys.*`) and therefore processed at System Lane priority.

If the loop chooses to prioritize a non-`Sys.*` message, it MUST do so via explicit lane selection at enqueue time (Section 8.2), not by inventing new phase semantics.


## 18. Examples

### 17.1 Command → Event(s) → Reply

- Inbound: `kind:"command"`, `type:"Memory.Set"`
- Actor emits `event:"Memory.Changed"` with `causation` set to request id
- Actor emits `reply` answering the request with `causation` set to request id

### 17.2 Command scheduled by timer

- Inbound: `Timer.Set` with `{delayMs: 1000, message: <OsMessageTemplate>}`
- Timer capability replies with `{timerId}`
- After 1s, timer emits `Timer.Fired` and re-emits the scheduled message into the loop

### 17.3 Timer lineage (causation chain)

This example illustrates the normative causation chain when a user command schedules delayed work.

1. User sends a command:

```json
{
   "kind": "command",
   "type": "Build.Run",
   "data": {"target": "docs"},
   "metadata": {
      "id": "A",
      "timestamp": 1767910000000,
      "correlation": "corr-1"
   }
}
```

2. A capability schedules delayed work by sending `Timer.Set`:

```json
{
   "kind": "command",
   "type": "Timer.Set",
   "data": {
      "delayMs": 1000,
      "message": {
         "kind": "command",
         "type": "Build.Run",
         "data": {"target": "docs"},
         "metadata": {"correlation": "corr-1"}
      }
   },
   "metadata": {
      "id": "B",
      "timestamp": 1767910000050,
      "correlation": "corr-1",
      "causation": "A"
   }
}
```

3. When the timer fires, Timer emits `Timer.Fired`:

```json
{
   "kind": "event",
   "type": "Timer.Fired",
   "data": {"timerId": "t-1"},
   "metadata": {
      "id": "C",
      "timestamp": 1767910001050,
      "correlation": "corr-1",
      "causation": "B"
   }
}
```

4. Timer constructs and emits the scheduled OsMessage from the template:

```json
{
   "kind": "command",
   "type": "Build.Run",
   "data": {"target": "docs"},
   "metadata": {
      "id": "D",
      "timestamp": 1767910001050,
      "correlation": "corr-1",
      "causation": "B"
   }
}
```


## 19. Security Considerations

PromptWare OS is maximum trust. This RFC focuses on reliability, determinism, and clarity. No permission model is specified.


## 20. Compatibility

- Message schema: RFC 0024
- Dual-mode architecture mental model: RFC 0015

This RFC introduces a greenfield Worker-shaped capability execution contract (`spawn()`) to optimize for Web semantics.


## 21. References

- RFC 0015: Kernel DualMode Architecture
- RFC 0024: CQRS Message Schema
- RFC 0031: System Capability Modules
- W3C/WHATWG: Web Workers, HTML Event Loop, Streams

---

End of RFC 0032

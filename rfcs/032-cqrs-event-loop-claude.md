---
rfc: 0032
title: Cloud Native CQRS Event Loop Processor
author: Huan Li, GitHub Copilot
status: Draft
type: Standards Track
created: 2026-01-06
updated: 2026-01-06
version: 1.0
tags: [kernel, cqrs, event-loop, web-worker, architecture]
---

# RFC 0032: Cloud Native CQRS Event Loop Processor

## 1. Summary

This RFC defines the **CQRS Event Loop**—the central message scheduler and dispatcher for PromptWar̊e ØS. It is a cloud-native, AI-native implementation that maps 1:1 to the **Deno Native Event Loop** (Tokio + V8) and strictly follows the **W3C Web Worker Specification**.

The CQRS Event Loop is:
- **A Message Router**: Routes `OsMessage` envelopes to Capability Actors
- **A Scheduler**: Manages Priority Lanes (System/User) and Timer-based deferred execution
- **Not an Executor**: Contains zero business logic; all execution happens in Actors

**Core Principle**: The CQRS Event Loop virtualizes the Deno/V8 event loop at the application layer, giving PromptWar̊e ØS precise control over message scheduling, routing, and reliability.

---

## 2. Motivation

### 2.1 The Cloud-Native Message Bus Pattern

Modern microservice architectures use centralized message buses (Kafka, RabbitMQ, NATS) to decouple producers from consumers. PromptWar̊e ØS applies this pattern at the OS level:

- **Producers**: Adapters (Unix socket, future Kafka) and Capability Actors
- **Consumer**: The CQRS Event Loop (router only)
- **Executors**: Capability Actors (Worker-shaped)

This separation enables:
- **Horizontal scaling**: Add more Actors without changing routing logic
- **Observability**: All messages flow through a single choke point
- **Reliability**: Centralized retry, timeout, and dead-letter handling

### 2.2 The AI-Native Requirement

LLM co-founders interact with the system via CQRS messages. They need:
- **Deterministic routing**: Same message → same destination (no magic)
- **Introspectable contracts**: Schema-driven discovery via `Syscall.Describe`
- **Minimal cognitive load**: One message model, one routing algorithm

### 2.3 Why Map to Deno's Event Loop?

Deno's event loop is the cleanest modern implementation of the Web platform's event model:
- **Single-threaded coordination**: No shared-memory races
- **Microtask/Macrotask separation**: Clear priority semantics
- **Worker isolation**: Each Actor has its own "runtime"

By mapping our CQRS concepts 1:1 to Deno's primitives, we inherit decades of Web platform wisdom while maintaining full control over scheduling policy.

---

## 3. Goals & Non-Goals

### Goals

1. **Define the CQRS Event Loop** as a formal state machine with Priority Lanes
2. **Map Deno's native event loop** concepts to CQRS equivalents (1:1)
3. **Align with W3C Web Worker specification** for Actor semantics
4. **Specify the Timer subsystem** for deferred command execution (`setTimeout` equivalent)
5. **Establish routing laws** for Command/Query/Event/Reply/Error message kinds
6. **Define the Capability Actor contract** (Worker-shaped, duck-typed)

### Non-Goals

1. **Multi-threading**: MVP runs in single Deno runtime (future: Worker isolates)
2. **Persistence**: Transient in-memory queues (future: durable log)
3. **Security/Permissions**: Maximum trust model (AI co-founders have full access)
4. **Specific Capability implementations**: Covered in other RFCs

---

## 4. Reference Architecture: Deno Native Event Loop

This section documents how Deno's native event loop works, establishing the foundation for our CQRS mapping.

### 4.1 Deno Runtime Architecture

Deno's architecture consists of three layers:

```
┌─────────────────────────────────────────────────────────┐
│                    JavaScript (V8)                      │
│  - User code execution                                  │
│  - Promise resolution                                   │
│  - Microtask queue (queueMicrotask, Promise.then)      │
├─────────────────────────────────────────────────────────┤
│                   deno_core::JsRuntime                  │
│  - Event loop coordinator                               │
│  - Op dispatcher (JS ↔ Rust bridge)                    │
│  - Resource table (file handles, sockets, timers)      │
├─────────────────────────────────────────────────────────┤
│                      Tokio (Rust)                       │
│  - Async I/O driver                                     │
│  - Timer wheel                                          │
│  - Task scheduler                                       │
└─────────────────────────────────────────────────────────┘
```

**Key Insight**: Each `JsRuntime` instance is a **Worker-like execution context** with its own event loop. Deno does not have "one global loop"—it has one loop per Worker.

### 4.2 The Event Loop Algorithm

Deno's event loop (simplified) follows this algorithm:

```
LOOP:
  1. Run all ready JavaScript (synchronous execution)
  2. Drain the Microtask queue completely
     - Promise callbacks (.then, .catch, .finally)
     - queueMicrotask() callbacks
  3. If pending ops exist:
     a. Poll Tokio for ready I/O or timer events
     b. Resolve corresponding Promises
     c. GOTO 1
  4. If no pending ops and no pending Promises:
     - EXIT (loop completes)
```

**Critical Invariant**: Microtasks drain **completely** before any I/O or timer callback runs. This ensures that Promise chains settle atomically within a "turn."

### 4.3 The Two-Queue Model

Deno (following Web semantics) operates with two logical queues:

| Queue | Name | Priority | Contents | Drain Behavior |
|-------|------|----------|----------|----------------|
| **1** | Microtask Queue | HIGH | Promise callbacks, `queueMicrotask()` | Drain completely before next macrotask |
| **2** | Macrotask Queue | NORMAL | Timers (`setTimeout`), I/O callbacks, message events | Process one, then check microtasks |

**Execution Order Example**:
```javascript
setTimeout(() => console.log("A"), 0);      // Macrotask
queueMicrotask(() => console.log("B"));     // Microtask
Promise.resolve().then(() => console.log("C")); // Microtask
console.log("D");                           // Synchronous

// Output: D, B, C, A
```

### 4.4 Timers in Deno

Timers are implemented via Tokio's timer wheel:

1. `setTimeout(fn, delay)` registers a timer op with Tokio
2. Tokio schedules a wake-up after `delay` milliseconds
3. When the timer fires, Tokio notifies `JsRuntime`
4. `JsRuntime` queues `fn` as a macrotask
5. On next loop iteration, `fn` executes

**Key Properties**:
- Timers are **not** precise to the millisecond (event loop must be free)
- `setTimeout(fn, 0)` means "next macrotask opportunity," not "immediately"
- Multiple timers with same delay fire in registration order (FIFO)

### 4.5 Worker Message Events

In the W3C model (which Deno follows), Workers communicate via `postMessage`:

1. **Sender** calls `worker.postMessage(data)`
2. Data is **structured clone** serialized (deep copy, no sharing)
3. **Receiver's** event loop queues a `message` event (macrotask)
4. Receiver's `onmessage` handler executes on next loop iteration

**Key Properties**:
- `postMessage` is **non-blocking** (returns immediately)
- Message delivery is **ordered** (FIFO per sender-receiver pair)
- Handlers run **asynchronously** (not during the `postMessage` call)

---

## 5. Reference Specification: W3C Web Worker

This section documents the W3C Web Worker specification elements that govern our Capability Actor design.

### 5.1 The Worker Interface (Normative Extract)

From the [WHATWG HTML Living Standard](https://html.spec.whatwg.org/multipage/workers.html):

```webidl
[Exposed=(Window,DedicatedWorker,SharedWorker)]
interface Worker : EventTarget {
  constructor(USVString scriptURL, optional WorkerOptions options = {});

  void terminate();
  void postMessage(any message, sequence<object> transfer);
  void postMessage(any message, optional StructuredSerializeOptions options = {});

  attribute EventHandler onmessage;
  attribute EventHandler onmessageerror;
  attribute EventHandler onerror;
};
```

**Key Methods**:
- `postMessage(message)`: Send data to the worker's event loop
- `terminate()`: Immediately stop the worker
- `onmessage`: Handler for incoming messages

### 5.2 The MessageEvent Interface

```webidl
[Exposed=(Window,Worker)]
interface MessageEvent : Event {
  readonly attribute any data;
  readonly attribute USVString origin;
  readonly attribute USVString lastEventId;
  readonly attribute MessageEventSource? source;
  readonly attribute FrozenArray<MessagePort> ports;
};
```

**Key Property**: `event.data` contains the message payload (structured clone).

### 5.3 Message Port Semantics

The W3C spec defines message delivery semantics:

1. **Ordered**: Messages from A→B arrive in send order
2. **Asynchronous**: `postMessage` returns before delivery
3. **Isolated**: Each Worker has its own global scope (no shared memory)
4. **Error Boundary**: Exceptions in handlers don't crash the sender

### 5.4 The Worker Event Loop

Per the spec, each Worker has its own event loop that:

1. Waits for tasks (messages, timers)
2. Processes one task at a time
3. Drains microtasks after each task
4. Continues until terminated or no pending tasks

---

## 6. CQRS Event Loop Architecture

This section defines the PromptWar̊e ØS CQRS Event Loop by mapping Deno/W3C concepts to our domain.

### 6.1 Concept Mapping Table

| Deno/W3C Concept | CQRS Equivalent | Implementation |
|------------------|-----------------|----------------|
| `JsRuntime` | CQRS Event Loop | Central coordinator |
| Worker | Capability Actor | Duck-typed Worker shape |
| Microtask Queue | System Priority Lane | Internal control signals |
| Macrotask Queue | User Priority Lane | External messages (Commands/Queries) |
| Timer Op | Deferred Message | `setTimeout` equivalent for CQRS |
| `postMessage` | `actor.postMessage(OsMessage)` | Non-blocking dispatch |
| `onmessage` | Actor message event listener | Outbound observation |
| Pending Ops | In-flight Correlations + Timers | Liveness tracking |
| `terminate()` | `actor.terminate()` | Graceful shutdown |

### 6.2 System Architecture Diagram

```
                            ┌─────────────────────────────────┐
                            │       CQRS Event Loop           │
                            │   (Central Router/Scheduler)    │
                            │                                 │
   ┌──────────────┐         │  ┌───────────────────────────┐  │
   │   Adapter    │─────────┼─▶│   System Priority Lane    │  │
   │ (NDJSON/TCP) │         │  │   (Microtask equivalent)  │  │
   └──────────────┘         │  │   - Sys.ActorFault        │  │
          │                 │  │   - Sys.RoutingError      │  │
          │                 │  │   - Internal control      │  │
          ▼                 │  └───────────────────────────┘  │
   ┌──────────────┐         │              │                  │
   │   Validate   │         │              ▼                  │
   │   + Route    │         │  ┌───────────────────────────┐  │
   └──────────────┘         │  │   User Priority Lane      │  │
          │                 │  │   (Macrotask equivalent)  │  │
          │                 │  │   - Commands              │  │
          │                 │  │   - Queries               │  │
          │                 │  │   - Events                │  │
          │                 │  └───────────────────────────┘  │
          │                 │              │                  │
          │                 │              ▼                  │
          │                 │  ┌───────────────────────────┐  │
          │                 │  │      Timer Wheel          │  │
          │                 │  │   (Deferred messages)     │  │
          │                 │  │   - Timeouts              │  │
          │                 │  │   - Retries               │  │
          │                 │  │   - Scheduled commands    │  │
          │                 │  └───────────────────────────┘  │
          │                 │              │                  │
          │                 │              ▼                  │
          │                 │  ┌───────────────────────────┐  │
          │                 │  │    Tick Algorithm         │  │
          │                 │  │    (Process one turn)     │  │
          │                 │  └───────────────────────────┘  │
          │                 │              │                  │
          │                 └──────────────┼──────────────────┘
          │                                │
          │         ┌──────────────────────┼──────────────────────┐
          │         │                      │                      │
          │         ▼                      ▼                      ▼
          │  ┌─────────────┐       ┌─────────────┐       ┌─────────────┐
          │  │  Capability │       │  Capability │       │  Capability │
          │  │   Actor A   │       │   Actor B   │       │   Actor C   │
          │  │  (Memory)   │       │   (Http)    │       │  (Crypto)   │
          │  │             │       │             │       │             │
          │  │ ┌─────────┐ │       │ ┌─────────┐ │       │ ┌─────────┐ │
          │  │ │ Mailbox │ │       │ │ Mailbox │ │       │ │ Mailbox │ │
          │  │ └─────────┘ │       │ └─────────┘ │       │ └─────────┘ │
          │  │      │      │       │      │      │       │      │      │
          │  │      ▼      │       │      ▼      │       │      ▼      │
          │  │  Handler    │       │  Handler    │       │  Handler    │
          │  │   Loop      │       │   Loop      │       │   Loop      │
          │  └─────────────┘       └─────────────┘       └─────────────┘
          │         │                      │                      │
          │         └──────────────────────┴──────────────────────┘
          │                                │
          │                       (message events)
          │                                │
          ▼                                ▼
   ┌──────────────┐                ┌──────────────┐
   │   Egress     │◀───────────────│   Validate   │
   │   (Write)    │                │   Outbound   │
   └──────────────┘                └──────────────┘
```

### 6.3 Priority Lanes (The Two-Queue Model)

The CQRS Event Loop maintains two priority lanes, mapping to the Web platform's Microtask/Macrotask separation:

#### 6.3.1 System Priority Lane (Microtask Equivalent)

**Purpose**: Internal control plane for kernel-level signals.

**Message Sources**:
- Actor faults (`Sys.ActorFault`)
- Routing errors (`Sys.RoutingError`)
- Schema validation errors (`Sys.SchemaError`)
- Internal bookkeeping signals

**Processing Rule**: The System Lane **MUST** be drained completely before processing any User Lane message.

**Rationale**: System health signals must never be starved by user traffic. If an Actor crashes, the Loop must handle it immediately.

#### 6.3.2 User Priority Lane (Macrotask Equivalent)

**Purpose**: External messages from Adapters and Actor outputs.

**Message Sources**:
- Inbound Commands from Adapters
- Inbound Queries from Adapters
- Inbound Events from Adapters or Actors
- Reply/Error messages from Actors

**Processing Rule**: Process one message, then check System Lane.

#### 6.3.3 Lane Selection Algorithm

```
function selectNextMessage():
  if SystemLane.isNotEmpty():
    return SystemLane.dequeue()    // Always prioritize system
  else if UserLane.isNotEmpty():
    return UserLane.dequeue()      // Then user messages
  else:
    return null                    // Idle
```

---

## 7. The Tick Algorithm (Event Loop Core)

This section specifies the core loop algorithm that processes messages.

### 7.1 Definition: A "Turn"

A **Turn** is one execution slice of the CQRS Event Loop, triggered by a single message arrival or timer firing.

A Turn consists of:

1. **Message Selection**: Pick the highest-priority pending message
2. **Validation**: Verify `OsMessageSchema` conformance
3. **Routing**: Resolve destination Actor(s) via routing laws
4. **Dispatch**: Deliver to Actor(s) via `postMessage`
5. **Bookkeeping**: Update correlation tables, enqueue egress frames
6. **Yield**: Return control to the runtime

### 7.2 The Tick Function (Pseudocode)

```typescript
async function tick(): Promise<void> {
  // Phase 1: Check timers and move ready timers to User Lane
  const now = Date.now();
  while (timerWheel.hasReadyTimer(now)) {
    const timerMsg = timerWheel.popReady(now);
    userLane.enqueue(timerMsg);
  }

  // Phase 2: Drain System Lane completely (Microtask semantics)
  while (systemLane.isNotEmpty()) {
    const sysMsg = systemLane.dequeue();
    await processSingleMessage(sysMsg);
  }

  // Phase 3: Process ONE User Lane message (Macrotask semantics)
  if (userLane.isNotEmpty()) {
    const userMsg = userLane.dequeue();
    await processSingleMessage(userMsg);
  }

  // Phase 4: Schedule next tick if work remains
  if (hasPendingWork()) {
    queueMicrotask(tick);  // Continue loop
  }
}

async function processSingleMessage(msg: OsMessage): Promise<void> {
  // 1. Validate
  const validation = OsMessageSchema.safeParse(msg);
  if (!validation.success) {
    emitToSystemLane(createSchemaError(msg, validation.error));
    return;
  }

  // 2. Route
  const destinations = resolveDestinations(msg);
  if (destinations.length === 0) {
    emitToSystemLane(createRoutingError(msg));
    return;
  }

  // 3. Dispatch
  for (const actor of destinations) {
    actor.postMessage(msg);
  }

  // 4. Bookkeeping (correlation tracking for request/reply)
  if (msg.kind === 'command' || msg.kind === 'query') {
    pendingRequests.set(msg.metadata.id, {
      timestamp: msg.metadata.timestamp,
      timeout: msg.metadata.timeout ?? DEFAULT_TIMEOUT,
    });
  }
}
```

### 7.3 The Main Loop (Lifecycle)

```typescript
async function runEventLoop(): Promise<void> {
  // Boot Phase
  await loadCapabilities();
  await buildRoutingIndexes();
  await spawnActors();
  await startAdapters();

  // Ready
  emitBootSummary();

  // Run Phase
  while (!shutdownRequested) {
    await tick();

    // Liveness check
    if (!hasPendingWork()) {
      if (daemonMode) {
        await waitForNewWork();  // Block until adapter receives data
      } else {
        break;  // Exit on quiescence
      }
    }
  }

  // Shutdown Phase
  await stopAdapters();
  await terminateActors();
  await flushEgress();
}
```

### 7.4 Liveness Conditions

The CQRS Event Loop remains alive while **any** of the following exist:

1. **Active Adapters**: At least one adapter can produce messages
2. **In-flight Correlations**: Pending requests awaiting Reply/Error
3. **Scheduled Timers**: Timer wheel has pending entries
4. **Buffered Egress**: Outbound frames not yet written

**Quiescence**: When all four conditions are false, the Loop may exit (batch mode) or idle (daemon mode).

---

## 8. Timer Subsystem (`setTimeout` for CQRS)

This section specifies the timer mechanism for deferred message execution.

### 8.1 Motivation

CQRS systems need deferred execution for:
- **Command timeouts**: Auto-cancel if no reply within deadline
- **Retry backoff**: Re-emit failed commands after delay
- **Scheduled commands**: Execute at a future time
- **Health ticks**: Periodic maintenance signals

### 8.2 The Timer Wheel Data Structure

The CQRS Event Loop uses a **Timer Wheel** (Hashed Timing Wheel algorithm):

```typescript
interface TimerEntry {
  id: string;              // Unique timer ID
  deadline: number;        // Unix epoch ms when timer fires
  message: OsMessage;      // Message to emit when timer fires
  kind: 'timeout' | 'scheduled' | 'retry';
}

interface TimerWheel {
  schedule(entry: TimerEntry): void;
  cancel(id: string): boolean;
  hasReadyTimer(now: number): boolean;
  popReady(now: number): OsMessage | null;
  nextDeadline(): number | null;
}
```

### 8.3 Timer Operations

#### 8.3.1 Schedule a Deferred Command

To execute a command after a delay:

```json
{
  "kind": "command",
  "type": "Timer.Schedule",
  "data": {
    "delay": 5000,
    "message": {
      "kind": "command",
      "type": "Memory.Cleanup",
      "data": { "olderThan": 3600000 },
      "metadata": { "id": "scheduled-001", "timestamp": 0 }
    }
  },
  "metadata": { "id": "timer-cmd-001", "timestamp": 1767910000000 }
}
```

**Behavior**:
1. Loop receives `Timer.Schedule` command
2. Loop computes `deadline = now + delay`
3. Loop inserts entry into Timer Wheel
4. Loop emits `Reply` with `{ timerId: "..." }`
5. After `delay` ms, the inner `message` is emitted to User Lane

#### 8.3.2 Request Timeout (Automatic)

For Commands/Queries, the Loop **MAY** automatically schedule a timeout:

```typescript
// When dispatching a command
const timeout = msg.metadata.timeout ?? DEFAULT_TIMEOUT;
timerWheel.schedule({
  id: `timeout-${msg.metadata.id}`,
  deadline: Date.now() + timeout,
  message: {
    kind: 'error',
    type: 'Sys.Timeout',
    data: { originalId: msg.metadata.id, message: 'Request timed out' },
    metadata: {
      id: generateId(),
      timestamp: Date.now(),
      causation: msg.metadata.id,
      correlation: msg.metadata.correlation,
    },
  },
  kind: 'timeout',
});

// When reply/error arrives, cancel the timeout
timerWheel.cancel(`timeout-${reply.metadata.causation}`);
```

#### 8.3.3 Cancel a Scheduled Timer

```json
{
  "kind": "command",
  "type": "Timer.Cancel",
  "data": { "timerId": "timer-123" },
  "metadata": { "id": "cancel-001", "timestamp": 1767910000000 }
}
```

### 8.4 Timer Integration with Tick Algorithm

Timers integrate into the tick as shown in Section 7.2:

1. At the start of each tick, check for ready timers
2. Move ready timer messages to User Lane
3. Process normally via routing

**Key Property**: Timer-emitted messages go through the **same routing path** as adapter-ingested messages. No special handling required.

### 8.5 Timer Precision Guarantees

**Guarantee**: Timer messages will be emitted **no earlier than** the specified deadline.

**Non-Guarantee**: Timer messages may be delayed if:
- The User Lane is congested
- A long-running Actor handler blocks (should not happen with async model)
- System Lane has many pending signals

This matches Web platform semantics exactly.

---

## 9. Routing Laws

This section specifies how messages are routed based on their `kind`.

### 9.1 Routing by `kind`

| Kind | Intent | Routing Rule | Expected Output |
|------|--------|--------------|-----------------|
| `command` | Request effectful operation | Exactly one Actor | Reply OR Error (+ optional Events) |
| `query` | Request data (no side effects) | Exactly one Actor | Reply OR Error |
| `event` | Notify fact occurred | Fan-out to subscribers | None required |
| `reply` | Answer to command/query | Route to requester | N/A (terminal) |
| `error` | Failure notification | Route to requester OR error sink | N/A (terminal) |

### 9.2 Command Routing

```
GIVEN: OsMessage with kind="command", type="Memory.Set"
LOOKUP: handlersIndex[("command", "Memory.Set")]
RESULT: Exactly one Capability Actor
ACTION: actor.postMessage(msg)
```

**Constraint**: If no handler exists, emit `Sys.RoutingError` to System Lane.

### 9.3 Query Routing

Same as Command routing. The distinction is semantic (no mutation), not structural.

### 9.4 Event Fan-out

```
GIVEN: OsMessage with kind="event", type="Memory.Changed"
LOOKUP: subscriptionsIndex["Memory.Changed"]
RESULT: Array of Capability Actors (0..N)
ACTION: for each actor: actor.postMessage(msg)
```

**Constraint**: Events do **not** require Reply. Actors **MAY** emit follow-up Events or Commands.

### 9.5 Reply/Error Routing

```
GIVEN: OsMessage with kind="reply", metadata.causation="cmd-123"
LOOKUP: pendingRequests.get("cmd-123")
RESULT: Connection context for original request
ACTION: 
  1. Write NDJSON frame to connection
  2. Remove from pendingRequests
  3. Cancel associated timeout timer
```

---

## 10. Lineage and Correlation Rules

This section specifies how messages are linked for tracing and request/reply matching.

### 10.1 Required Metadata Fields

Every `OsMessage` **MUST** include:

| Field | Type | Description |
|-------|------|-------------|
| `metadata.id` | string | Globally unique message identifier |
| `metadata.timestamp` | number | Unix epoch milliseconds |

### 10.2 Causation (Direct Parent)

**Definition**: `metadata.causation` identifies the **direct parent** message that caused this message.

**Rule**: Any message emitted as a consequence of handling an inbound message **MUST** set:
```
outbound.metadata.causation = inbound.metadata.id
```

**Use Case**: Request/Reply matching. Reply answers Request when:
```
reply.metadata.causation === request.metadata.id
```

### 10.3 Correlation (Workflow Grouping)

**Definition**: `metadata.correlation` groups all messages in a logical workflow/session.

**Rule**: If inbound has `correlation`, outbound **SHOULD** preserve it unchanged.

**Use Case**: Distributed tracing across multiple Commands/Events.

### 10.4 Terminality

For Command/Query, exactly one of the following **MUST** occur:
- A `reply` is produced (success), OR
- An `error` is produced (failure)

The CQRS Event Loop **MUST** resolve the pending request when it observes a terminal message with matching causation.

---

## 11. Capability Actor Contract

This section specifies the interface between the CQRS Event Loop and Capability Actors.

### 11.1 The Capability Export Interface

```typescript
interface Capability<I extends z.ZodTypeAny, O extends z.ZodTypeAny> {
  /**
   * Human-readable description for LLM introspection.
   */
  description: string;

  /**
   * Zod schema for inbound messages.
   * MUST contain discoverable literals for `kind` and `type`.
   */
  inbound: I;

  /**
   * Zod schema for outbound messages.
   */
  outbound: O;

  /**
   * Optional: Event types this capability subscribes to.
   */
  subscribes?: string[];

  /**
   * Factory function that creates a Worker-shaped actor.
   */
  spawn: () => CapabilityActor;
}
```

### 11.2 The CapabilityActor Interface (W3C Worker-Aligned)

```typescript
interface CapabilityActor extends EventTarget {
  /**
   * Send a message to the actor's mailbox.
   * Non-blocking; returns immediately.
   * W3C: Worker.postMessage()
   */
  postMessage(message: OsMessage): void;

  /**
   * Handler for outbound messages from the actor.
   * W3C: Worker.onmessage
   */
  onmessage: ((event: MessageEvent<OsMessage>) => void) | null;

  /**
   * Handler for actor errors.
   * W3C: Worker.onerror
   */
  onerror: ((event: ErrorEvent) => void) | null;

  /**
   * Terminate the actor.
   * W3C: Worker.terminate()
   */
  terminate(): void;
}
```

### 11.3 Actor Implementation: Buffered Async Mailbox

To ensure non-blocking dispatch, the MVP Actor implementation uses an async mailbox:

```typescript
function createBufferedActor(handler: MessageHandler): CapabilityActor {
  const mailbox: OsMessage[] = [];
  let processing = false;
  const listeners = new Map<string, Function[]>();

  const actor: CapabilityActor = {
    postMessage(message: OsMessage): void {
      // Non-blocking: just enqueue
      mailbox.push(message);
      scheduleProcessing();
    },

    onmessage: null,
    onerror: null,

    terminate(): void {
      mailbox.length = 0;  // Clear pending
      processing = false;
    },

    // EventTarget methods
    addEventListener(type: string, callback: Function): void {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type)!.push(callback);
    },
    removeEventListener(type: string, callback: Function): void {
      const cbs = listeners.get(type);
      if (cbs) {
        const idx = cbs.indexOf(callback);
        if (idx >= 0) cbs.splice(idx, 1);
      }
    },
    dispatchEvent(event: Event): boolean {
      const cbs = listeners.get(event.type) || [];
      for (const cb of cbs) cb(event);
      if (event.type === 'message' && actor.onmessage) {
        actor.onmessage(event as MessageEvent<OsMessage>);
      }
      return true;
    },
  };

  async function scheduleProcessing(): Promise<void> {
    if (processing) return;
    processing = true;

    // Detached async loop (floating promise)
    queueMicrotask(async () => {
      while (mailbox.length > 0 && processing) {
        const msg = mailbox.shift()!;
        try {
          const outputs = await handler(msg);
          for (const out of outputs) {
            actor.dispatchEvent(new MessageEvent('message', { data: out }));
          }
        } catch (err) {
          actor.dispatchEvent(new ErrorEvent('error', { error: err }));
        }
      }
      processing = false;
    });
  }

  return actor;
}

type MessageHandler = (msg: OsMessage) => Promise<OsMessage[]>;
```

**Key Properties**:
- `postMessage` returns immediately (non-blocking)
- Messages are processed serially (FIFO)
- Outputs are emitted as `message` events
- Errors are emitted as `error` events (supervisor handles)

### 11.4 Outbound Validation Rules

Every outbound message **MUST**:
1. Validate against `OsMessageSchema`
2. Validate against the capability's `outbound` schema
3. Set `metadata.causation` to the inbound message ID
4. Preserve `metadata.correlation` if present

Violations trigger `Sys.ActorFault` to System Lane.

---

## 12. Schema-Based Capability Discovery

This section specifies how the CQRS Event Loop discovers routing handles from Zod schemas.

### 12.1 Discoverable Schema Forms

A capability's `inbound` schema is **discoverable** if it can be reduced to a finite set of `(kind, type)` pairs.

**Allowed Forms**:

```typescript
// Form A: Single literal pair
z.object({
  kind: z.literal("command"),
  type: z.literal("Memory.Set"),
  // ...
})

// Form B: Single kind, union of types
z.object({
  kind: z.literal("query"),
  type: z.union([z.literal("Memory.Get"), z.literal("Memory.List")]),
})

// Form C: Union of message objects (preferred)
z.union([
  z.object({ kind: z.literal("command"), type: z.literal("Memory.Set"), ... }),
  z.object({ kind: z.literal("query"), type: z.literal("Memory.Get"), ... }),
])
```

**Rejected Forms**:

```typescript
// Infinite type (non-enumerable)
z.object({
  kind: z.literal("command"),
  type: z.string(),  // ❌ Not finite
})

// Regex constraint (still infinite)
z.object({
  kind: z.literal("command"),
  type: z.string().regex(/^Memory\./),  // ❌ Not enumerable
})
```

### 12.2 Discovery Algorithm

```typescript
function discoverHandles(schema: z.ZodTypeAny): Array<{kind: string, type: string}> {
  const handles: Array<{kind: string, type: string}> = [];

  // Normalize to array of branches
  const branches = schema instanceof z.ZodUnion 
    ? schema.options 
    : [schema];

  for (const branch of branches) {
    const shape = branch.shape;
    
    // Extract kind literal
    const kindDef = shape.kind;
    if (!(kindDef instanceof z.ZodLiteral)) {
      throw new Error('kind must be a literal');
    }
    
    // Extract type literal(s)
    const typeDef = shape.type;
    const types = typeDef instanceof z.ZodLiteral 
      ? [typeDef.value]
      : typeDef instanceof z.ZodUnion
        ? typeDef.options.map(o => o.value)
        : null;
    
    if (!types) {
      throw new Error('type must be literal or union of literals');
    }

    for (const type of types) {
      handles.push({ kind: kindDef.value, type });
    }
  }

  return handles;
}
```

### 12.3 Index Building at Boot

```typescript
const handlersIndex = new Map<string, string>();  // "(kind,type)" -> capabilityId
const subscriptionsIndex = new Map<string, string[]>();  // type -> [capabilityId...]

function buildIndexes(capabilities: Map<string, Capability>): void {
  for (const [capId, cap] of capabilities) {
    // Build handlers index
    const handles = discoverHandles(cap.inbound);
    for (const { kind, type } of handles) {
      const key = `${kind}:${type}`;
      if (handlersIndex.has(key)) {
        throw new Error(`Duplicate handler for ${key}`);
      }
      handlersIndex.set(key, capId);
    }

    // Build subscriptions index
    for (const eventType of cap.subscribes ?? []) {
      if (!subscriptionsIndex.has(eventType)) {
        subscriptionsIndex.set(eventType, []);
      }
      subscriptionsIndex.get(eventType)!.push(capId);
    }
  }
}
```

---

## 13. NDJSON Adapter Contract

This section specifies the Unix socket adapter for MVP.

### 13.1 Frame Format

Each line is one `OsMessage` serialized as JSON:

```
{"kind":"command","type":"Memory.Set","data":{...},"metadata":{...}}\n
{"kind":"reply","type":"Memory.Set","data":{...},"metadata":{...}}\n
```

### 13.2 Adapter Responsibilities

The adapter **MUST**:
- Read line-delimited JSON frames from socket
- Parse and validate against `OsMessageSchema`
- Deliver valid messages to CQRS Event Loop ingress
- Write outbound Reply/Error frames back to originating connection
- Apply backpressure when write buffer is full

The adapter **MUST NOT**:
- Implement routing logic
- Execute business logic
- Modify message semantics

### 13.3 Reply Matching

The adapter maintains a connection→request map:

```typescript
const pendingByConnection = new Map<ConnectionId, Set<MessageId>>();

// On inbound command/query
pendingByConnection.get(connId).add(msg.metadata.id);

// On outbound reply/error
const originalId = reply.metadata.causation;
for (const [connId, pending] of pendingByConnection) {
  if (pending.has(originalId)) {
    writeToConnection(connId, reply);
    pending.delete(originalId);
    break;
  }
}
```

---

## 14. Boot Procedure

This section specifies the CQRS Event Loop startup sequence.

### 14.1 Boot Phases

```
1. LOAD        Load capability modules
2. DISCOVER    Extract routing handles from schemas
3. BUILD       Build handler and subscription indexes
4. SPAWN       Create actor instances
5. ATTACH      Bind outbound listeners
6. ADAPT       Start transport adapters
7. READY       Emit boot summary, begin processing
```

### 14.2 Boot Summary Output

On successful boot, emit a structured summary:

```json
{
  "kind": "event",
  "type": "Sys.BootComplete",
  "data": {
    "capabilities": [
      { "id": "Memory", "handles": ["command:Memory.Set", "query:Memory.Get"] },
      { "id": "Http", "handles": ["command:Http.Fetch"] }
    ],
    "subscriptions": {
      "Memory.Changed": ["Audit", "Metrics"]
    },
    "adapters": ["unix:/tmp/pwos.sock"],
    "timers": { "defaultTimeout": 30000 }
  },
  "metadata": { "id": "boot-001", "timestamp": 1767910000000 }
}
```

### 14.3 Boot Failure Handling

If any boot phase fails:
1. Emit `Sys.BootFailed` error with details
2. Terminate any partially-spawned actors
3. Exit with non-zero code

---

## 15. Supervision and Fault Handling

This section specifies how the Loop handles Actor faults.

### 15.1 Fault Categories

| Fault | Trigger | Response |
|-------|---------|----------|
| `Sys.ActorFault` | Actor emits invalid message | Restart actor, emit error |
| `Sys.ActorCrash` | Actor throws uncaught exception | Restart actor, emit error |
| `Sys.Timeout` | Request not answered within deadline | Emit timeout error, cancel pending |
| `Sys.RoutingError` | No handler for (kind, type) | Emit error, do not retry |
| `Sys.SchemaError` | Message fails validation | Emit error, do not dispatch |

### 15.2 Restart Policy (MVP)

```typescript
interface RestartPolicy {
  maxRestarts: number;      // Max restarts within window
  windowMs: number;         // Window duration
  backoffMs: number;        // Delay between restarts
}

const DEFAULT_POLICY: RestartPolicy = {
  maxRestarts: 3,
  windowMs: 60000,
  backoffMs: 1000,
};
```

### 15.3 Restart Procedure

```typescript
async function handleActorFault(capId: string, error: Error): Promise<void> {
  // 1. Emit fault to System Lane
  emitToSystemLane({
    kind: 'error',
    type: 'Sys.ActorFault',
    data: { capabilityId: capId, message: error.message },
    metadata: { id: generateId(), timestamp: Date.now() },
  });

  // 2. Check restart budget
  const history = restartHistory.get(capId) ?? [];
  const recentRestarts = history.filter(t => t > Date.now() - policy.windowMs);
  
  if (recentRestarts.length >= policy.maxRestarts) {
    // Mark unhealthy, route future messages to error sink
    unhealthyCapabilities.add(capId);
    return;
  }

  // 3. Restart with backoff
  await delay(policy.backoffMs);
  const cap = capabilities.get(capId)!;
  const newActor = cap.spawn();
  attachListeners(capId, newActor);
  actors.set(capId, newActor);
  restartHistory.set(capId, [...recentRestarts, Date.now()]);
}
```

---

## 16. End-to-End Flow Examples

### 16.1 Command → Reply (with Events)

```
1. Adapter receives NDJSON: {"kind":"command","type":"Memory.Set",...}
2. Loop validates schema ✓
3. Loop routes: handlersIndex["command:Memory.Set"] → "Memory"
4. Loop dispatches: actors["Memory"].postMessage(msg)
5. Actor "Memory" handles:
   a. Emits event: {"kind":"event","type":"Memory.Changed",...}
   b. Emits reply: {"kind":"reply","type":"Memory.Set",...}
6. Loop receives event, fans out to subscribers
7. Loop receives reply, matches by causation, writes to connection
```

### 16.2 Query → Reply

```
1. Adapter receives: {"kind":"query","type":"Memory.Get",...}
2. Loop validates, routes to "Memory"
3. Actor "Memory" emits: {"kind":"reply","type":"Memory.Get","data":{"value":"..."},...}
4. Loop matches by causation, writes reply to connection
```

### 16.3 Scheduled Command (Timer)

```
1. Adapter receives: {"kind":"command","type":"Timer.Schedule","data":{"delay":5000,"message":{...}}}
2. Loop handles Timer.Schedule:
   a. Extracts inner message
   b. Inserts into timer wheel with deadline = now + 5000
   c. Emits reply with timerId
3. After 5000ms:
   a. tick() checks timer wheel
   b. Moves ready timer message to User Lane
   c. Routes inner message normally
```

### 16.4 Request Timeout

```
1. Adapter receives command, Loop dispatches to Actor
2. Loop schedules timeout timer (30s default)
3. Actor is slow / stuck
4. After 30s, timer fires
5. Loop emits: {"kind":"error","type":"Sys.Timeout","data":{"originalId":"..."},...}
6. Loop writes timeout error to connection
7. (When actor eventually replies, it's discarded - request already terminated)
```

---

## 17. Compatibility

### 17.1 PromptWar̊e ØS RFCs

This RFC builds upon:

- **RFC 0015 (Dual-Mode Architecture)**: Defines the PromptWare/Software Kernel split
- **RFC 0024 (CQRS Message Schema)**: Defines `OsMessage` envelope and NDJSON protocol
- **RFC 0031 (System Capability Modules)**: Defines the `Capability` interface

### 17.2 External Standards

This RFC aligns with:

- **WHATWG HTML Living Standard**: Event loop, Worker semantics
- **W3C Web Workers**: `postMessage`, `onmessage`, `terminate`
- **Deno Runtime**: JsRuntime, Tokio integration
- **CQRS Pattern**: Command/Query segregation
- **CloudEvents**: Message envelope inspiration

---

## 18. Security Considerations

### 18.1 Trust Model

PromptWar̊e ØS operates under **Maximum Trust**:
- AI co-founders have full system access
- No authentication/authorization in message routing
- Reliability is the primary concern, not security isolation

### 18.2 Reliability Measures

Even under maximum trust, the system enforces:
- **Schema validation**: Malformed messages are rejected
- **Idempotency**: Same message ID → same handling
- **Timeout enforcement**: Requests cannot hang forever
- **Actor supervision**: Faulty actors are restarted

---

## 19. Implementation Plan

### 19.1 Reference Implementation

**Location**: `os/kernel/bus/event-loop.ts`
**Language**: TypeScript (Deno)

### 19.2 Modules

| Module | Responsibility |
|--------|----------------|
| `event-loop.ts` | Main loop, tick algorithm |
| `priority-lanes.ts` | System/User queue management |
| `timer-wheel.ts` | Timer scheduling and firing |
| `router.ts` | Handler/subscription index lookup |
| `actor-manager.ts` | Spawn, supervise, restart actors |
| `adapter-ndjson.ts` | Unix socket NDJSON transport |

### 19.3 Test Coverage

Required tests:
- Priority lane ordering (System before User)
- Timer precision (fires no earlier than deadline)
- Causation linking (reply matches request)
- Actor restart (fault → restart → healthy)
- Schema rejection (invalid messages → error)

---

## 20. Future Directions

### 20.1 Worker Isolation (Phase 2)

Replace duck-typed actors with real Deno Workers:
- True memory isolation
- Crash containment
- CPU scheduling via OS

### 20.2 Durable Queues (Phase 2)

Replace in-memory lanes with persistent log:
- Crash recovery
- Replay capability
- Audit trail

### 20.3 Distributed Routing (Phase 3)

Extend to multi-node deployment:
- Message partitioning
- Actor placement
- Cluster coordination

---

## 21. Glossary

| Term | Definition |
|------|------------|
| **CQRS Event Loop** | The central message router/scheduler for PromptWar̊e ØS |
| **Turn** | One execution slice processing a single message |
| **System Lane** | High-priority queue for kernel signals (Microtask equivalent) |
| **User Lane** | Normal-priority queue for external messages (Macrotask equivalent) |
| **Capability Actor** | Worker-shaped message handler with mailbox |
| **Timer Wheel** | Data structure for efficient timer scheduling |
| **Causation** | Link from effect message to cause message |
| **Correlation** | Workflow grouping identifier |

---

## 22. References

### PromptWar̊e ØS References

- [RFC 0015: Kernel DualMode Architecture](0015-kernel-dualmode-architecture.md)
- [RFC 0024: CQRS Message Schema](0024-cqrs-message-schema.md)
- [RFC 0031: System Capability Modules](0031-system-capability-modules.md)

### External References

- [WHATWG HTML Living Standard - Event Loops](https://html.spec.whatwg.org/multipage/webappapis.html#event-loops)
- [WHATWG HTML Living Standard - Web Workers](https://html.spec.whatwg.org/multipage/workers.html)
- [Deno Manual - Runtime](https://deno.land/manual/runtime)
- [Tokio - Rust Async Runtime](https://tokio.rs/)
- [Hashed Timing Wheel Algorithm](http://www.cs.columbia.edu/~nahum/w6998/papers/ton97-timing-wheels.pdf)

---

*End of RFC 0032*

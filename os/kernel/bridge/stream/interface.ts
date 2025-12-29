/**
 * os/kernel/bridge/stream/interface.ts
 *
 * Defines the contract for Syscall Streams in the Reactive Kernel Architecture.
 *
 * Philosophy:
 * - Autonomous: Syscalls do not receive injected context. They access the Kernel Core directly.
 * - Pure Streams: Everything is a TransformStream<OsEvent, OsEvent>.
 */

import { OsEvent } from "../../lib/event.ts";

/**
 * A SyscallStream is a standard Web TransformStream.
 *
 * It accepts a stream of OsEvents (typically Commands) and emits a stream
 * of OsEvents (typically Responses or Events).
 *
 * Usage:
 * ```ts
 * const mySyscall: SyscallStream = new TransformStream({
 *   transform(event, controller) {
 *     // Process event using Kernel Core (os/kernel/core/...)
 *     controller.enqueue(createEvent("response", event.type, result));
 *   }
 * });
 * ```
 */
export type SyscallStream = TransformStream<OsEvent, OsEvent>;

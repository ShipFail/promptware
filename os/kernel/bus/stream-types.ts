/**
 * os/kernel/bus/stream/interface.ts
 *
 * Defines the contract for Bus Streams in the Reactive Kernel Architecture.
 *
 * Philosophy:
 * - Autonomous: Capabilities do not receive injected context. They access the Kernel Core directly.
 * - Pure Streams: Everything is a TransformStream<OsMessage, OsMessage>.
 */

import { OsMessage } from "../schema/message.ts";

/**
 * A BusStream is a standard Web TransformStream.
 *
 * It accepts a stream of OsMessages (typically Commands) and emits a stream
 * of OsMessages (typically Responses or Events).
 *
 * Usage:
 * ```ts
 * const myStream: BusStream = new TransformStream({
 *   transform(message, controller) {
 *     // Process message
 *     controller.enqueue(createResponse(message, result));
 *   }
 * });
 * ```
 */
export type BusStream = TransformStream<OsMessage, OsMessage>;

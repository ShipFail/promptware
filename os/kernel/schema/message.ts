/**
 * os/kernel/protocol/message.ts
 *
 * The Atomic Unit of the PromptWare OS Kernel.
 * Defines the OsMessage schema, factory functions, and metadata helpers.
 *
 * Adheres to:
 * 1. CQRS (Command/Query Responsibility Segregation)
 * 2. Event Sourcing with Correlation/Causation Lineage
 * 3. CloudEvents / EventStoreDB Standards
 * 4. STOP Protocol (Semantic Token Optimization Protocol)
 */

import { z } from "jsr:@zod/zod";
import { id8 } from "../lib/id8.ts";

/**
 * Zod Schema for OsMessage (Single Source of Truth).
 *
 * Behavioral envelope kinds:
 * - command: "Do this" (State Mutation)
 * - query: "Get this" (State Retrieval / Read-Only)
 * - event: "This happened" (Domain Event / Notification)
 * - reply: "Here is the outcome" (Success Response)
 * - error: "This failed" (Error Response)
 *
 * Aligns with CloudEvents, EventStoreDB, and JSON:API standards.
 */
export const OsMessageSchema = z.object({
  kind: z
    .enum(["command", "query", "event", "reply", "error"])
    .describe("Behavioral envelope kind"),
  type: z
    .string()
    .describe("Domain message type in dot notation (e.g. Memory.Set, Crypto.Seal)"),
  data: z
    .unknown()
    .describe("Data payload or error object"),
  metadata: z
    .object({
      id: z.string().describe("Unique message ID"),
      timestamp: z.number().describe("Unix epoch ms"),
      correlation: z.string().optional().describe("Workflow/session correlation ID"),
      causation: z.string().optional().describe("Direct parent message ID"),
    })
    .optional()
    .describe("Message metadata for routing, tracing, and lineage"),
});

/**
 * TypeScript type derived from Zod schema.
 * Ensures type and runtime validation are always in sync.
 */
export type OsMessage<T = unknown> = Omit<z.infer<typeof OsMessageSchema>, "data"> & {
  data: T;
};

/**
 * Specialized types for CQRS semantics.
 */
export type Command<T = unknown> = OsMessage<T> & { kind: "command" };
export type Query<T = unknown> = OsMessage<T> & { kind: "query" };
export type Event<T = unknown> = OsMessage<T> & { kind: "event" };
export type Reply<T = unknown> = OsMessage<T> & { kind: "reply" };
export type ErrorMessage = OsMessage<Error | { message: string }> & { kind: "error" };

/**
 * Helper to create a standard message.
 */
export function createMessage<T>(
  kind: OsMessage<T>["kind"],
  type: string,
  data: T,
  id?: string,
  correlation?: string,
  causation?: string
): OsMessage<T> {
  return {
    kind,
    type,
    data,
    metadata: {
      id: id || id8(),
      timestamp: Date.now(),
      correlation,
      causation,
    },
  };
}

export function createCommand<T>(type: string, data: T, id?: string): Command<T> {
  return createMessage("command", type, data, id) as Command<T>;
}

export function createQuery<T>(type: string, data: T, id?: string): Query<T> {
  return createMessage("query", type, data, id) as Query<T>;
}

export function createEvent<T>(type: string, data: T, id?: string): Event<T> {
  return createMessage("event", type, data, id) as Event<T>;
}

export function createReply<T>(original: OsMessage, data: T): Reply<T> {
  return {
    kind: "reply",
    type: original.type,
    data,
    metadata: {
      id: id8(),
      timestamp: Date.now(),
      correlation: original.metadata?.correlation,
      causation: original.metadata?.id,
    },
  };
}

/**
 * Helper to create an error message from an existing message.
 */
export function createError(
  original: OsMessage,
  error: Error | string
): OsMessage<Error | { message: string }> {
  return {
    kind: "error",
    type: original.type,
    data: error instanceof Error ? error : { message: error },
    metadata: {
      id: id8(),
      timestamp: Date.now(),
      correlation: original.metadata?.correlation,
      causation: original.metadata?.id,
    },
  };
}

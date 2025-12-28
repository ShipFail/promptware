/**
 * os/kernel/events.ts
 *
 * The Atomic Unit of the PromptWare OS Kernel.
 * Defines the Event Schema for the Reactive Kernel Architecture.
 *
 * Adheres to:
 * 1. CQRS (Command/Query Responsibility Segregation)
 * 2. Event Sourcing with Correlation/Causation Lineage
 * 3. CloudEvents / EventStoreDB Standards
 * 4. STOP Protocol (Semantic Token Optimization Protocol)
 */

import { z } from "jsr:@zod/zod";
import { shortId8 } from "./core/id8.ts";

/**
 * Zod Schema for OsEvent (Single Source of Truth).
 *
 * Behavioral envelope types:
 * - command: "Do this" (State Mutation)
 * - query: "Get this" (State Retrieval / Read-Only)
 * - event: "This happened" (Domain Event / Notification)
 * - response: "Here is the outcome" (Success Response)
 * - error: "This failed" (Error Response)
 *
 * Aligns with CloudEvents, EventStoreDB, and JSON:API standards.
 */
export const OsEventSchema = z.object({
  type: z
    .enum(["command", "query", "event", "response", "error"])
    .describe("Behavioral envelope type"),
  name: z
    .string()
    .describe("Domain event name in dot notation (e.g. Memory.Set, Crypto.Seal)"),
  payload: z
    .unknown()
    .describe("Data payload or error object"),
  metadata: z
    .object({
      id: z.string().describe("Unique event ID"),
      timestamp: z.number().describe("Unix epoch ms"),
      correlation: z.string().optional().describe("Workflow/session correlation ID"),
      causation: z.string().optional().describe("Direct parent event ID"),
    })
    .optional()
    .describe("Event metadata for routing, tracing, and lineage"),
});

/**
 * TypeScript type derived from Zod schema.
 * Ensures type and runtime validation are always in sync.
 */
export type OsEvent<T = unknown> = Omit<z.infer<typeof OsEventSchema>, "payload"> & {
  payload: T;
};

/**
 * Helper to create a standard event.
 */
export function createEvent<T>(
  type: OsEvent<T>["type"],
  name: string,
  payload: T,
  id?: string,
  correlation?: string,
  causation?: string
): OsEvent<T> {
  return {
    type,
    name,
    payload,
    metadata: {
      id: id || shortId8(),
      timestamp: Date.now(),
      correlation,
      causation,
    },
  };
}

/**
 * Helper to create an error event from an existing event.
 */
export function createError(
  original: OsEvent,
  error: Error | string
): OsEvent<Error | { message: string }> {
  return {
    type: "error",
    name: original.name,
    payload: error instanceof Error ? error : { message: error },
    metadata: {
      id: shortId8(),
      timestamp: Date.now(),
      correlation: original.metadata?.correlation,
      causation: original.metadata?.id,
    },
  };
}

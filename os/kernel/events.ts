/**
 * os/kernel/events.ts
 *
 * The Atomic Unit of the PromptWare OS Kernel.
 * Defines the Event Schema for the Pipe-Kernel Architecture.
 *
 * Adheres to:
 * 1. CQRS (Command/Query Responsibility Segregation)
 * 2. Flux Standard Action (FSA)
 * 3. STOP Protocol (Semantic Token Optimization Protocol)
 */

import { z } from "jsr:@zod/zod";

/**
 * The Universal Message Shape.
 *
 * @template T - The type of the payload.
 */
export interface OsEvent<T = unknown> {
  /**
   * CQRS Discriminator.
   * - command: "Do this" (State Mutation)
   * - query: "Get this" (State Retrieval)
   * - response: "Here is the result" (RPC/Return)
   * - event: "This happened" (Notification/Log)
   */
  kind: "command" | "query" | "response" | "event";

  /**
   * The Domain Topic.
   * Follows Redux style: "domain/action"
   * Examples: "fs/read", "memory/set", "kernel/boot"
   */
  type: string;

  /**
   * The Data.
   * Follows Flux Standard Action (FSA).
   * If error is true, this MUST be an Error object or error-like shape.
   */
  payload: T;

  /**
   * Meta-information for the Kernel (Routing, Tracing).
   * Optimized for STOP Protocol (Semantic Clarity).
   */
  metadata?: {
    /**
     * Unique identifier for this specific message instance.
     * Used for distributed tracing and log correlation.
     */
    id: string;

    /**
     * Unix epoch timestamp (milliseconds).
     * "timestamp" is semantically unambiguous compared to "ts".
     */
    timestamp: number;

    /**
     * The ID of the message that caused this one.
     * Essential for causal chains in CQRS.
     */
    reference?: string;
  };

  /**
   * Error Flag (FSA Standard).
   * If true, payload is an Error object.
   * Used to preserve the original intent (kind) while signaling failure.
   */
  error?: boolean;
}

/**
 * Zod Schema for Runtime Validation.
 * Matches the OsEvent interface.
 */
export const OsEventSchema = z.object({
  kind: z
    .enum(["command", "query", "response", "event"])
    .describe("CQRS intent discriminator"),
  type: z.string().describe("Domain topic (e.g. fs/read)"),
  payload: z.unknown().describe("Data content or error object"),
  metadata: z
    .object({
      id: z.string().describe("Unique message ID"),
      timestamp: z.number().describe("Unix epoch ms"),
      reference: z.string().optional().describe("Causal parent ID"),
    })
    .optional()
    .describe("Routing and tracing info"),
  error: z.boolean().optional().describe("True if payload is error"),
});

/**
 * Helper to create a standard message.
 */
export function createEvent<T>(
  kind: OsEvent<T>["kind"],
  type: string,
  payload: T,
  id?: string,
  reference?: string
): OsEvent<T> {
  return {
    kind,
    type,
    payload,
    metadata: {
      id: id || crypto.randomUUID(),
      timestamp: Date.now(),
      reference,
    },
  };
}

/**
 * Helper to create an error response from an existing message.
 */
export function createError(
  original: OsEvent,
  error: Error | string
): OsEvent<Error | { message: string }> {
  return {
    kind: original.kind, // Preserve original intent
    type: original.type,
    payload: error instanceof Error ? error : { message: error },
    error: true,
    metadata: {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      reference: original.metadata?.id,
    },
  };
}

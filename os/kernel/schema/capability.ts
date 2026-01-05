import { z } from "jsr:@zod/zod";
import { OsMessage } from "./message.ts";

/**
 * A Capability defines the strict contract for a kernel feature.
 * It exports Zod schemas for input/output and a processor stream.
 * This allows the kernel to:
 * 1. Validate inputs before execution.
 * 2. Introspect capabilities for the LLM (via Sys.Describe).
 * 3. Guarantee output structure.
 * 4. Enforce CQRS semantics (command vs query) via Schema.
 */
export interface Capability<I extends z.ZodTypeAny, O extends z.ZodTypeAny> {
  /**
   * Human-readable description for LLM introspection.
   */
  description: string;

  /**
   * The Zod schema for the inbound message (Command/Query).
   * MUST include .describe() for LLM introspection.
   * MUST validate `kind` (command|query) and `type` (e.g. Memory.Get).
   */
  inbound: I;

  /**
   * The Zod schema for the outbound message (Reply/Event).
   * MUST include .describe() for LLM introspection.
   */
  outbound: O;

  /**
   * The reactive processor factory.
   * Returns a fresh TransformStream that accepts Inbound OsMessages and emits Outbound OsMessages.
   * This allows the kernel to manage the lifecycle (e.g., restart on error).
   */
  factory: () => TransformStream<OsMessage, OsMessage>;
}

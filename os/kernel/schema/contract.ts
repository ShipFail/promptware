import { z } from "jsr:@zod/zod";
import { OsMessage } from "./message.ts";

/**
 * A Capability defines the strict contract for a kernel feature.
 * It exports Zod schemas for input/output and a process function.
 * This allows the kernel to:
 * 1. Validate inputs before execution.
 * 2. Introspect capabilities for the LLM (via Sys.Describe).
 * 3. Guarantee output structure.
 * 4. Enforce CQRS semantics (command vs query).
 */
export interface Capability<I extends z.ZodTypeAny, O extends z.ZodTypeAny> {
  /**
   * CQRS type discriminator (REQUIRED).
   * - "command": Mutates state, has side effects (e.g., Memory.Set, Http.Fetch)
   * - "query": Read-only, idempotent (e.g., Memory.Get, Echo)
   *
   * Note: Capabilities can only be command or query. The event/response/error types
   * are reserved for the event envelope, not capability classification.
   *
   * Used for documentation, introspection, and semantic routing.
   */
  type: "command" | "query";

  /**
   * The Zod schema for the input arguments.
   * MUST include .describe() for LLM introspection.
   */
  InputSchema: I;

  /**
   * The Zod schema for the output data.
   * MUST include .describe() for LLM introspection.
   */
  OutputSchema: O;

  /**
   * The implementation of the capability.
   * @param input The validated input data.
   * @param message The original OsMessage (for context/tracing).
   * @returns A promise resolving to the validated output data.
   */
  process: (input: z.infer<I>, message: OsMessage) => Promise<z.infer<O>>;

  /**
   * Optional factory to convert CLI arguments (string array) to the InputSchema.
   * Used when the kernel receives a shell-style command (array payload) for this capability.
   */
  fromArgs?: (args: string[]) => z.infer<I>;
}

/**
 * os/kernel/capabilities/ping.ts
 *
 * ABI Integrity Test Handler (RFC-6455 PING/PONG Semantics)
 *
 * Purpose: Prove the syscall bridge and framing work correctly.
 * - No payload mutation
 * - No truncation
 * - Correct correlation/causation lineage
 *
 * Per RFC 6455 Section 5.5.3:
 * "A Pong frame sent in response to a Ping frame MUST have identical
 *  Application Data as found in the message body of the Ping frame."
 *
 * Doc phrase: "Ping proves framing; semantics come later."
 */

import { z } from "jsr:@zod/zod";
import { Capability } from "../schema/contract.ts";
import { createMessage } from "../schema/message.ts";

/**
 * Ping Input Schema
 *
 * Accepts any JSON-serializable payload. The payload is treated as opaque
 * application data that MUST be returned verbatim in the Pong response.
 */
const PingInput = z.object({
  payload: z.unknown().describe(
    "Arbitrary JSON-serializable payload to echo back verbatim. " +
    "Can be string, number, boolean, null, array, or object."
  ),
}).describe("Input for the Ping capability (ABI integrity test).");

/**
 * Ping Output Schema
 *
 * Returns the identical payload from the Ping request.
 * Per RFC-6455: "identical Application Data as found in the Ping."
 */
const PingOutput = z.object({
  payload: z.unknown().describe(
    "The identical payload from the Ping request, returned verbatim."
  ),
}).describe("Output from the Ping capability (Pong response).");

const PingInbound = z.object({
  kind: z.literal("query"),
  type: z.literal("Syscall.Ping"),
  data: PingInput,
});

const PingOutbound = z.object({
  kind: z.literal("reply"),
  type: z.literal("Syscall.Ping"),
  data: PingOutput,
});

export default {
  "Syscall.Ping": (): Capability<typeof PingInbound, typeof PingOutbound> => ({
    description:
      "ABI integrity test: returns payload verbatim (RFC-6455 PING/PONG semantics). " +
      "Proves framing correctness - no mutation, no truncation, correct correlation.",
    inbound: PingInbound,
    outbound: PingOutbound,
    factory: () =>
      new TransformStream({
        transform(msg, controller) {
          // Extract payload from input
          const data = msg.data as z.infer<typeof PingInput>;

          // Return payload VERBATIM - no transformation, no mutation
          // This is the core invariant: Pong.payload === Ping.payload
          const result = { payload: data.payload };

          controller.enqueue(
            createMessage(
              "reply",
              "Syscall.Ping",
              result,
              undefined, // New ID generated
              msg.metadata?.correlation, // Preserve workflow correlation
              msg.metadata?.id // This message caused the Pong
            )
          );
        },
      }),
  }),
};

/**
 * os/kernel/lib/ndjson.ts
 *
 * RFC-23 Stage 3: NDJSON Protocol Layer
 *
 * Reusable streams for encoding/decoding OsMessages in NDJSON format.
 * Protocol: Newline Delimited JSON (one JSON object per line)
 *
 * Rationale:
 * 1. Unix-Native: Works with grep, awk, sed, and standard pipes
 * 2. LLM-Friendly: Sequential generation of thoughts/events
 * 3. Robust: JSON.stringify() guarantees single-line output (escaping internal newlines)
 */

import { OsMessage } from "../schema/message.ts";

/**
 * NDJSONDecodeStream: string → OsMessage
 *
 * Converts NDJSON text lines into validated OsMessage objects.
 * Invalid lines are skipped with error logged to stderr.
 */
export class NDJSONDecodeStream extends TransformStream<string, OsMessage> {
  constructor() {
    super({
      transform(line: string, controller) {
        if (!line.trim()) return; // Skip empty lines

        try {
          const json = JSON.parse(line);

          // Lightweight validation: Ensure it looks like an OsMessage
          // Full Zod validation happens inside specific handlers if needed
          if (!json.kind || !json.type) {
            throw new Error("Missing required fields: kind, type");
          }

          controller.enqueue(json as OsMessage);
        } catch (e: unknown) {
          const errorMessage = e instanceof Error ? e.message : String(e);
          // Protocol Violation: Log error to stderr
          // This ensures the pipe doesn't crash, but the caller knows something went wrong
          console.error(
            `[Kernel Protocol Violation] Invalid NDJSON: ${errorMessage}`
          );
          // Optionally: controller.enqueue(createError(..., "Invalid NDJSON"));
        }
      },
    });
  }
}

/**
 * NDJSONEncodeStream: OsMessage → string
 *
 * Converts OsMessage objects into NDJSON text lines.
 * Each event becomes a single line of JSON followed by a newline.
 */
export class NDJSONEncodeStream extends TransformStream<OsMessage, string> {
  constructor() {
    super({
      transform(event: OsMessage, controller) {
        // JSON.stringify() guarantees single-line output (escapes internal newlines)
        const line = JSON.stringify(event) + "\n";
        controller.enqueue(line);
      },
    });
  }
}

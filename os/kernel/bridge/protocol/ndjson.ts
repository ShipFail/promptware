/**
 * os/kernel/bridge/protocol/ndjson.ts
 *
 * RFC-23 Stage 3: NDJSON Protocol Layer
 *
 * Reusable streams for encoding/decoding OsEvents in NDJSON format.
 * Protocol: Newline Delimited JSON (one JSON object per line)
 *
 * Rationale:
 * 1. Unix-Native: Works with grep, awk, sed, and standard pipes
 * 2. LLM-Friendly: Sequential generation of thoughts/events
 * 3. Robust: JSON.stringify() guarantees single-line output (escaping internal newlines)
 */

import { OsEvent } from "../../lib/event.ts";

/**
 * NDJSONDecodeStream: string → OsEvent
 *
 * Converts NDJSON text lines into validated OsEvent objects.
 * Invalid lines are skipped with error logged to stderr.
 */
export class NDJSONDecodeStream extends TransformStream<string, OsEvent> {
  constructor() {
    super({
      transform(line: string, controller) {
        if (!line.trim()) return; // Skip empty lines

        try {
          const json = JSON.parse(line);

          // Lightweight validation: Ensure it looks like an OsEvent
          // Full Zod validation happens inside specific handlers if needed
          if (!json.type || !json.name) {
            throw new Error("Missing required fields: type, name");
          }

          controller.enqueue(json as OsEvent);
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
 * NDJSONEncodeStream: OsEvent → string
 *
 * Converts OsEvent objects into NDJSON text lines.
 * Each event becomes a single line of JSON followed by a newline.
 */
export class NDJSONEncodeStream extends TransformStream<OsEvent, string> {
  constructor() {
    super({
      transform(event: OsEvent, controller) {
        // JSON.stringify() guarantees single-line output (escapes internal newlines)
        const line = JSON.stringify(event) + "\n";
        controller.enqueue(line);
      },
    });
  }
}

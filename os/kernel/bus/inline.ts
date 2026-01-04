/**
 * os/kernel/bus/runtime/inline.ts
 *
 * Inline Runtime (RFC-23 Stage 1)
 *
 * In-process kernel execution - the current v1.0 behavior.
 * Processes events through the reactive pipeline without spawning a worker.
 */

import { TextLineStream } from "jsr:@std/streams";
import { parseArgs } from "jsr:@std/cli/parse-args";

import { OsMessage, createCommand } from "../schema/message.ts";
import { routerStream } from "./router.ts";
import { loggerStream } from "./logger.ts";
import { KernelRuntime } from "./interface.ts";
import { NDJSONDecodeStream, NDJSONEncodeStream } from "../lib/ndjson.ts";

export class InlineRuntime implements KernelRuntime {
  async run(): Promise<number> {
    // 1. Determine Input Source
    // Check args first - if args provided, it's CLI mode, otherwise pipe mode
    const cleanArgs = Deno.args.filter((arg, i, arr) => {
      if (arg === "--mode" || arg.startsWith("--mode=")) return false;
      if (i > 0 && arr[i - 1] === "--mode") return false;
      return true;
    });

    const args = parseArgs(cleanArgs);
    const hasArgs = args._.length > 0;
    const isCliMode = hasArgs; // If args provided, it's CLI mode

    let inputStream: ReadableStream<OsMessage>;

    if (isCliMode) {
      // A. Interactive/CLI Mode (Args -> Single Event)
      const name = args._[0]?.toString();
      // Parse payload as JSON if possible, otherwise string
      // For simplicity in this refactor, we'll assume the args are passed as is or parsed if needed.
      // The old code sliced args. Let's keep it simple.
      // RFC-24: Command<T> payload is T.
      // We'll treat the rest of args as the payload object if it parses, or an array?
      // The old code passed `args._.slice(1)` as payload.
      // Let's assume the user passes a JSON string as the second arg, or we construct an object.
      // For now, let's just pass the raw args as 'args' property to match typical CLI usage.
      
      if (!name) {
        console.error("Usage: deno run -A main.ts <capability> [args...]");
        console.error("   Or: echo 'JSON' | deno run -A main.ts");
        return 1;
      }

      // Construct payload from remaining args
      // If one arg and it looks like JSON, parse it.
      // Otherwise, pass as array.
      let payload: Record<string, unknown> = {};
      const remainingArgs = args._.slice(1);
      
      if (remainingArgs.length === 1 && typeof remainingArgs[0] === 'string' && remainingArgs[0].startsWith('{')) {
          try {
              payload = JSON.parse(remainingArgs[0] as string);
          } catch {
              payload = { args: remainingArgs };
          }
      } else {
          payload = { args: remainingArgs };
      }

      const command = createCommand(name, payload);
      inputStream = new ReadableStream({
        start(controller) {
          controller.enqueue(command);
          controller.close();
        },
      });
    } else {
      // B. Pipe Mode (Stdin -> NDJSON Stream)
      inputStream = Deno.stdin.readable
        .pipeThrough(new TextDecoderStream())
        .pipeThrough(new TextLineStream())
        .pipeThrough(new NDJSONDecodeStream());
    }

    // 2. Build Pipeline
    // Source -> Logger -> Router -> NDJSON Encoder -> Stdout
    const outputStream = inputStream
      .pipeThrough(loggerStream)
      .pipeThrough(routerStream)
      .pipeThrough(new NDJSONEncodeStream()) // Converts OsMessage to NDJSON strings
      .pipeThrough(new TextEncoderStream()); // Converts strings to bytes

    if (isCliMode) {
      // CLI Mode: Buffer in memory, then write
      // This avoids the hanging issue with pipeTo(stdout.writable)
      const chunks: Uint8Array[] = [];
      await outputStream.pipeTo(
        new WritableStream({
          write(chunk) {
            chunks.push(chunk);
          },
        })
      );

      // Write all chunks to stdout
      for (const chunk of chunks) {
        await Deno.stdout.write(chunk);
      }
    } else {
      // Pipe Mode: Stream directly to stdout
      await outputStream.pipeTo(
        new WritableStream({
          async write(chunk) {
            await Deno.stdout.write(chunk);
          },
        })
      );
    }

    return 0;
  }
}

/**
 * os/kernel/runtime/inline.ts
 *
 * Inline Runtime (RFC-23 Stage 1)
 *
 * In-process kernel execution - the current v1.0 behavior.
 * Processes events through the reactive pipeline without daemonizing.
 */

import { TextLineStream } from "jsr:@std/streams";
import { parseArgs } from "jsr:@std/cli/parse-args";

import { OsEvent, createEvent } from "../../lib/event.ts";
import { routerStream } from "../stream/router.ts";
import { loggerStream } from "../stream/logger.ts";
import { KernelRuntime } from "./interface.ts";
import { NDJSONDecodeStream, NDJSONEncodeStream } from "../protocol/ndjson.ts";

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

    let inputStream: ReadableStream<OsEvent>;

    if (isCliMode) {
      // A. Interactive/CLI Mode (Args -> Single Event)
      const name = args._[0]?.toString();
      const payload = args._.slice(1);

      if (!name) {
        console.error("Usage: deno run -A syscall.ts <syscall> [args...]");
        console.error("   Or: echo 'JSON' | deno run -A syscall.ts");
        return 1;
      }

      const event = createEvent("command", name, payload);
      inputStream = new ReadableStream({
        start(controller) {
          controller.enqueue(event);
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
      .pipeThrough(new NDJSONEncodeStream()) // Converts OsEvent to NDJSON strings
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

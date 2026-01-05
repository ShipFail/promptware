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

import { OsMessage, createMessage } from "../schema/message.ts";
import { createRouter } from "./router.ts";
import { loggerStream } from "./logger.ts";
import { registry } from "../capabilities/registry.ts";
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

    const args = parseArgs(cleanArgs, {
      string: ["kind"],
      alias: { k: "kind" }
    });
    const hasArgs = args._.length > 0;
    const isCliMode = hasArgs; // If args provided, it's CLI mode

    let inputStream: ReadableStream<OsMessage>;

    if (isCliMode) {
      // A. Interactive/CLI Mode (Args -> Single Event)
      const name = args._[0]?.toString();
      
      if (!name) {
        console.error("Usage: deno run -A main.ts <capability> [args...] [--kind=<command|query>]");
        console.error("   Or: echo 'JSON' | deno run -A main.ts");
        return 1;
      }

      // Construct payload from remaining args
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

      const kind = (args.kind as any) || "command";
      const command = createMessage(kind, name, payload);
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

    // 2. Build Pipeline (Tee Pattern)
    // Source -> Tee
    //           ├──> Router -> NDJSON Encoder -> Stdout (Main Path)
    //           └──> Logger (Side Path)
    
    const [mainBranch, logBranch] = inputStream.tee();

    // Path A: The Kernel (Critical Path)
    const kernelStream = mainBranch
      .pipeThrough(createRouter(registry))
      .pipeThrough(new NDJSONEncodeStream()) // Converts OsMessage to NDJSON strings
      .pipeThrough(new TextEncoderStream()); // Converts strings to bytes

    // Path B: The Logger (Side Path)
    const loggerPromise = logBranch
      .pipeThrough(loggerStream)
      .pipeTo(new WritableStream()); // Sink to nowhere (loggerStream writes to stderr)

    // Execute
    if (isCliMode) {
      // CLI Mode: Buffer in memory, then write
      const chunks: Uint8Array[] = [];
      const kernelPromise = kernelStream.pipeTo(
        new WritableStream({
          write(chunk) {
            chunks.push(chunk);
          },
        })
      );

      await Promise.all([kernelPromise, loggerPromise]);

      // Write all chunks to stdout
      for (const chunk of chunks) {
        await Deno.stdout.write(chunk);
      }
    } else {
      // Pipe Mode: Stream directly to stdout
      const kernelPromise = kernelStream.pipeTo(
        new WritableStream({
          async write(chunk) {
            await Deno.stdout.write(chunk);
          },
        })
      );

      await Promise.all([kernelPromise, loggerPromise]);
    }

    return 0;
  }
}

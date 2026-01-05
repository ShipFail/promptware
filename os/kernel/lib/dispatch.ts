import { createMessage, OsMessage } from "../schema/message.ts";

/**
 * Universal Dispatch Helper
 * Dispatches a data payload to a capability and returns the result.
 * 
 * Useful for:
 * 1. Tests (verifying capabilities)
 * 2. CLI Tools (one-shot execution)
 * 3. Internal Kernel Logic (calling other capabilities)
 * 
 * @param module - The module object containing capability factories
 * @param type - The message type in Domain.Action notation (e.g., "Memory.Get")
 * @param data - The input data payload
 * @param correlationId - Optional correlation ID for tracing
 */
export async function dispatch(
  module: any, 
  type: string, 
  data: unknown,
  correlationId?: string
): Promise<OsMessage> {
  // 1. Instantiate the Capability
  const cap = module[type]();
  
  // 2. Introspect the Schema (Source of Truth)
  // We extract 'kind' directly from the Zod definition.
  // This ensures the test always matches the implementation contract.
  const shape = (cap.inbound as any).shape;
  const kind = shape.kind.value; // "command" | "query"

  // 3. Create the Message
  const msg = createMessage(kind, type, data, undefined, correlationId);

  // 4. Execute Capability (Stream Harness)
  const processor = cap.factory();
  const results: OsMessage[] = [];
  const collector = new WritableStream({
    write(chunk) {
      results.push(chunk);
    },
  });

  const input = new ReadableStream({
    start(controller) {
      controller.enqueue(msg);
      controller.close();
    },
  });

  await Promise.all([
    input.pipeTo(processor.writable),
    processor.readable.pipeTo(collector),
  ]);

  if (results.length === 0) {
    throw new Error(`Capability ${type} returned no output`);
  }

  return results[0];
}

/**
 * Dispatches a message and returns ALL output messages.
 * Useful for capabilities that emit multiple messages (e.g. ACK + Command).
 */
export async function dispatchAll(
  module: any, 
  type: string, 
  data: unknown,
  correlationId?: string
): Promise<OsMessage[]> {
  const cap = module[type]();
  const shape = (cap.inbound as any).shape;
  const kind = shape.kind.value;

  const msg = createMessage(kind, type, data, undefined, correlationId);

  const processor = cap.factory();
  const results: OsMessage[] = [];
  const collector = new WritableStream({
    write(chunk) {
      results.push(chunk);
    },
  });

  const input = new ReadableStream({
    start(controller) {
      controller.enqueue(msg);
      controller.close();
    },
  });

  await Promise.all([
    input.pipeTo(processor.writable),
    processor.readable.pipeTo(collector),
  ]);

  return results;
}

import { Capability } from "../schema/capability.ts";
import { registry } from "./registry-store.ts";
export { registry } from "./registry-store.ts";

import capabilities from "./mod.ts";

/**
 * Central Capability Registry
 *
 * Uses EventStoreDB-style dot notation for semantic clarity.
 * The router dispatches messages based on message.type matching these keys.
 */
// Helper to register a module's capabilities
function register(capabilities: Capability<any, any>[]) {
  for (const cap of capabilities) {
    // Introspection: Extract type from Zod Schema
    // We assume the schema is z.object({ type: z.literal("...") })
    // This is enforced by the Capability contract and tests
    const type = (cap.inbound as any).shape.type.value;
    registry[type] = cap;
  }
}

// Register All Capabilities from the Plugin Array
register(capabilities);

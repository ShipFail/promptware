import { Capability } from "../schema/contract.ts";
import pingModule from "./ping.ts";
import memoryModule from "./memory.ts";
import fetchModule from "./fetch.ts";
import resolveModule from "./resolve.ts";
import ingestModule from "./ingest.ts";
import cryptoModule from "./crypto.ts";
import syscallAuthModule from "./authenticate.ts";
import syscallShutdownModule from "./shutdown.ts";
import sysDescribeModule from "./describe.ts";
import vectorModule from "./vector.ts";
import shellModule from "./shell.ts";

/**
 * Central Capability Registry
 *
 * Uses EventStoreDB-style dot notation for semantic clarity.
 * The router dispatches messages based on message.type matching these keys.
 */
export const registry: Record<string, Capability<any, any>> = {};

// Helper to register a module's capabilities
function register(module: Record<string, () => Capability<any, any>>) {
  for (const [type, factory] of Object.entries(module)) {
    registry[type] = factory();
  }
}

// Register Modules
register(pingModule);
register(memoryModule);
register(fetchModule);
register(resolveModule);
register(ingestModule);
register(cryptoModule);
register(syscallAuthModule);
register(syscallShutdownModule);
register(sysDescribeModule);
register(vectorModule);
register(shellModule);

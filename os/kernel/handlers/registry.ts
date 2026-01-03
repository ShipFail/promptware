import { Capability } from "../schema/contract.ts";
import echoModule from "./echo.ts";
import fetchModule from "./fetch.ts";
import {
  memoryGetModule,
  memorySetModule,
  memoryDeleteModule,
  memoryListModule,
} from "./memory.ts";
import resolveModule from "./resolve.ts";
import ingestModule from "./ingest.ts";
import {
  cryptoSealModule,
  cryptoOpenModule,
  cryptoDeriveModule,
} from "./crypto.ts";
import syscallAuthModule from "./authenticate.ts";
import syscallShutdownModule from "./shutdown.ts";

/**
 * Central Capability Registry
 *
 * Uses EventStoreDB-style dot notation for semantic clarity.
 * The router dispatches messages based on message.type matching these keys.
 */
export const registry: Record<string, Capability<any, any>> = {
  // Reserved syscalls (RFC-23 Stage 2)
  "Syscall.Authenticate": syscallAuthModule,
  "Syscall.Shutdown": syscallShutdownModule,

  // Basic utilities
  "Echo": echoModule,
  "Http.Fetch": fetchModule,

  // Memory operations (CQRS-compliant)
  "Memory.Get": memoryGetModule,
  "Memory.Set": memorySetModule,
  "Memory.Delete": memoryDeleteModule,
  "Memory.List": memoryListModule,

  // URI resolution and content ingestion
  "Uri.Resolve": resolveModule,
  "Content.Ingest": ingestModule,

  // Cryptographic operations (RFC 0016)
  "Crypto.Seal": cryptoSealModule,
  "Crypto.Open": cryptoOpenModule,
  "Crypto.Derive": cryptoDeriveModule,
};

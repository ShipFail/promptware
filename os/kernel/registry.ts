import { SyscallModule } from "./syscalls/contract.ts";
import echoModule from "./syscalls/echo.ts";
import fetchModule from "./syscalls/fetch.ts";
import {
  memoryGetModule,
  memorySetModule,
  memoryDeleteModule,
  memoryListModule,
} from "./syscalls/memory.ts";
import resolveModule from "./syscalls/resolve.ts";
import ingestModule from "./syscalls/ingest.ts";
import {
  cryptoSealModule,
  cryptoOpenModule,
  cryptoDeriveModule,
} from "./syscalls/crypto.ts";
import syscallAuthModule from "./syscalls/syscall-auth.ts";
import syscallShutdownModule from "./syscalls/syscall-shutdown.ts";

/**
 * Central Syscall Registry
 *
 * Uses EventStoreDB-style dot notation for semantic clarity.
 * The router dispatches events based on event.name matching these keys.
 */
export const registry: Record<string, SyscallModule<any, any>> = {
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

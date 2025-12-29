/**
 * os/kernel/handler/mod.ts
 *
 * Public API for Domain Syscall Handlers
 *
 * This module exports all application-level syscall handlers and the handler contract.
 */

// Handler Contract
export type { SyscallModule, SyscallHandler } from "./contract.ts";

// Basic Utilities
export { default as echoModule } from "./echo.ts";
export { default as fetchModule } from "./fetch.ts";

// Memory Operations (CQRS-compliant)
export {
  memoryGetModule,
  memorySetModule,
  memoryDeleteModule,
  memoryListModule,
} from "./memory.ts";

// URI Resolution and Content Ingestion
export { default as resolveModule } from "./resolve.ts";
export { default as ingestModule } from "./ingest.ts";

// Cryptographic Operations (RFC 0016)
export {
  cryptoSealModule,
  cryptoOpenModule,
  cryptoDeriveModule,
} from "./crypto.ts";

// System Description
export { default as describeModule } from "./describe.ts";

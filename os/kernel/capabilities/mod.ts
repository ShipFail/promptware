/**
 * os/kernel/capabilities/mod.ts
 *
 * Public API for Domain Capabilities
 *
 * This module exports all application-level capabilities and the capability contract.
 */

// Capability Contract
export type { Capability } from "../schema/contract.ts";

// Basic Utilities
export { default as pingModule } from "./ping.ts";
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
export { default as hydrateModule } from "./hydrate.ts";

// Cryptographic Operations (RFC 0016)
export {
  cryptoSealModule,
  cryptoOpenModule,
  cryptoDeriveModule,
} from "./crypto.ts";

// System Description
export { default as describeModule } from "./describe.ts";

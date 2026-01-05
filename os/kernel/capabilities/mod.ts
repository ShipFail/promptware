/**
 * os/kernel/capabilities/mod.ts
 *
 * Public API for Domain Capabilities
 *
 * This module exports all application-level capabilities and the capability contract.
 */

import pingCapabilities from "./ping.ts";
import fetchCapabilities from "./fetch.ts";
import memoryCapabilities from "./memory.ts";
import resolveCapabilities from "./resolve.ts";
import hydrateCapabilities from "./hydrate.ts";
import cryptoCapabilities from "./crypto.ts";
import describeCapabilities from "./describe.ts";
import vectorCapabilities from "./vector.ts";
import shellCapabilities from "./shell.ts";
import authenticateCapabilities from "./authenticate.ts";
import shutdownCapabilities from "./shutdown.ts";

// Capability Contract
export type { Capability } from "../schema/contract.ts";

// Export all capabilities as a default array (Plugin Pattern)
// We flatten the arrays of capabilities from each module into a single list.
export default [
  ...pingCapabilities,
  ...fetchCapabilities,
  ...memoryCapabilities,
  ...resolveCapabilities,
  ...hydrateCapabilities,
  ...cryptoCapabilities,
  ...describeCapabilities,
  ...vectorCapabilities,
  ...shellCapabilities,
  ...authenticateCapabilities,
  ...shutdownCapabilities,
];

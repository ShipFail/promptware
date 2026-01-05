import { Capability } from "../schema/capability.ts";

/**
 * Central Capability Registry Store
 * 
 * Separated from the loader to avoid circular dependencies.
 */
export const registry: Record<string, Capability<any, any>> = {};

/**
 * os/kernel/bus/mod.ts
 *
 * Public API for the RFC-23 Dual-Mode Bus Architecture
 *
 * This module exports all bus infrastructure components:
 * - Protocol layer (NDJSON encoding/decoding)
 * - Routing engine (message routing)
 * - Stream infrastructure (router, logger, interfaces)
 * - Runtime modes (inline, main, worker)
 * - Bus-specific capabilities (authenticate, shutdown)
 */

// Protocol Layer
export { NDJSONDecodeStream, NDJSONEncodeStream } from "../lib/ndjson.ts";

// Routing Layer
export { createRouter } from "./router.ts";
export type { Registry } from "./router.ts";

// Stream Layer
export { loggerStream } from "./logger.ts";
export type { BusStream } from "./interface.ts";

// Runtime Layer
export type { KernelRuntime } from "./interface.ts";
export { InlineRuntime } from "./inline.ts";
export { MainRuntime } from "./main.ts";
export { WorkerRuntime } from "./worker.ts";
export { ensureSupportedPlatform } from "./platform.ts";
export { getSocketPath } from "./socket-path.ts";

// Bus Capabilities
export { default as authenticateModule } from "../capabilities/authenticate.ts";
export { default as shutdownModule } from "../capabilities/shutdown.ts";

/**
 * os/kernel/transport/mod.ts
 *
 * Public API for the RFC-23 Dual-Mode Syscall Transport
 *
 * This module exports all transport infrastructure components:
 * - Protocol layer (NDJSON encoding/decoding)
 * - Dispatch engine (event routing)
 * - Stream infrastructure (router, logger, interfaces)
 * - Runtime modes (inline, main, worker)
 * - Transport-specific handlers (authenticate, shutdown)
 */

// Protocol Layer
export { NDJSONDecodeStream, NDJSONEncodeStream } from "./protocol/ndjson.ts";

// Dispatch Layer
export { dispatch } from "./dispatch/engine.ts";
export type { Registry } from "./dispatch/engine.ts";

// Stream Layer
export { routerStream } from "./stream/router.ts";
export { loggerStream } from "./stream/logger.ts";
export type { SyscallStream } from "./stream/interface.ts";

// Runtime Layer
export type { KernelRuntime } from "./runtime/interface.ts";
export { InlineRuntime } from "./runtime/inline.ts";
export { MainRuntime } from "./runtime/main.ts";
export { WorkerRuntime } from "./runtime/worker.ts";
export { ensureSupportedPlatform } from "./runtime/platform.ts";
export { getSocketPath } from "./runtime/socket-path.ts";

// Transport Handlers
export { default as authenticateModule } from "./handler/authenticate.ts";
export { default as shutdownModule } from "./handler/shutdown.ts";

/**
 * os/kernel/bridge/mod.ts
 *
 * Public API for the RFC-23 Dual-Mode Syscall Bridge
 *
 * This module exports all bridge infrastructure components:
 * - Protocol layer (NDJSON encoding/decoding)
 * - Dispatch engine (event routing)
 * - Stream infrastructure (router, logger, interfaces)
 * - Runtime modes (inline, client, daemon)
 * - Bridge-specific handlers (authenticate, shutdown)
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
export { ClientRuntime } from "./runtime/client.ts";
export { DaemonRuntime } from "./runtime/daemon.ts";
export { ensureSupportedPlatform } from "./runtime/platform.ts";
export { getSocketPath } from "./runtime/socket-path.ts";

// Bridge Handlers
export { default as authenticateModule } from "./handler/authenticate.ts";
export { default as shutdownModule } from "./handler/shutdown.ts";

/**
 * os/kernel/bus/runtime/lifecycle.ts
 *
 * Manages the lifecycle state of the kernel runtime (shutdown signals).
 * Decoupled from worker.ts to avoid circular dependencies.
 */

type ShutdownListener = () => void;

let shutdownRequested = false;
const listeners: Set<ShutdownListener> = new Set();

export function requestShutdown(): void {
  shutdownRequested = true;
  for (const listener of listeners) {
    try {
      listener();
    } catch (e) {
      console.error("Error in shutdown listener:", e);
    }
  }
}

export function isShutdownRequested(): boolean {
  return shutdownRequested;
}

export function onShutdown(listener: ShutdownListener): void {
  listeners.add(listener);
}

export function offShutdown(listener: ShutdownListener): void {
  listeners.delete(listener);
}

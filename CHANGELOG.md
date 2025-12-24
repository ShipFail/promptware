# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.9.0] - 2025-12-24

### Changed
- **Architecture**: Implemented "Service Locator" pattern for Kernel Tools (self-configuration via KV).
- **Isolation**: Enforced W3C Storage Partitioning via Deno `--location <origin>`.
- **Bootloader**: Added `origin` parameter to separate Code Source (`root`) from State Scope (`origin`).
- **Kernel ABI**: Renamed `pwosExec` to `pwosSyscall` to reflect the Monolithic Dispatch architecture.
- **Implementation**: Renamed `exec.ts` to `syscall.ts` as the Unified Entry Point.
- **Documentation**: Updated all RFCs and Architecture docs to reference `pwosSyscall` and `syscall.ts`.
- **Verification**: Achieved 100% Unit Test coverage for the Kernel.
- **Process**: Added `RFC 0021: Spec-Driven Verification` to mandate Spec-Driven Verification.

## [0.8.1] - 2025-12-23

### Changed
- **Maintenance**: Version bump to 0.8.1.

## [0.8.0] - 2025-12-23

### Changed
- **RFCs**: Standardized all RFCs to "Component-First" naming convention and "PromptWar̊e ØS" branding.
- **Validation**: Added `rfcs/validate.test.ts` to enforce RFC standards in CI.
- **Documentation**: Updated `AGENTS.md` with new RFC process rules and version bump protocol.
- **Security**: Added `RFC 0016: Ring -1: The Vault Primitive` defining the security layer.
- **Process**: Updated `RFC 0000` to be the "Supreme Law" for RFC management.

## [0.7.0] - 2025-12-22

### Changed
- **Kernel**: Renamed all system calls to `pwos*` prefix (e.g., `osExec` -> `pwosExec`) to prevent LLM hallucinations and improve observability.
- **Security**: Implemented "Security Watchdog" in `KERNEL.md` to detect and panic on unauthorized `read_file` access to System Space.
- **Testing**: Added `os/agents/hello.md` and `os/agents/diagnostic.md` for system self-verification.
- **RFC**: Added `RFC 0015: Kernel Architecture` defining the "Prompts as Binaries" model.

## [0.6.0] - 2025-12-22

### Changed
- **Architecture**: Refactored to "Monolithic Kernel" architecture.
    - Replaced `deno-exec.ts` (Supervisor) with `exec.ts` (Unified Kernel Entry Point).
    - `osExec` is now the single privileged execution choke-point.
- **Kernel**: Simplified `KERNEL.md` definitions.
    - Switched to arrow functions (`const name = async (...) =>`) for cleaner syntax.
    - Removed explicit `Promise<any>` return types where possible.
    - Simplified argument serialization using `JSON.stringify`.
- **Syscalls**: Standardized all syscalls (`resolve`, `ingest`, `memory`) to export default functions and accept injected `root` context.
- **Cleanup**: Removed obsolete `goodwin.ts` and `deno-exec.ts`.

## [0.5.0] - 2025-12-21

### Changed
- **Architecture**: Upgraded to "Microservices Architecture" (Pure Unix).
    - Split monolithic `syscall.ts` into atomic tools: `resolve.ts`, `ingest.ts`, `memory.ts`.
    - Introduced `deno-exec.ts` (Supervisor) to enforce identity constraints.
- **Security**: Implemented the **Goodwin Check** for Cognitive Integrity.
    - Uses Deno KV isolation (`--location`) to lock agents to their identity.
    - Verifies `/proc/cmdline` access before every system call.
- **Kernel**: Renamed `osBoot` to `startKernel` to align with Linux conventions.
- **Persistence**: Kernel parameters (`mounts`) are now stored in Deno KV at boot and accessed asynchronously by tools.
- **Optimization**: Removed `boot.ts` binary; `startKernel` now calls `memory.ts` directly.
- **Documentation**: Added `blog.md` announcing the v0.5 release.

## [0.4.0] - 2025-12-20

### Changed
- **Architecture**: Upgraded to "Promptware/Software Dualism".
    - **Promptware Kernel**: `KERNEL.md` (Interface/Intent).
    - **Software Kernel**: `syscall.ts` (Implementation/Physics).
- **Kernel**: Refactored `KERNEL.md` to use `camelCase` (`osResolve`, `osIngest`) and `osDenoExec`.
- **Hardware**: Created monolithic `os/boot/tools/syscall.ts` to handle all low-level operations (resolve, ingest, memory).
- **Path Resolution**: Implemented "TypeScript Import" style resolution (relative to `__filename`) backed by the Software Kernel.
- **Testing**: Added `syscall.test.ts` to verify kernel physics.
- **Cleanup**: Removed obsolete `linker.ts` and `memory.ts`.

## [0.3.0] - 2025-12-20

### Changed
- **License**: Upgraded to "Public Prompt License - Apache Variant (PPL-A) v0.2".
- **Architecture**: Adopted "Bilingual Kernel" philosophy (English for Intent, TypeScript for Precision).
- **Kernel**: Refactored `KERNEL.md` to use "Literate TypeScript" blocks for system call definitions (`os_resolve`, `os_memory`, etc.).
- **Bootloader**: Updated `LOADER.md` to use TypeScript expressions for URI construction (`new URL(...)`) to eliminate ambiguity.
- **Terminology**: Standardized on **URI** (instead of URL) and **Ingest** (instead of Fetch/Read) across the system.
- **Versioning**: Locked bootloader root to `refs/heads/main` for immutable infrastructure.

## [0.2.0] - 2025-12-19

### Added
- **Kernel Memory**: Implemented `os_memory` syscall and `memory.ts` tool to persist critical state using **Deno KV** with `--location` based isolation.
- **JIT Linker**: Added `os/boot/tools/linker.ts` to automatically hydrate `skills` and `tools` descriptions in Markdown files upon ingestion.
- **VFS Mounts**: Added `fstab`-like support via `mounts` in Bootloader configuration, enabling mapping of remote URLs to local virtual paths.
- **Skill Specification**: Added `os/skills/skill-spec/SKILL.md` to define the standard for Agent Skills.
- **Tool Standards**: Enforced "Dual-Mode Architecture" (CLI + Module) and JSR usage for all system tools in `AGENTS.md`.
- **License**: Added `LICENSE` file with "Public Prompt License - MIT Variant".
- **Agents**: Added initial versions of `Felix` (Engineer) and `Pandora` (Researcher) agents.
- **Landing Page**: Added `index.html` for the Promptware OS landing page.

### Changed
- **License**: Upgraded `LICENSE` to "Public Prompt License - MIT Variant (PPL-M) v0.2".
- **Architecture**: Moved `KERNEL.md` and `tools/` from `os/kernel/` to `os/boot/` to align with the bootloader sequence.
- **Kernel**: Refactored `KERNEL.md` front matter to use "Directive Style" for system calls (`os_resolve`, `os_invoke`, `os_ingest`).
- **Bootloader**: Updated `LOADER.md` to enforce the "Ingest and Adopt" philosophy and improved error handling.
- **Naming**: Unified all system calls to use the `os_*` prefix (e.g., `sys_resolve` -> `os_resolve`).
- **Documentation**: Renamed project to "Promptware OS" and updated `README.md` with author and blog details.
- **Dev Container**: Renamed container to "Promptware OS" and added npm package support.

### Fixed
- **Context Drift**: `os_resolve` now uses **Bootloader Front Matter** as the "Source of Truth" for `root` and `mounts`, ensuring immutable infrastructure and preventing hallucinations.
- **Tooling**: Refactored `memory.ts` to use `jsr:@std/cli` and `jsr:@std/fs` instead of deprecated `deno.land` imports.

## [0.1.0] - 2025-12-07

### Added
- Initial release of Promptware OS architecture.
- Basic `KERNEL.md` with VFS and execution laws.
- `LOADER.md` bootloader specification.
- `Powell` agent as the reference implementation.

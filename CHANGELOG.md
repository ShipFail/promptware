# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

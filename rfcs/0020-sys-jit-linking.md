---
rfc: 0020
title: JIT Linking & Skill Hydration
author: Ship.Fail
status: Draft
type: Standards Track
category: System
created: 2025-12-24
---

# RFC 0020: JIT Linking & Skill Hydration

## 1. Summary
This RFC defines the mechanism for "Just-In-Time (JIT) Linking" in Promptware OS. It specifies how the `pwosIngest` system call hydrates static Markdown files (Agents) into dynamic, executable Context by resolving and injecting dependencies (Skills) at runtime.

## 2. Motivation
Promptware Agents are defined in Markdown (`.md`). While Markdown is excellent for static text, it lacks a native module system. We need a way to:
1.  **Reuse Capabilities**: Share common skills (e.g., "Coding Style", "Web Search") across multiple agents.
2.  **Reduce Context Window**: Only load the skills required for the current task.
3.  **Decouple Implementation**: Allow the implementation of a skill (TypeScript) to evolve independently of the agent using it.

## 3. The JIT Linking Process

The `pwosIngest(uri)` system call performs the following steps:

### 3.1 Fetch
The kernel fetches the raw content of the target URI (using `sealedFetch` or local FS).

### 3.2 Parse Front Matter
The kernel parses the YAML Front Matter to identify dependencies.

```yaml
---
type: Agent
skills:
  - os://skills/core.coding-style.md
  - os://skills/jekyll/SKILL.md
tools:
  - os://kernel/syscalls/memory.ts
---
```

### 3.3 Resolve Dependencies (Skills & Tools)
For each entry in the `skills` and `tools` lists:
1.  **Resolve URI**: The kernel resolves the URI (handling `os://` via RFC 0013).
2.  **Fetch Resource**: The kernel fetches the definition file.
3.  **Extract Metadata**:
    *   **Skills**: The kernel parses the Front Matter to extract the `name` and `description`. This provides a semantic summary of the skill without injecting the full implementation.
    *   **Tools**: The kernel extracts the tool's description according to the **Tool Discovery Contract** defined in **RFC 0012**. It prefers the `--description` flag, falling back to a truncated `--help` output (max 1024 chars) for legacy tools.

### 3.4 Hydrate (Link)
The kernel updates the Agent's Front Matter, replacing the raw URI lists with hydrated objects containing the URI and its metadata. This allows the Agent to discover capabilities efficiently.

## 4. The `ingest` Syscall

The `ingest` syscall is a microservice within the Software Kernel, invoked via the main `pwosSyscall` dispatcher. It implements the hydration logic defined above.

```typescript
// os/kernel/syscalls/ingest.ts
export default async function(root: string, uri: string) {
  // 1. Fetch URI
  // 2. Parse Front Matter
  // 3. Recursively resolve 'skills'
  // 4. Construct final Prompt Context
  // 5. Return (or output) the hydrated context
}
```

## 5. Skill Definition Format

To support JIT linking, Skills must adhere to a standard format (see RFC 0012).

*   **Header**: Defines the skill metadata.
*   **Interface**: The text that will be injected into the Agent's context.
*   **Implementation**: References to the underlying TypeScript tools (which are executed via `pwosSyscall`).

## 6. Security Considerations
*   **Recursive Linking**: The linker must detect and prevent circular dependencies.
*   **Remote Code Execution**: While JIT linking injects *text*, that text often contains instructions to run code. The `Sealed` class (RFC 0017) ensures that the *source* of that text is trusted.

---
type: Agent Protocol
strategy: Pointer
audience: AI Agents
goal: Compliance
---

# Agent Protocol: RFC Management

**STOP.** Before creating or editing any RFC, you **MUST** load and obey the **Supreme Law** defined in:

> **[rfcs/0000-meta-rfc-process.md](0000-meta-rfc-process.md)**

## Directives

1.  **Source of Truth**: `RFC 0000` is the **ONLY** authority on naming, numbering, and formatting.
2.  **Template Usage**: You **MUST** read and use **[rfcs/TEMPLATE.md](TEMPLATE.md)** as the base for any new RFC.
3.  **Contribution Rules**: Refer to **[rfcs/CONTRIBUTING.md](CONTRIBUTING.md)** for broader project context if needed.
4.  **Pre-Flight Check**: You **MUST** read `RFC 0000` before generating any content.
5.  **Naming Rule**: Enforce the **Taxonomy Standard**: `<id>-<domain>-<subsystem>-<concept>.md` (e.g., `0015-kernel-core-arch.md`). **VALIDATION**: Before creating file, COUNT slugs (exclude number): MUST be 3-5, state count aloud. Example: `semantic-token-optimization-protocol` = 4 slugs ✓
6.  **Branding Rule**: Enforce **PromptWar̊e ØS** (Stylized) over ASCII.
7.  **Conflict Resolution**: Always `list_dir` first. If `NNNN` exists, use `NNNN+1`.
8.  **File Creation Protocol**: NEVER create markdown documentation for analysis/reviews/summaries. Present findings in conversation. Only create files when user explicitly requests: "create/write/save [filename]".
9.  **Git Commit Protocol**: Before `git add` on NEW untracked files, ask user: "Should [filename] be committed?" Wait for confirmation.

**FAILURE TO COMPLY WITH RFC 0000 IS A SYSTEM ERROR.**

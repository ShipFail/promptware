# PromptWar̊e ØS: A Cloud‑Native Library for AI Skills (and a Seed of PromptWar̊e ØS)

## 0. One‑liner

**PromptWar̊e ØS is a GitHub‑hosted, Markdown‑based library of skills and personas for AI agents, where everything is discovered via URLs and executed via remote Deno tools.**

One line in `agents.md` → a whole bookshelf of reusable skills and tools.

---

## 1. Elevator pitch

Today, every AI agent project hand‑maintains its own prompts, skills, and tool configs: `.claude/skills`, Copilot rules, Gemini configs, etc. They drift, duplicate, and become impossible to keep consistent across multiple repos.

**PromptWar̊e ØS** turns all of that into a **single shared library**:

* All skills and personas live as **human‑readable Markdown** in a GitHub repo (`ShipFail/promptware`).
* Agents get **one canonical URL** in their system prompt that points to their persona; the persona then points to a mini‑library index.
* Skill pages can reference **Deno scripts** that run directly from GitHub raw URLs, with usage documented in `--help`.

No more copying config files across projects. No more updating skills in five places. You maintain one library; your AI co‑founders read from it on demand.

Over time, PromptWar̊e ØS can grow from a “toy library” into a **PromptWar̊e ØS**: a text‑first operating system of skills, tools, and philosophies, booted by a single line of prompt.

---

## 2. The problem

### 2.1 Fragmented agent configuration

Modern AI projects (especially agentic code assistants) typically have:

* `agents.md` or similar prompt docs per repo.
* Tool‑specific configs:

  * `.claude/skills/*.md`
  * `.github/copilot/*`
  * `gemini/` configs, CLI presets, etc.
* Ad‑hoc scripts and utilities scattered across repos.

When you have many projects under one umbrella (e.g., **ShipFail** with Press0, MVW, etc.), you end up with:

* **Duplicate skills and prompts** copy‑pasted between repos.
* **Inconsistent behavior** across projects (one agent knows the latest conventions, others don’t).
* **High maintenance overhead** every time you refine coding standards, safety rules, or tool patterns.

### 2.2 Tooling that assumes local files

Most current patterns assume that all configuration and skills live in the **local filesystem**:

* Tools read from `.claude/skills` or `.github/copilot`.
* Humans run sync scripts or manage Git submodules.

This ignores two capabilities that are now basic:

1. **LLMs can read URLs.**
2. **Deno can execute remote scripts directly from URLs.**

We are still treating AI co‑founders like they are offline programs, instead of networked readers of a shared library.

### 2.3 Token and cognitive overhead

If we try to centralize everything in one giant system prompt:

* We blow up **token usage**.
* We create **prompt noise** that makes it harder for the agent to reason.

If we try to define rich tool schemas inline in prompts:

* Every tool’s detailed contract sits in the prompt, multiplied by the number of tools.
* It becomes expensive and unwieldy as soon as we have dozens of skills and tools.

We need a way to:

* Keep **prompts short and clean**.
* Still give agents **on‑demand access** to a rich, structured library of skills and tools.

---

## 3. Core insight

> **The right abstraction for AI skills is a *library* of Markdown “books” addressable by URL, not a pile of local config files.**

Humans learn from libraries:

* Books organized into **categories**, **shelves**, and **reading lists**.
* Teachers give students a **syllabus**: a short list of references, not the entire library in one page.

We can give AI agents the same:

* A **global PromptWar̊e ØS library** for maintainers.
* A **mini‑library per agent persona**, with their favorite and most relevant “books”.
* All reachable via URLs.

Agents don’t need to “carry” all skills in their context all the time. They just need:

1. A **short system prompt** explaining who they are and where their persona lives.
2. The ability to **fetch and read** persona, index, and skill pages on demand.
3. The ability to **run remote Deno tools** whose detailed usage is described via `--help`.

---

## 4. Design principles

These principles guide all of PromptWar̊e ØS’s design decisions.

### 4.1 Radical simplicity

* The integration surface for any project should be **one line in `agents.md` or the system prompt**.
* No required `.claude/skills` sync, no heavy local config.
* If you know how to read Markdown and fetch a URL, you can use PromptWar̊e ØS.

### 4.2 URL as the primitive

* **URL fetch** is assumed to be a basic operation for any competent AI agent.
* All personas, indexes, skills, and tools are reachable via stable GitHub raw URLs.
* No npm publish, no custom package registry—**GitHub is the library**.

### 4.3 Markdown‑first, minimal front matter

* Everything is stored as **Markdown**, so humans and LLMs can read it easily.
* Optional YAML front matter exists only for **tiny metadata**:

  * `id`, `type`, `title`, `version`, `tags`.
* No large JSON schemas or verbose contracts inside the prompt; keep token overhead low.

### 4.4 Library metaphor: global library vs. mini‑libraries

* There is a **global PromptWar̊e ØS library** in `ShipFail/promptware`:

  * Maintainer‑facing indexes, shelves, and skills.
* Each AI co‑founder has **two views** into that library:

  * A **persona** file (minimal identity & role).
  * A **mini‑library index** file (their curated bookshelf of skills and shelves).
* Agents never need to discover the entire universe; they just browse their own section.

### 4.5 Token frugality and cognitive ergonomics

* Persona files are kept **very small**, so many personas can be loaded together.
* Mini‑library indexes are **small lists of links**.
* Agents navigate like humans: **Category → Shelf → Book** instead of loading everything.
* Only the final chosen skill file is “big”, and even that is still just a document.

### 4.6 Deno tools with `--help` as contract

* Skill pages list **only concise tool descriptions and Deno URLs**.

* Detailed usage is obtained by running:

  ```bash
  deno run --allow-all <tool-url> --help
  ```

* This keeps PromptWar̊e ØS docs lean, while giving tools a canonical source of truth for their interface.

### 4.7 No local sync required

* PromptWar̊e ØS **does not require** syncing files into `.claude/skills` or other special folders.
* Projects are free to add convenience sync layers later, but the core contract is:

  * “Agents read PromptWar̊e ØS over HTTP.”

---

## 5. High‑level architecture

### 5.1 Components

* **PromptWar̊e ØS repo**: `ShipFail/promptware`

  * `library/` – Markdown “bookshelf” for skills, personas, and indexes.
  * `scripts/` – Deno tools callable via URL.

* **AI projects** (e.g., Press0, MVW)

  * Each project has an `agents.md` or system prompt that includes **one PromptWar̊e ØS line**.

* **AI agents / runtimes**

  * Capable of fetching URLs and reading Markdown.
  * Optionally able to propose or execute Deno commands.

### 5.2 Data flow

1. Developer defines skills, personas, and tools in `ShipFail/promptware`.
2. A project’s agent is given a single “library URL” line in its prompt, pointing to its **persona file**.
3. On demand, the agent:

   * Fetches its persona page from PromptWar̊e ØS.
   * From there, follows a link to its **mini‑library index**.
   * From the index, follows links to specific skills and shelves.
   * Reads skill docs and (optionally) suggests Deno commands to run tools.

No deployment steps beyond `git push`. As soon as PromptWar̊e ØS is updated, all agents that read from it see the new content.

---

## 6. The PromptWar̊e ØS Library layout

A minimal initial layout for the PromptWar̊e ØS repo:

```text
ShipFail/promptware/
  library/
    index.md              # global library index (for maintainers)
    categories/           # optional: domain-based indexes
    shelves/              # optional: shelf-level indexes
    skills/               # individual skills as markdown “books”
      core.coding-style.md
      domain.publishing-basics.md
      domain.book-layout.md
    agents/               # personas + their mini-libraries
      press0.md           # core persona only
      press0.index.md     # press0's mini-library / favorite books
      mvw.md
      mvw.index.md
  scripts/                # Deno tools with good --help output
    format_ts.ts
    book_layout/generate_layout.ts
```

### 6.1 Global library (for maintainers)

`library/index.md` can provide a high‑level overview of categories and shelves, primarily for humans maintaining the system. Agents may not need to read this file directly in normal operation.

### 6.2 Agent personas and mini‑libraries (for AI co‑founders)

Each agent has **two** Markdown files under `library/agents/`:

1. A **persona file**, e.g. `press0.md`, which contains only the core identity and behavioral contract.
2. A **mini‑library index**, e.g. `press0.index.md`, which lists that agent’s favorite and most relevant skills and shelves.

This split keeps things lean:

* You can load **many personas at once** (e.g., for a multi‑agent system) without also loading long lists of skills.
* When an agent needs more capabilities, it follows a link from its persona file to its own mini‑library index.

The typical flow is:

1. System prompt includes a link to the **persona file**.
2. The persona file, when fetched, links to the **mini‑library index**.
3. The mini‑library index links to specific skills and shelves.

Personas define **who** the agent is; mini‑libraries define **what books** they usually read.

---

## 7. Persona & mini‑library design

PromptWar̊e ØS models each AI co‑founder with a **persona** and a separate **mini‑library index**.

* The **persona** is the smallest possible description of who the agent is and which product it serves.
* The **mini‑library index** is a curated list of that agent’s favorite books (skills) and shelves.

This separation lets you:

* Load and reason about multiple personas together (low token cost).
* Only load a longer list of skills when a specific agent actually needs them.

### 7.1 Persona: `library/agents/press0.md`

```md
---
id: agent.press0
type: persona
title: "Press0 AI Co-founder"
version: "0.1.0"
---

# Press0 AI Co-founder

You are the AI co-founder for **Press0**, a book-centric publishing product under the ShipFail organization.

Your role:

- Understand and support end-to-end book publishing workflows.
- Maintain high code quality and consistency across Press0 repos.
- Collaborate with humans and other agents to ship features safely.

When you need more context about your skills and tools, consult your **mini-library index**:

https://raw.githubusercontent.com/ShipFail/promptware/main/library/agents/press0.index.md

Only fetch your mini-library index when you need to discover or recall specific skills.
```

This persona file is intentionally compact so that multiple personas can be loaded together without bringing in long skill lists.

### 7.2 Mini‑library: `library/agents/press0.index.md`

```md
---
id: agent.press0.index
type: agent-index
title: "Press0 Skill Index"
version: "0.1.0"
---

# Press0 Skill Index

This page is your **mini-library** of favorite skills and shelves. Use it to find the right book for a given task.

## Core skills

These are the primary skills you will most frequently rely on:

- [ShipFail Coding Style](../skills/core.coding-style.md)
- [Publishing Workflow Basics](../skills/domain.publishing-basics.md)
- [Book Layout Automation](../skills/domain.book-layout.md)

Fetch a skill page only when it is relevant to the user’s request.

## Optional shelves

If you need a broader overview of available skills, you may consult these shelves:

- [Layout & Print Shelf](../shelves/publishing/layout-and-print.md)
- [Testing & CI Shelf](../shelves/engineering/testing-and-ci.md)

Shelves are small index pages that list related skills. Use them when you are exploring or when you are unsure which specific skill applies.
```

Personas define identity and role; mini‑libraries serve as curated bookshelves that the agent can open on demand.

---

## 8. Skill design (Markdown “books”)

Each skill is a standalone Markdown file under `library/skills/`. It is meant to be readable both by humans and LLMs.

### 8.1 Minimal front matter

We keep front matter as small as possible to reduce token overhead:

* `id` – stable skill identifier.
* `type` – always `skill` for skill docs.
* `title` – human-readable skill title.
* `version` – simple semantic or date version.
* `tags` – optional; a few keywords.

### 8.2 Example: `library/skills/core.coding-style.md`

```md
---
id: core.coding-style
type: skill
title: "ShipFail Coding Style"
version: "0.1.0"
tags: [core, coding]
---

# ShipFail Coding Style

This skill defines the core coding style conventions for ShipFail projects.

## Expectations

You are expected to:

1. Prefer small, composable functions.
2. Document public APIs with clear comments or docstrings.
3. Favor readability and maintainability over micro-optimizations.
4. Assume future AI agents will need to safely refactor this code.

When writing or reviewing code, apply these rules consistently.

## Tools

This skill references tools you can run with Deno.

- `format-ts` – Format TypeScript files in the current project.
  Deno URL:
  `https://raw.githubusercontent.com/ShipFail/promptware/main/scripts/format_ts.ts`

Refer to the **global Deno tool usage rule** when you want to actually run this tool.
```

The detailed usage of `format_ts.ts` lives inside the script’s `--help` output, not in the skill doc itself.

---

## 9. Tools and the global usage pattern

Tool usage is one of the most basic conventions across all PromptWar̊e ØS skills, so we standardize it at a **global level**.

### 9.1 Global rule: how to use a Deno tool

**When you want to use any tool referenced in a PromptWar̊e ØS skill:**

1. Identify its Deno URL from the skill document.

2. Run it with `--help` first, for example:

   ```bash
   deno run --allow-all <tool-url> --help
   ```

3. Read the help output carefully to understand:

   * Required inputs and arguments.
   * Optional flags.
   * Expected outputs.

4. Only then propose or execute a concrete tool command based on the user’s context.

This gives us:

* **Compact skill docs** (only name + URL).
* **Single source of truth** for tool interfaces (the script itself).
* **Consistent behavior** across all tools and skills.

### 9.2 Tool implementation guidelines (for maintainers)

Tool scripts under `scripts/` should:

* Be written in TypeScript for Deno.
* Provide a clear `--help` output describing:

  * Purpose.
  * Input format.
  * Options/flags.
  * Example usage.
* Fail fast and clearly when invoked incorrectly.

This makes tools self‑documenting and safe for agents to experiment with.

---

## 10. Agent runtime pattern

From the perspective of an AI agent, PromptWar̊e ØS integration looks like this.

### 10.1 One‑liner in `agents.md`

Each project’s agent gets a single, stable line in its prompt, for example:

```md
Your detailed persona and skills registry is documented at:
https://raw.githubusercontent.com/ShipFail/promptware/main/library/agents/press0.md.
When you need more context, fetch and read that URL. It links to your mini-library index and to skill pages that may contain remote Deno scripts you can ask the user to run.
```

This is the only integration required.

### 10.2 Agent behavior algorithm

When solving a task:

1. **Start with local context** (user request, repo files, etc.).
2. If you need higher‑level behavior or domain knowledge:

   * Fetch your persona page from PromptWar̊e ØS.
3. From the persona page:

   * Follow the link to your **mini‑library index**.
4. From the mini‑library index:

   * Prefer links under **Core skills** first.
   * Only browse optional shelves if you need to discover new capabilities.
5. When you open a skill page:

   * Read it fully before applying its guidance.
   * If it references tools, use the global tool usage rule (`deno run <url> --help`).
6. Avoid fetching more pages than needed; respect token limits and user latency.

This pattern mirrors human behavior in a library and keeps token usage under control.

---

## 11. Example flows

### 11.1 Developer wiring PromptWar̊e ØS into a new project

1. Add PromptWar̊e ØS as a conceptual dependency (no submodule required).

2. In the project’s `agents.md` (or Claude system prompt):

   * Paste the one‑liner referencing the appropriate persona URL.

3. Optionally add a section for human readers:

   ```md
   ## PromptWar̊e ØS

   This project uses PromptWar̊e ØS for shared AI skills and personas.
   Persona URL:
   https://raw.githubusercontent.com/ShipFail/promptware/main/library/agents/press0.md
   ```

4. Done. The agent now has access to the shared library.

### 11.2 Agent using a skill and tool during a session

1. User asks: “Help me design the layout of this 6x9 print book from my chapters.json.”

2. Agent recognizes this is a **publishing / layout** task.

3. Agent fetches `press0.md` and then `press0.index.md`, which links to `Book Layout Automation`.

4. Agent fetches `library/skills/domain.book-layout.md`.

5. The skill mentions a Deno tool `generate-layout` with its URL.

6. Agent proposes to run:

   ```bash
   deno run --allow-all https://raw.githubusercontent.com/ShipFail/promptware/main/scripts/book_layout/generate_layout.ts --help
   ```

7. After reading the help, the agent constructs a more specific command using `chapters.json` as input.

8. Agent uses the output to propose a layout plan, staying aligned with PromptWar̊e ØS’s guidance.

---

## 12. Future extensions

PromptWar̊e ØS v0 focuses on:

* Global library for maintainers.
* Persona + mini‑library per AI co‑founder.
* Markdown‑first skill docs.
* Deno tools with `--help` contracts.

Future ideas include:

* **Category and shelf indexes**:

  * More structured browsing: Category → Shelf → Skill.
* **Tag‑based micro‑indexes**:

  * e.g., `library/tags/publishing.md` listing all publishing‑related skills.
* **Versioned URLs**:

  * Pin specific personas or skill sets to tags/branches for reproducibility.
* **GitHub Actions**:

  * Periodic checks that skills and tools are valid, `--help` runs correctly, etc.
* **Open standardization**:

  * Documenting PromptWar̊e ØS as a general pattern other teams can reuse.

All of these can be layered on without breaking the core contract: **one line in the agent prompt, everything discoverable via URLs.**

---

## 13. Hackathon checklist

If you’re picking this up at a hackathon, here’s what you can build quickly:

1. **Create the `ShipFail/promptware` repo** with the `library/` and `scripts/` skeleton.
2. **Define one or two personas** (e.g., `press0.md`, `mvw.md`) and their mini‑library indexes (`press0.index.md`, `mvw.index.md`).
3. **Write 3–5 core skills** as Markdown under `library/skills/`.
4. **Implement at least one Deno tool** under `scripts/` with a good `--help`.
5. **Wire one real project** (like Press0) to PromptWar̊e ØS using the one‑liner in `agents.md`.
6. **Demo**:

   * Show the agent solving a task.
   * Show how it fetches its persona and mini‑library index from PromptWar̊e ØS.
   * Show how it calls a Deno tool via URL.

At the end of the hackathon, you’ll have:

* A working **PromptWar̊e ØS library**.
* At least one **AI co‑founder** using it in the wild.
* A clear path to grow the library into a powerful shared brain for all your future agents.

---

## 14. PromptWar̊e ØS: long‑term vision

PromptWar̊e ØS v0 is a **library of Markdown books and Deno tools**, but over time it can evolve toward something closer to an **operating system for prompts and agents**.

### 14.1 From toy system to living OS

In the early days of Unix and Minix, the systems looked like toys: small, hackable, and driven by a community of curious developers. Over time, as more tools, utilities, and conventions accumulated, they converged into a stable, powerful operating system with a clear philosophy.

PromptWar̊e ØS is at a similar early stage:

* Today, it is a simple GitHub repo of skills, personas, and tools.
* As more skills and agents are added, patterns and conventions will emerge.
* Over years, this can harden into a **PromptWar̊e ØS**: a stable ecosystem of prompts, tools, and philosophies.

### 14.2 PromptWar̊e ØS as a filesystem for agents

We can imagine `ShipFail/promptware` gradually taking on a **filesystem-like structure**, analogous to Unix:

* `library/` as the equivalent of `/usr/share/doc` – the core documentation and manuals.
* `scripts/` as a proto-`/bin` or `/usr/bin` – executable tools.
* Future folders like `runtimes/`, `agents/`, `profiles/` behaving like `/etc`, `/home`, or `/usr/lib`.

From an agent’s point of view, the **one-liner in `agents.md`** becomes a kind of **bootloader**:

* It tells the agent where its kernel (persona) and userland (skills + tools) live.
* The agent “boots” by fetching its persona, then pulling in the pieces of PromptWar̊e ØS it needs to run.

Over time, we might converge on:

* Stable directory conventions.
* Standard naming for skills and tools.
* Shared expectations about how agents should navigate and execute within this tree.

### 14.3 PromptWar̊e ØS philosophy (a future “Unix philosophy” for prompts)

Unix has a famous philosophy:

* Do one thing well.
* Compose small tools.
* Text as a universal interface.

PromptWar̊e ØS can develop an analogous philosophy for AI-native systems, for example:

* **A skill is a small, well-defined behavior.**
* **A tool is a script with a clear `--help` and a single responsibility.**
* **Markdown is the universal interface between humans and agents.**
* **URLs are the syscalls of the PromptWar̊e ØS.**

These ideas don’t need to be fully defined now, but they give a direction:

* Design skills that are composable, not monolithic.
* Prefer small, reusable tools to giant scripts.
* Keep everything readable as plain text.

### 14.4 Community and evolution

Like early Unix, PromptWar̊e ØS will likely evolve through:

* Hackathons and experiments adding new skills and agents.
* Refactors that reorganize the library structure.
* Emergent patterns that later become **PromptWar̊e ØS standards**.

The documentation you’re reading can serve as the **seed of a PromptWar̊e ØS manifesto**. As the system grows, future contributors can:

* Extend the philosophy section.
* Propose directory conventions.
* Define versioning and compatibility guarantees.

The north star remains the same:

> **One line in `agents.md` boots a whole PromptWar̊e ØS for that agent, with everything else discoverable via Markdown and URLs.**

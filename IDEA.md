# Promptware: A Cloud‑Native Library for AI Skills

## 0. One‑liner

**Promptware is a GitHub‑hosted, Markdown‑based library of skills and personas for AI agents, where everything is discovered and executed via URLs and Deno.**

One line in `agents.md` → a whole bookshelf of reusable skills and tools.

---

## 1. Elevator pitch

Today, every AI agent project hand‑maintains its own prompts, skills, and tool configs: `.claude/skills`, Copilot rules, Gemini configs, etc. They drift, duplicate, and become impossible to keep consistent across multiple repos.

**Promptware** turns all of that into a **single shared library**:

* All skills and personas live as **human‑readable Markdown** in a GitHub repo (`ShipFail/promptware`).
* Agents get **one canonical URL** in their system prompt that points to their persona & mini‑library.
* Skill pages can reference **Deno scripts** that run directly from GitHub raw URLs, with usage documented in `--help`.

No more copying config files across projects. No more updating skills in five places. You maintain one library; your AI co‑founders read from it on demand.

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

* A **global Promptware library** for maintainers.
* A **mini‑library per agent persona**, with their favorite and most relevant “books”.
* All reachable via URLs.

Agents don’t need to “carry” all skills in their context all the time. They just need:

1. A **short system prompt** explaining who they are and where their library lives.
2. The ability to **fetch and read** library pages on demand.
3. The ability to **run remote Deno tools** whose detailed usage is described via `--help`.

---

## 4. Design principles

These principles guide all of Promptware’s design decisions.

### 4.1 Radical simplicity

* The integration surface for any project should be **one line in `agents.md` or the system prompt**.
* No required `.claude/skills` sync, no heavy local config.
* If you know how to read Markdown and fetch a URL, you can use Promptware.

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

* There is a **global Promptware library** in `ShipFail/promptware`:

  * Maintainer‑facing indexes, shelves, and skills.
* Each AI co‑founder (persona) has a **mini‑library view**:

  * A single Markdown file that acts as their curated bookshelf of relevant skills.
* Agents never need to discover the entire universe; they just browse their own section.

### 4.5 Token frugality and cognitive ergonomics

* Index pages are **tiny**: lists of links with one‑line descriptions.
* Agents navigate like humans: **Category → Shelf → Book** instead of loading everything.
* Only the final chosen skill file is “big”, and even that is still just a document.

### 4.6 Deno tools with `--help` as contract

* Skill pages list **only concise tool descriptions and Deno URLs**.

* Detailed usage is obtained by running:

  ```bash
  deno run --allow-all <tool-url> --help
  ```

* This keeps Promptware docs lean, while giving tools a canonical source of truth for their interface.

### 4.7 No local sync required

* Promptware **does not require** syncing files into `.claude/skills` or other special folders.
* Projects are free to add convenience sync layers later, but the core contract is:

  * “Agents read Promptware over HTTP.”

---

## 5. High‑level architecture

### 5.1 Components

* **Promptware repo**: `ShipFail/promptware`

  * `library/` – Markdown “bookshelf” for skills, personas, and indexes.
  * `scripts/` – Deno tools callable via URL.

* **AI projects** (e.g., Press0, MVW)

  * Each project has an `agents.md` or system prompt that includes **one Promptware line**.

* **AI agents / runtimes**

  * Capable of fetching URLs and reading Markdown.
  * Optionally able to propose or execute Deno commands.

### 5.2 Data flow

1. Developer defines skills, personas, and tools in `ShipFail/promptware`.
2. A project’s agent persona is given a single “library URL” line in its prompt.
3. On demand, the agent:

   * Fetches its persona page from Promptware.
   * Follows links to mini‑indexes and skills.
   * Reads skill docs and (optionally) suggests Deno commands to run tools.

No deployment steps beyond `git push`. As soon as Promptware is updated, all agents that read from it see the new content.

---

## 6. The Promptware Library layout

A minimal initial layout for the Promptware repo:

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
      press0.md
      mvw.md
  scripts/                # Deno tools with good --help output
    format_ts.ts
    book_layout/generate_layout.ts
```

### 6.1 Global library (for maintainers)

`library/index.md` can provide a high‑level overview of categories and shelves, primarily for humans maintaining the system. Agents may not need to read this file directly in normal operation.

### 6.2 Agent mini‑libraries (for AI co‑founders)

Each agent persona has **one main Markdown file** under `library/agents/`, e.g. `press0.md`, which contains:

* A short persona description (who they are and what product they serve).
* A curated list of **favorite skills** with direct links.
* Optional links to relevant shelves or tags if you want to expose more browsing power.

This file is both:

* The place you send the agent via the one‑liner in `agents.md`.
* The agent’s “favorite bookshelf” view of the library.

---

## 7. Persona & mini‑library design

### 7.1 Example: `library/agents/press0.md`

```md
---
id: agent.press0
type: persona
title: "Press0 AI Co-founder"
version: "0.1.0"
---

# Press0 AI Co-founder

You are the AI co-founder for **Press0**, a book-centric publishing product under the ShipFail organization.

When you need more context about your skills and tools, this page is your **mini-library**.

## Core skills

These are the primary skills you will most frequently rely on:

- [ShipFail Coding Style](../skills/core.coding-style.md)
- [Publishing Workflow Basics](../skills/domain.publishing-basics.md)
- [Book Layout Automation](../skills/domain.book-layout.md)

You should:

- Only fetch a skill page when it is relevant to the user’s task.
- Read the whole skill carefully before applying it.
- If the skill references Deno tools, run them with `--help` first to learn how they work.

## Optional shelves

If you need a broader overview of available skills, you may consult these shelves:

- [Layout & Print Shelf](../shelves/publishing/layout-and-print.md)
- [Testing & CI Shelf](../shelves/engineering/testing-and-ci.md)

Only consult shelves when you truly need to discover new skills.
```

This file is compact, but it tells the agent:

* Who they are.
* Where their main skills live.
* How to browse deeper if necessary.

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

When you want to use a tool:

1. First, run it with `--help` to learn its usage.
2. Then construct a concrete command based on the help output.
```

The detailed usage of `format_ts.ts` lives inside the script’s `--help` output, not in the skill doc itself.

---

## 9. Tools and the global usage pattern

Tool usage is one of the most basic conventions across all Promptware skills, so we standardize it at a **global level**.

### 9.1 Global rule: how to use a Deno tool

**When you want to use any tool referenced in a Promptware skill:**

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

From the perspective of an AI agent, Promptware integration looks like this.

### 10.1 One‑liner in `agents.md`

Each project’s agent gets a single, stable line in its prompt, for example:

```md
Your detailed persona and skills registry is documented at:
https://raw.githubusercontent.com/ShipFail/promptware/main/library/agents/press0.md.
When you need more context, fetch and read that URL. It also references skill pages that may contain remote Deno scripts you can ask the user to run.
```

This is the only integration required.

### 10.2 Agent behavior algorithm

When solving a task:

1. **Start with local context** (user request, repo files, etc.).
2. If you need higher‑level behavior or domain knowledge:

   * Fetch your persona page from Promptware.
3. From the persona page:

   * Prefer links under **Core skills** first.
   * Only browse optional shelves if you need to discover new capabilities.
4. When you open a skill page:

   * Read it fully before applying its guidance.
   * If it references tools, use the global tool usage rule (`deno run <url> --help`).
5. Avoid fetching more pages than needed; respect token limits and user latency.

This pattern mirrors human behavior in a library and keeps token usage under control.

---

## 11. Example flows

### 11.1 Developer wiring Promptware into a new project

1. Add Promptware as a conceptual dependency (no submodule required).

2. In the project’s `agents.md` (or Claude system prompt):

   * Paste the one‑liner referencing the appropriate persona URL.

3. Optionally add a section for human readers:

   ```md
   ## Promptware

   This project uses Promptware for shared AI skills and personas.
   Persona URL:
   https://raw.githubusercontent.com/ShipFail/promptware/main/library/agents/press0.md
   ```

4. Done. The agent now has access to the shared library.

### 11.2 Agent using a skill and tool during a session

1. User asks: “Help me design the layout of this 6x9 print book from my chapters.json.”

2. Agent recognizes this is a **publishing / layout** task.

3. Agent fetches `press0.md` and sees a link to `Book Layout Automation`.

4. Agent fetches `library/skills/domain.book-layout.md`.

5. The skill mentions a Deno tool `generate-layout` with its URL.

6. Agent proposes to run:

   ```bash
   deno run --allow-all https://raw.githubusercontent.com/ShipFail/promptware/main/scripts/book_layout/generate_layout.ts --help
   ```

7. After reading the help, the agent constructs a more specific command using `chapters.json` as input.

8. Agent uses the output to propose a layout plan, staying aligned with Promptware’s guidance.

---

## 12. Future extensions

Promptware v0 focuses on:

* Global library for maintainers.
* Mini‑library per persona.
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

  * Documenting Promptware as a general pattern other teams can reuse.

All of these can be layered on without breaking the core contract: **one line in the agent prompt, everything discoverable via URLs.**

---

## 13. Hackathon checklist

If you’re picking this up at a hackathon, here’s what you can build quickly:

1. **Create the `ShipFail/promptware` repo** with the `library/` and `scripts/` skeleton.
2. **Define one or two personas** (e.g., `press0.md`, `mvw.md`) with mini‑libraries.
3. **Write 3–5 core skills** as Markdown under `library/skills/`.
4. **Implement at least one Deno tool** under `scripts/` with a good `--help`.
5. **Wire one real project** (like Press0) to Promptware using the one‑liner in `agents.md`.
6. **Demo**:

   * Show the agent solving a task.
   * Show how it fetches a skill from Promptware.
   * Show how it calls a Deno tool via URL.

At the end of the hackathon, you’ll have:

* A working **Promptware library**.
* At least one **AI co‑founder** using it in the wild.
* A clear path to grow the library into a powerful shared brain for all your future agents.

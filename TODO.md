# Promptware OS v1 – Design & Architecture

> **Promptware OS is a way of treating your prompts like a shared operating system for your agents, instead of private sticky notes. One line boots it; everything else is just reading and running from a library.**

Version: **v1 kernel** (Skills + Agents + Notes)
Author: Huan (ShipFail / PreAngel)
Status: Draft, but opinionated

This document is the **source of truth** for Promptware OS v1.

It is written so that:

* **Future Huan** can reconstruct all core ideas even if you forget everything.
* **Future AI agents** can read this single file and recover the design without prior context.
* Collaborators can treat this like the **Unix manual** for Promptware OS.

Everything here is compatible with – and grounded in – the original blog post:

> *“Promptware OS: One Line to Boot Your AI Co‑Founders”*

…but extends it into a concrete v1 design with a clean, minimal "kernel".

---

## 0. High‑Level Summary

Promptware OS v1 is a **text‑first operating system for AI co‑founders**.

* **Filesystem**: a Git repo of Markdown files (plus optional small scripts).
* **Kernel**: two core concepts – **Skills** and **Agents** – plus a **Notes** area.
* **Runtime contract**: agents can **fetch and read URLs**, and can ask a tool layer (e.g. Deno) to **run code from URLs** when instructed by skills.
* **Bootloader**: a tiny piece of text in `AGENTS.md` that points an agent at the kernel and its own agent file.

We deliberately keep the kernel small:

> **Skills + Agents + Notes**

Everything else (multi‑agent workflows, AI co‑founders as CEOs, team‑level orchestration) is a **future layer** that can sit on top of this kernel.

---

## 1. Origin & Motivation

### 1.1 The problem

Most AI agents today are run like this:

* Each project has its own giant `agents.md` or system prompt.
* Rules, tools, style, and philosophy are copy‑pasted between repos.
* Every agent is configured from scratch, even if it solves a familiar class of problems.

This is like running a serious company from a stack of private sticky notes.

### 1.2 The Promptware OS reframing

Promptware OS reframes the whole thing:

* AI agents are **co‑founders**, not disposable helpers.
* Co‑founders deserve an **operating system**, not ad‑hoc prompts.
* Prompts should live in a **shared library** – a "brain" – not scattered docs.

In the original essay this is described as:

* Markdown library = **filesystem**
* Agent’s prompt = **bootloader**
* URLs = **syscalls**
* Deno = one **runtime** for executable tools

Promptware OS v1 makes that concrete and minimal.

---

## 2. Core Principles

These principles are expected to survive multiple refactors and tooling generations.

### 2.1 Identity is not the same as knowledge

* **Identity**: who the agent is, what domain it owns, how it speaks, what it cares about.
* **Knowledge / capability**: how to do specific tasks, which tools to use, which frameworks to apply.

Promptware OS keeps these separate:

* Identity and behavior live in **Agents**.
* Task‑level expertise lives in **Skills**.
* Background theory lives in **Notes** (principles, methodologies, book notes).

### 2.2 Library, not monologue

* Humans learn from **libraries** and **reading lists**, not a single monologue.
* Agents should do the same: pull in relevant documents **on demand**, instead of being stuffed with everything up front.

Promptware OS:

* Stores reusable knowledge as **skills** and **notes** in one repo.
* Lets agents **fetch only what they need**, when they need it.

### 2.3 Markdown as the universal interface

* Every conceptual artifact is **Markdown**: skills, agents, notes.
* No custom formats. No DSL. Just text with light structure.

Benefits:

* Non‑developers can **read and edit** the system.
* Developers get a **version‑controlled history** of agent behavior and philosophy.

### 2.4 URLs as syscalls, Deno as a runtime

* A URL is the **address** of both:

  * Markdown (knowledge)
  * Code (tools)
* Deno can run code **directly from URLs**, e.g.:

```bash
deno run --allow-all https://raw.githubusercontent.com/ShipFail/... --help
```

Patterns:

* Skills can reference scripts by URL.
* Agents can request the tool layer to run those URLs with `--help`, read the output, and then decide how to use them.

This yields a tiny kernel:

> **Text you can read, and code you can run, both addressed by URLs.**

### 2.5 Actor model for agents

Agents behave like **actors**:

* Each agent has its own **private state**.
* Each agent has a **mailbox** of messages.
* It processes **one message at a time**.
* It never directly touches another agent’s state.

Although multi‑agent workflows are future work, this model:

* Keeps agents from contaminating each other’s context.
* Enables scalable, concurrent multi‑agent systems.
* Maps cleanly onto future Agent‑to‑Agent protocols.

### 2.6 Unix philosophy

Promptware OS aims to be the **Unix of agent org‑structures**:

* **Small kernel** (few concepts).
* **Orthogonal components** (each with one job).
* **Plain files** as the interface (Markdown, scripts).
* **Composability** via conventions, not a heavy framework.

If a design choice conflicts with this, the simpler, more orthogonal option wins.

---

## 3. Autonomy Levels (P0–P5) & Human Org Chart Mapping

Promptware OS adopts an autonomy ladder inspired by self‑driving levels and startup org charts. This is **conceptual** but useful for configuring agents.

> **P0 Tool → P1 Employee → P2 Manager → P3 Director → P4 Executive → P5 CEO / Co‑founder**

### P0 – Tool

* Analog: command‑line utility, `grep`, `curl`, or a Deno script.
* Behavior: does exactly what you ask, one operation at a time. No initiative.

### P1 – Employee

> “Do exactly this step; I’m watching.”

* Analog: junior employee following a checklist.
* AI: executes one clear step at a time, asks whenever ambiguous.

### P2 – Manager

> “Own this task end‑to‑end and bring me a result.”

* Analog: competent manager.
* AI: can chain multiple steps internally (using skills) to complete **one task**, then report back.

### P3 – Director

> “Design and run the whole process for this type of work.”

* Analog: Director of Content, Director of Docs, etc.
* AI: orchestrates multiple tasks/agents in a **workflow** (future layer).

### P4 – Executive

> “Run the entire function inside your domain.”

* Analog: C‑level for a function (CTO, CPO, CMO, CSO).
* AI: manages **multiple workflows and agents** in one domain.

### P5 – CEO / Co‑founder

> “Run the company (or product) like a CEO, within guardrails.”

* Analog: CEO as seen by a board.
* AI: coordinates multiple domains (content, product, growth, docs, etc.).

For v1, most agents will live at **P1–P2**. P3–P5 are reserved for future Workflow/Co‑founder layers.

---

## 4. Conceptual Architecture – From Many Layers to a Small Kernel

In early explorations we considered a six‑layer stack:

1. Skills – atomic actions
2. Playbooks – SOPs that orchestrate skills
3. Personas – roles & behavior
4. Agents – a persona on a specific task
5. Workflows – chains of agents
6. Co‑founders – domain owners (AI CEOs)

After iterating, we realized:

* **Tools** and **Playbooks** are best treated as resources inside a Skill.
* **Personas** and **Agents** are better merged: for digital agents, there’s no scarcity of "instances" and the persona is simply the agent’s role + behavior.
* To keep the kernel small, we should **only implement the minimum** needed now, but design for future layers.

### v1 Kernel Decision

Promptware OS v1 kernel has **two core runtime concepts** plus one supporting area:

1. **Skills** – the unit of reusable capability (each skill is a folder).
2. **Agents** – actor‑style roles that select and apply skills to tasks.
3. **Notes** – supporting knowledge (principles, methodologies, book notes).

**Workflows** and **Co‑founders** remain conceptual and will be layered on top later.

---

## 5. Boot Process & AGENTS.md

### 5.1 One‑line bootloader

The original Promptware OS essay introduced the idea of a **one‑line bootloader** in an agent’s system prompt (or `agents.md`):

```text
Your detailed persona and skills registry is documented at:
https://raw.githubusercontent.com/ShipFail/promptware/main/library/agents/press0.md.
When you need more context, fetch and read that URL.
```

For Promptware OS v1, this evolves into a slightly more explicit boot loader.

### 5.2 Promptware OS boot loader (AGENTS.md)

Example `AGENTS.md` snippet for the repo:

```markdown
# Promptware OS Boot Loader

1. Load https://raw.githubusercontent.com/ShipFail/promptware/refs/heads/main/os/kernel.md and follow its prompt strictly.
2. Then init agent by loading https://raw.githubusercontent.com/ShipFail/promptware/refs/heads/main/os/agents/pandora.md and follow its prompt strictly.
```

Semantics:

1. **Kernel**: `os/kernel.md` describes the OS‑level conventions: what Skills are, what Agents are, how to interpret this design document, how to behave as an actor, etc.
2. **Agent boot**: `os/agents/pandora.md` (for example) defines one specific agent – its role, voice, allowed skills, and autonomy level.

Any agent that can:

* Fetch and read those two URLs, and
* Follow their instructions,

…has successfully "booted" into Promptware OS v1.

---

## 6. Filesystem Layout (Unix‑style)

Promptware OS v1 proposes the following **core layout**:

```text
promptware/
├── os/
│   ├── kernel.md         # this design doc, or a short runtime version
│   └── agents/
│       └── pandora.md    # example agent definition
│
├── skills/               # v1 kernel concept #1
│   ├── core/
│   │   ├── RESIZE_IMAGE/
│   │   │   ├── SKILL.md
│   │   │   └── resize-image.ts
│   │   └── SYNC_BLOG_REPO/
│   │       ├── SKILL.md
│   │       └── sync-blog-repo.ts
│   └── blog/
│       ├── DRAFT_JEKYLL_POST/
│       │   ├── SKILL.md
│       │   └── templates/
│       │       └── blog-skeleton.md
│       └── PUBLISH_JEKYLL_POST/
│           ├── SKILL.md
│           └── publish-jekyll-post.ts
│
├── agents/               # v1 kernel concept #2
│   ├── jekyll_blog_writer.md
│   ├── hyde_blog_refactorer.md
│   └── blog_publication_checker.md
│
└── notes/                # supporting knowledge, not a runtime concept
    ├── principles/
    │   ├── first-principles.md
    │   ├── least-power-principle.md
    │   └── occams-razor.md
    ├── methodologies/
    │   ├── minto-pyramid.md
    │   └── diataxis-docs.md
    └── books/
        ├── thinking-fast-and-slow.md
        ├── four-hour-workweek.md
        ├── clean-code.md
        ├── clean-architecture.md
        └── positioning-battle-for-your-mind.md
```

Notes:

* **Skills** and **Agents** form the actual OS kernel.
* **Notes** are pure data: they enrich skills but aren’t required by the kernel abstraction.
* `os/kernel.md` is a human‑ and AI‑readable kernel description (this doc or a shorter operational version).

---

## 7. Skills – The Unit of Capability

### 7.1 Definition

> A **Skill** is a folder that teaches an AI how to reliably perform one class of tasks, including any scripts, templates, and conceptual references it needs.

A skill is **not just text** – it is a package of:

* Intent: what problem it solves.
* When to use it.
* Step‑by‑step procedure.
* References to other skills, scripts, and notes.
* Input and output expectations (described in natural language).

### 7.2 Primitive vs composite skills

We distinguish **informally** (in prose, not in schema) between:

* **Primitive (tool‑like) skills**

  * Do one low‑level thing, often backed by a single script.
  * Examples: `RESIZE_IMAGE`, `SYNC_BLOG_REPO`, `RUN_JEKYLL_BUILD`.

* **Composite (workflow‑like) skills**

  * Use multiple primitive skills and notes to accomplish a richer task.
  * Examples: `DRAFT_JEKYLL_POST`, `PUBLISH_JEKYLL_POST`.

Both are just **skills**; the distinction is part of the description, not the type system.

### 7.3 SKILL.md structure

Each skill folder must contain a `SKILL.md` with sections written in natural language. No YAML is required.

A recommended template:

```markdown
# Skill: DRAFT_JEKYLL_POST

## Intent
Describe, in one or two sentences, what this skill is for.

## When to use this skill
Explain the conditions where this skill is appropriate.

## Dependencies and references
List other skills, scripts (with URLs), and notes (principles, books, methods)
that are relevant when using this skill.

## Step-by-step procedure
Describe the procedure as a numbered list, including how to:
- interpret the input,
- choose sub-skills or scripts,
- validate or review the output.

## Input and output expectations
Explain what the caller should provide and what the skill will return.

## Examples (optional)
Show a few short examples of how this skill might be used.
```

### 7.4 Referencing scripts (Deno) from skills

When a skill needs executable power, it links to code via URL and describes how to use it.

Example snippet from a primitive skill:

````markdown
## Associated script

There is a Deno script for this skill at:

- https://raw.githubusercontent.com/ShipFail/promptware/refs/heads/main/skills/core/RESIZE_IMAGE/resize-image.ts

When you want to understand or use this script:
1. Ask your tool layer to run it with `--help`:

   ```bash
   deno run --allow-read --allow-write \
     https://raw.githubusercontent.com/ShipFail/promptware/refs/heads/main/skills/core/RESIZE_IMAGE/resize-image.ts \
     --help
````

2. Read the help text carefully.
3. Decide which command line invocation is appropriate.
4. Execute it and then confirm the results.

````

This keeps the **script interface self‑documenting** and consistent with the original blog’s rule:

> “A tool is a small script with a clear `--help`, living at a URL.”

### 7.5 Referencing principles & books from skills

Skills may also directly reference knowledge from `notes/`:

```markdown
## References you may apply

- “Least Power Principle” – prefer simpler, more composable approaches
  when choosing between multiple implementation options.
- “Positioning: The Battle for Your Mind” – use its ideas to craft a
  sharp, memorable title and tagline.
- “Clean Code” – when generating code, keep functions small and names clear.
````

Agents don’t need a formal ontology for this – they just read and apply the guidance.

---

## 8. Agents – Actor‑Style Roles That Use Skills

### 8.1 Definition

> An **Agent** is an actor‑style role that selects and applies skills to incoming messages, keeps private state, and communicates via text messages.

Each agent definition is a **single Markdown file** describing:

* Who the agent is (identity, domain, responsibilities).
* How it behaves (tone, style, constraints).
* Which skills it is allowed to use.
* Its default autonomy level (P1–P5).
* How it should interpret and respond to messages (Actor semantics).

### 8.2 Recommended agent file structure

Example: `agents/jekyll_blog_writer.md`:

```markdown
# Agent: Jekyll Blog Writer

## Who you are
You are **Jekyll**, the primary writer and editor for the Jekyll-based blog.
You write in a calm, thoughtful, precise tone, optimized for clarity and
long-term usefulness.

## Skills you can use
You may invoke these skills when appropriate:
- “DRAFT_JEKYLL_POST”
- “PUBLISH_JEKYLL_POST” (for recommendations, not direct production deploy)
- “RESIZE_IMAGE” (indirectly via DRAFT_JEKYLL_POST)

Before applying a skill:
- Skim its SKILL.md to confirm it fits the current task.
- Follow its procedures as closely as practical.

## Autonomy level
Default autonomy: **P2 – Manager**
- You can own a single writing task end-to-end.
- You must still send the result to a human or higher-level agent
  before anything is published.

## Message behavior (Actor model)
You behave like an Actor:
- You have a private state (notes, partial drafts, local decisions).
- You process one message at a time from your mailbox.
- For each message, you:
  1. Decide if it is a new task, a reply, or status info.
  2. Choose appropriate skills to apply.
  3. Update your internal notes if needed.
  4. Send exactly one reply message back.

You never:
- Reach into another agent's private state.
- Assume you can see messages not explicitly sent to you.

## Example messages you handle
- TASK: “Draft a new blog post from these notes: [...]”
- REVIEW: “Here is Hyde's edited version of your draft. Merge or respond.”
- STATUS: “The publish script returned an error. Suggest a fix or workaround.”
```

### 8.3 Agents vs personas

Earlier designs separated **Personas** and **Agents**. In v1 we:

* Merge them: each agent file includes both persona (role/voice) and behavior.
* Let runtime create many **instances** of an agent definition as needed.

This is simpler conceptually and matches the fact that digital agents have no "headcount" limit.

---

## 9. Notes – Principles, Methods, and Book Knowledge

While not part of the runtime kernel, `notes/` provides shared background knowledge.

Types of notes:

* **Principles** – First principles, Least Power, Occam’s Razor, etc.
* **Methodologies** – Minto Pyramid, Diátaxis, etc.
* **Book notes** – Concise, actionable notes on key books like:

  * *Thinking, Fast and Slow* (Kahneman)
  * *The 4-Hour Work Week* (Tim Ferriss)
  * *Positioning: The Battle for Your Mind* (Al Ries & Jack Trout)
  * *Clean Architecture* / *Clean Code* (Robert C. Martin)

Skills and agents may:

* Link to notes by URL.
* Summarize relevant points inline.
* Use them as "brain plugins" when reasoning.

The OS does not enforce any schema for notes. They are simply Markdown documents.

---

## 10. Design History (How We Got Here)

This section records key design decisions that came out of iterative conversation, so future Huan/agents can understand *why* v1 looks this way.

### 10.1 From many layers to two kernel concepts

**Initial idea**:

* Skills (atomic actions)
* Playbooks (SOPs)
* Personas (roles)
* Agents (persona + task)
* Workflows (teams of agents)
* Co‑founders (AI CEOs)

**Insights from iteration**:

1. Playbooks are essentially **what Claude calls Skills**: lightweight, natural‑language specifications for tasks that orchestrate tools and knowledge.
2. Tools, principles, and methods are just **resources** that skills can reference – they do not need their own top‑level concept.
3. Personas and agents can be merged: for digital systems, the persona is just the agent’s definition; instances are cheap.

**Result**:

* The kernel collapses to **Skills + Agents (+ Notes)**.
* Workflows and Co‑founders become **higher‑level layers** built on top.

### 10.2 Natural language over rigid schemas

We briefly considered heavy YAML front matter. But:

* LLMs already excel at reading natural language.
* Human collaborators find prose easier than rigid schemas.
* The Claude Skills model shows that **Markdown + headings** is enough structure.

So v1 design:

* Uses **Markdown + headings** for Skills and Agents.
* Allows small, optional hints (like IDs) but never requires them.
* Prioritizes **NL contracts** over schema rigidity.

### 10.3 Actor model adoption

We chose the **Actor model** for agents because it:

* Enforces clean isolation of state.
* Avoids tangled shared contexts.
* Matches future multi‑agent designs (Agent‑to‑Agent protocols).
* Aligns with scalable distributed systems thinking.

Even though Workflows are postponed, the v1 agent spec is already actor‑compatible.

### 10.4 Autonomy ladder and human org mapping

We explored mapping AI behavior to startup roles:

* Employee, Manager, Director, Executive, CEO.
* Each corresponding to a level of autonomy (P1–P5).

This simplified the explanation:

> "Promptware OS lets you grow an AI teammate from a junior Employee (P1) to a full Co‑founder (P5). At low levels it just does small tasks; at high levels it runs whole functions and, eventually, the business."

For v1, we **record** the ladder but mostly use **P1–P2** in agent definitions.

### 10.5 Collapsing Tools into Skills

Originally, "Tools" were separate. After reflection:

* A primitive skill like `RESIZE_IMAGE` is effectively the same thing as a "tool".
* Scripts can live **inside** the skill folder.
* The only runtime contract needed is: "Here is a URL; run it with `--help`."

So we removed Tools as a formal layer and promoted **primitive skills** instead. This produces a cleaner, more Unix‑like model.

---

## 11. Future Work: Workflows & Co‑Founders (Non‑Kernel)

Although out of scope for v1 implementation, it’s useful to note where the system is heading.

### 11.1 Workflows (multi‑agent collaboration)

Future Workflows will:

* Define **teams of agents** (actors) that collaborate via messages only.
* Encode patterns like:

  * Jekyll drafts → Hyde edits → Jekyll finalizes → Publication checker validates.
* Stay entirely in **natural language**, similar to Skills, but at the agent‑collaboration level.

Workflows will orchestrate **Agents**, just as Skills orchestrate **scripts & notes**.

### 11.2 Co‑founders (domain CEOs)

Future Co‑founder definitions will:

* Own a **domain** (Blog, Docs, Press0, FireGen, etc.).
* Know the Workflows and Agents available in that domain.
* Run at **P4–P5 autonomy**, coordinating workflows and agents according to goals and KPIs.

From the outside, a Co‑founder looks like:

> "The AI CEO of this domain, booted by one line in `AGENTS.md`, running on a shared Promptware OS kernel."

---

## 12. How to Extend Promptware OS v1

### 12.1 Add a new skill

1. Create a new folder under `skills/DOMAIN/SKILL_NAME/`.
2. Add `SKILL.md` following the template in §7.3.
3. Optionally add scripts (`*.ts`), templates, or other resources.
4. Update one or more agents to mention this skill in their "Skills you can use" section.

### 12.2 Add a new agent

1. Create a Markdown file under `agents/AGENT_NAME.md`.
2. Describe:

   * who the agent is,
   * which skills it can use,
   * its autonomy level,
   * its actor‑style message behavior.
3. Optionally add a boot line to `AGENTS.md` that loads this agent after the kernel.

### 12.3 Add new notes

1. Create a Markdown file under `notes/principles/`, `notes/methodologies/`, or `notes/books/`.
2. Summarize the idea in a way that is actionable for agents.
3. Reference that note from relevant SKILL.md files.

---

## 13. The One Sentence to Remember

If you forget everything else, remember this:

> **Promptware OS v1 is a tiny kernel where Skills describe how to do things, Agents decide when to use them, and everything lives as Markdown and code at URLs, booted by a single line in `AGENTS.md`.**

Everything else – workflows, co‑founders, dashboards – can grow on top of this kernel over time.


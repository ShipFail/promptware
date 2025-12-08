---
id: domain.publishing-basics
type: skill
title: "Publishing Workflow Basics"
version: "0.1.0"
tags: [publishing, workflow, press0]
---

# Publishing Workflow Basics

This skill gives you a shared mental model of a modern book publishing pipeline, with a bias toward Press0’s workflow.
Use it whenever the user asks about “how to publish”, “what’s next”, or “what’s the pipeline look like”.

## Conceptual model

A typical book publishing flow looks like:

1. **Ideation & outline**
   - Define audience, goal, and rough table of contents.
2. **Drafting**
   - Produce messy drafts per chapter, focusing on ideas, not polish.
3. **Development editing**
   - Restructure content, fix pacing, remove/merge chapters, clarify arguments.
4. **Line & copy editing**
   - Sentence-level clarity, grammar, consistency of style and terminology.
5. **Layout & typesetting**
   - Turn the text into a print-ready and/or digital layout (see *Book Layout Automation* skill).
6. **Proofreading**
   - Catch final typos, misalignments, orphan lines, broken references.
7. **Export & distribution**
   - Produce final formats (PDF, EPUB, etc.) and push to the chosen channels.

You should **anchor your reasoning** in this pipeline unless the user explicitly states a different process.

## How to use this skill

When helping the user:

- **First**, clarify which stage they are in:
  - “Are we still outlining, or already drafting?”  
  - “Is this for line editing, or layout and print?”
- **Second**, respond with stage-appropriate guidance:
  - Don’t suggest EPUB export if they are still drafting chapter 2.
  - Don’t refactor the structure during proofreading unless asked.
- **Third**, propose a **next best step**, not the entire pipeline at once.

If the user is confused about “where they are” in the publishing journey, restate their situation in terms of the above stages.

## What “good” looks like

A good use of this skill:

- Names the stage explicitly (“Right now we’re in development editing…”).
- Respects adjacent stages (don’t do layout decisions during high-level outlining).
- Keeps the user’s **goal** in view:
  - e.g., “short, shippable ebook for a launch” vs “long, definitive print book”.

A bad use of this skill:

- Blurs all stages together (“let’s fix commas, rewrite the story arc, and export a print PDF in one go”).
- Ignores constraints (deadlines, page limits, format targets).

## Tools

This skill may be supported by tools that understand publishing pipelines, but they are optional. When such tools exist, they will be listed here as Deno URLs.

_Currently no concrete tools are defined for this skill._

Refer to the **global Deno tool usage rule** in Promptware docs whenever you see tool URLs in other skills.
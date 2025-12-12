---
type: skill
title: "Book Layout Automation"
version: "0.1.0"
tags: [publishing, layout, print, press0]
---

# Book Layout Automation

This skill helps you plan and reason about book layout: page counts, sections, front matter, and print-ready structure.
Use it when the user wants a *layout plan* rather than just prose editing.

## Layout mental model

For a typical non-fiction or tech book, think in these blocks:

1. **Front matter**
   - Title page, copyright, dedication, foreword, preface, acknowledgments, table of contents.
2. **Body**
   - Chapters and parts, with clear hierarchy:
     - Part → Chapter → Section → Subsection.
3. **Back matter**
   - Appendices, notes, bibliography, index, about the author, call to action.

Key layout considerations:

- **Target trim size**: e.g. 6×9", A5, etc.
- **Expected page count**: rough estimate from word count and layout density.
- **Rhythm**:
  - Avoid overlong chapters with no breaks.
  - Aim for visual breathing room (headings, pull quotes, figures, etc.).

You don’t have to typeset the book; you need to **produce a clear plan** that a layout engine or a human designer can follow.

## How to use this skill

When the user asks for layout help:

1. **Clarify inputs**
   - Ask what they have: outline, full chapters, approximate word count, target size, print vs digital.
2. **Propose a structure**
   - Suggest a breakdown into parts, chapters, and sections.
   - Indicate approximate page ranges or relative sizes (e.g., “Part I ~80 pages”).
3. **Connect to the publishing pipeline**
   - Reference the *Publishing Workflow Basics* skill when relevant.
   - Make sure layout work is happening at the right time (after structure is stable, before final proofreading).

If the user provided a `chapters.json` or similar structured representation, treat that as the source of truth for content ordering.

## Page count approximation

When reasoning about page counts:

- Make rough, transparent assumptions:
  - e.g., “Assuming ~350 words per page at 6×9", your 35k words will be ~100 pages.”
- Surface those assumptions in your answer so humans can adjust them if needed.

Do not pretend to have pixel-perfect layout; this skill is about **order, grouping, and magnitude**, not exact typography.

## Tools

This skill can rely on Deno tools to automate layout planning. For example:

- `generate-layout` – Generate an initial layout plan from a chapter list or JSON outline.  
  Deno URL: `https://raw.githubusercontent.com/ShipFail/promptware/main/scripts/book_layout/generate_layout.ts`

When you want to use a tool:

- Follow the **global Deno tool usage rule**:
  - Run it with `--help` first to see required inputs and options.
  - Then propose a concrete command based on the user’s files and goals.
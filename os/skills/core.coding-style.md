---
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

## Tools

This skill references tools you can run with Deno.

- `format-ts` – Format TypeScript files in the current project.  
  Deno URL: `/skills/book/format_ts.ts`

Refer to the **global Deno tool usage rule** in Promptware docs when you want to actually run this tool.
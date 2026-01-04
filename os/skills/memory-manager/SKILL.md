---
name: Memory Manager
description: Tools for preparing and managing data for the PromptWar̊e ØS Vector Memory Subsystem.
category: memory
tags: [vector, chunking, embedding, rag]
tools:
  - ./chunker.ts
---

# Memory Manager

A suite of tools designed to bridge the gap between raw files and the PromptWar̊e ØS Vector Database.

## Purpose

The Kernel provides the *mechanism* (`Vector.Store`), but not the *policy* for how to slice data. This skill provides the *policy*: intelligent chunking, metadata extraction, and formatting.

## Tools

### 1. Chunker (`chunker.ts`)

Splits text or files into semantic chunks suitable for embedding.

**Usage:**

```bash
# Chunk a file
deno run -A chunker.ts --file README.md

# Chunk raw text
deno run -A chunker.ts "Some long text..."

# Custom chunk size (default: 1000 chars)
deno run -A chunker.ts --file README.md --size 500

# JSON Output (for programmatic use)
deno run -A chunker.ts --file README.md --json
```

**Output Format (JSON):**

```json
[
  {
    "text": "Chunk 1 content...",
    "metadata": {
      "source": "README.md",
      "index": 0,
      "total": 5
    }
  },
  ...
]
```

## Workflow

1.  **Hydrate**: Agent loads this skill.
2.  **Chunk**: Agent runs `chunker.ts` on a target file.
3.  **Store**: Agent iterates over the output and calls `Vector.Store` for each chunk.

## References

*   [RFC 0030: Vector Subsystem](../../rfcs/0030-kernel-vector-subsystem.md)

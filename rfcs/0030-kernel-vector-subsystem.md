---
rfc: 0030
title: Kernel Vector Subsystem
author: Ship.Fail
status: Draft
type: Standards Track
created: 2026-01-04
updated: 2026-01-04
version: 1.1.0
tags: [kernel, vector, embedding, search, orama]
---

# RFC 0030: Kernel Vector Subsystem

## 1. Summary

This RFC defines the **Vector Subsystem** for PromptWare OS, providing "Long-Term Semantic Memory" to agents. It specifies a **Hybrid Architecture** using **Deno KV** for durable storage and **Orama** (in-memory) for vector search, ensuring a "Pure TypeScript" implementation with zero native dependencies.

## 2. Motivation

Agents need to retrieve information based on *meaning*, not just exact keywords. A Vector Subsystem allows agents to:
1.  **Recall** past conversations (Episodic Memory).
2.  **Search** codebases and documentation (Semantic Search).
3.  **Classify** intent based on similarity.

Existing solutions (Pinecone, Weaviate) require external API keys or Docker containers. `sqlite-vec` requires native binaries. PromptWare OS requires a **Zero-Config, Local-First** solution that works immediately after `git clone`.

## 3. Architecture

### 3.1. The Hybrid Storage Model

To balance **Persistence** (ACID) with **Performance** (In-Memory Search), we use a split-brain architecture:

1.  **The Source of Truth (Deno KV)**:
    *   Raw documents and their embeddings are stored in Deno KV.
    *   Key Schema: `["vector", "store", collection, id]`
    *   Value Schema: `{ id, text, metadata, embedding }`
    *   Benefit: Incremental writes, crash safety, zero-config persistence.

2.  **The Search Index (Orama)**:
    *   An in-memory Orama index is maintained for search.
    *   **Boot**: On kernel startup, the index is **hydrated** from Deno KV.
    *   **Write**: Writes go to Deno KV *and* the Orama index simultaneously.
    *   Benefit: Extremely fast search, no serialization overhead for single writes.

### 3.2. Embedding Strategy

The subsystem supports pluggable embedding providers.

*   **Default (Local)**: `transformers.js` running `Xenova/all-MiniLM-L6-v2` (Quantized).
    *   Cost: ~30MB RAM.
    *   Benefit: Free, private, offline.
*   **Optional (Cloud)**: OpenAI `text-embedding-3-small`.
    *   Benefit: Higher quality, lower local RAM usage.

## 4. Syscall Interface

The Vector Subsystem exposes three capabilities via the `Vector.*` namespace.

### 4.1. Vector.Embed (Utility)
Generate embeddings for a text string without storing it.

*   **Type**: `Vector.Embed`
*   **Kind**: `query`
*   **Input**: `{ text: string, model?: string }`
*   **Output**: `{ vector: number[] }`

### 4.2. Vector.Store (Upsert)
Store a document and its embedding.

*   **Type**: `Vector.Store`
*   **Kind**: `command`
*   **Input**:
    ```typescript
    {
      collection: string; // e.g. "memories", "docs"
      id: string;         // Unique ID
      text: string;       // The content to embed
      metadata?: Record<string, any>;
    }
    ```
*   **Output**: `{ id: string, success: true }`

### 4.3. Vector.Search (Query)
Perform a semantic search.

*   **Type**: `Vector.Search`
*   **Kind**: `query`
*   **Input**:
    ```typescript
    {
      collection: string;
      text: string;       // The query text
      limit?: number;     // Default 10
      threshold?: number; // Similarity threshold (0-1)
    }
    ```
*   **Output**:
    ```typescript
    {
      results: Array<{
        id: string;
        text: string;
        metadata: Record<string, any>;
        score: number;
      }>
    }
    ```

## 5. Implementation Details

### 5.1. Orama Configuration
*   **Schema**: Dynamic schema is not supported efficiently in Orama yet. We will use a fixed schema:
    ```typescript
    {
      id: "string",
      text: "string",
      metadata: "json", // Stringified JSON for flexibility
      embedding: "vector[384]" // Fixed dimension for MiniLM
    }
    ```

### 5.2. Hydration Logic
On startup (lazy-loaded on first `Vector.*` call):
1.  Check if Orama index exists in RAM.
2.  If not, scan `["vector", "store", collection]` in Deno KV.
3.  Bulk insert into Orama.
4.  Mark as ready.

## 6. Security Considerations
*   **Isolation**: Collections are namespaced.
*   **Origin**: Like Memory, Vector stores should be isolated by the Kernel Origin (RFC 0015).


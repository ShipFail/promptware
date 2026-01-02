---
rfc: 0030
title: Kernel Vector Subsystem
author: Ship.Fail Crew
status: Draft
type: Standards Track
created: 2026-01-02
updated: 2026-01-02
version: 1.0
tags: [vector, embedding, search, memory, ai]
---

# RFC 0030: Kernel Vector Subsystem

## 1. Abstract

This RFC defines the **Vector Subsystem** for PromptWar̊e ØS. It provides semantic search and embedding capabilities to Agents, enabling "Long-Term Associative Memory".

The subsystem exposes a set of syscalls (`Vector.*`) for embedding text, storing vectors, and performing similarity searches. It MAY be backed by a local vector database (e.g., LanceDB, Chroma) or a remote API.

## 2. Status of This Memo

This document is a PromptWar̊e ØS RFC-style specification and may change at any time.

The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**, **SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **MAY**, and **OPTIONAL** are to be interpreted as described in BCP 14 (RFC 2119, RFC 8174).

## 3. Terminology

*   **Embedding**: A dense vector representation of text (e.g., `[0.1, -0.5, ...]`).
*   **Collection**: A named group of vectors (analogous to a SQL table).
*   **Document**: The unit of storage, consisting of ID, Text, Vector, and Metadata.

## 4. Architecture

The Vector Subsystem operates as a specialized storage engine. While it MAY be mounted into the VFS (e.g., at `/vector`), its primary interface is via specific syscalls that abstract the complexity of embedding generation and nearest-neighbor search.

### 4.1. The Embedding Model
The subsystem MUST be configured with a default Embedding Model (e.g., `text-embedding-3-small` or a local ONNX model). This ensures that all vectors in a collection are compatible.

## 5. Message Interface

The Vector Subsystem MUST expose the following messages via the Kernel ABI (RFC 0019).

### 5.1. Vector.Embed

Generates an embedding vector for the given text.

*   **Kind**: `query`
*   **Type**: `Vector.Embed`
*   **Data**:
    ```json
    {
      "text": "string (Text to embed)"
    }
    ```
*   **Success Reply**: `kind: "reply"`, `type: "Vector.Embed"`
    ```json
    {
      "vector": "[number] (Array of floats)"
    }
    ```
*   **Error Reply**: `kind: "error"`, `type: "Vector.Embed"`

### 5.2. Vector.Store

Stores a document in the vector database. The subsystem AUTOMATICALLY generates the embedding for the text.

*   **Kind**: `command`
*   **Type**: `Vector.Store`
*   **Data**:
    ```json
    {
      "collection": "string (Name of the collection)",
      "id": "string (Unique identifier)",
      "text": "string (Content to index)",
      "metadata": "object (Optional JSON metadata)"
    }
    ```
*   **Success Reply**: `kind: "reply"`, `type: "Vector.Store"`
    ```json
    {
      "success": true
    }
    ```
*   **Error Reply**: `kind: "error"`, `type: "Vector.Store"`

### 5.3. Vector.Search

Performs a semantic similarity search.

*   **Kind**: `query`
*   **Type**: `Vector.Search`
*   **Data**:
    ```json
    {
      "collection": "string (Target collection)",
      "query": "string (Search text)",
      "limit": "number (Max results, default 5)"
    }
    ```
*   **Success Reply**: `kind: "reply"`, `type: "Vector.Search"`
    ```json
    {
      "results": [
        {
          "id": "string",
          "text": "string",
          "metadata": "object",
          "score": "number (Similarity score 0-1)"
        }
      ]
    }
    ```
*   **Error Reply**: `kind: "error"`, `type: "Vector.Search"`

### 5.4. Vector.Delete

Removes a document.

*   **Kind**: `command`
*   **Type**: `Vector.Delete`
*   **Data**:
    ```json
    {
      "collection": "string",
      "id": "string"
    }
    ```
*   **Success Reply**: `kind: "reply"`, `type: "Vector.Delete"`
    ```json
    {
      "success": true
    }
    ```
*   **Error Reply**: `kind: "error"`, `type: "Vector.Delete"`

## 6. VFS Integration (Optional)

If mounted as a VFS Driver (e.g., at `/vector`), the subsystem SHOULD map operations as follows:

*   **Read (`/vector/coll/id`)**: Returns the document text.
*   **Write (`/vector/coll/id`)**: Calls `Vector.Store`.
*   **List (`/vector/coll`)**: Lists document IDs.
*   **Delete (`/vector/coll/id`)**: Calls `Vector.Delete`.

*Note: `Vector.Search` and `Vector.Embed` are not easily mappable to standard VFS verbs and remain syscall-only.*

## 7. Security Considerations

*   **Isolation**: Collections MUST be isolated by the Kernel's `origin` parameter (Multi-tenant).
*   **Privacy**: Text sent to `Vector.Embed` MAY leave the local machine if a remote API is used. This MUST be disclosed in the Kernel Parameters.

## 8. References

### PromptWar̊e ØS References
*   [RFC 0019: Kernel ABI & Syscall Interface](0019-kernel-abi-syscall.md)
*   [RFC 0018: Kernel Memory Subsystem](0018-kernel-memory-subsystem.md)

### External References
*   [RFC 2119: Key words for use in RFCs](https://www.rfc-editor.org/rfc/rfc2119)

---
End of RFC 0030

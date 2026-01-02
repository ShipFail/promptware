---
rfc: 0025
title: BlobPointer Serialization
author: Ship.Fail Crew
status: Draft
type: Standards Track
created: 2025-12-31
updated: 2025-12-31
version: 1.0
tags: [kernel, blob, serialization, events, ndjson]
---

# RFC 0025: BlobPointer Serialization

## 1. Summary

This RFC specifies **BlobPointer**, a minimal JSON-serializable object used to point to an external blob resource (e.g., a local file, an HTTPS URL, or a Data URL) from within PromptWar̊e ØS OsMessages.

BlobPointer is designed to minimize token usage in Prompt Kernel context, maximize LLM readability and cognitive simplicity, follow established URI component terminology, provide deterministic normalization rules, and be independently implementable and testable.

BlobPointer is **a pointer**, not a container. BlobPointer **MUST NOT** embed large blob contents (except small `data:` URIs, subject to policy).

---

## 2. Motivation

PromptWar̊e ØS OsMessages require a mechanism to reference external blob resources (files, URLs, data) without embedding large content directly in message data. This need arises from:

1. **Token Efficiency**: LLM context windows are precious. Embedding large blobs wastes tokens.
2. **NDJSON Compatibility**: Message streams use NDJSON. Inline binary data breaks readability.
3. **Ephemeral Plumbing**: Kernels need to pass intermediate artifacts (e.g., ingested markdown, tool outputs) between components.
4. **Deterministic Serialization**: For testing, logging, and replay, pointer representation must be canonical.

Without a standardized pointer format, implementations would fragment across incompatible ad-hoc schemes.

---

## 3. Goals & Non-Goals

### Goals

* Define a minimal, token-efficient pointer format for blob resources
* Support `file://`, `https://`, and `data:` URI schemes
* Provide deterministic normalization and serialization rules
* Enable independent implementation and black-box testing
* Maximize LLM readability through explicit URI component naming

### Non-Goals

BlobPointer is **NOT**:

* A content-addressed storage system
* A permissions model
* A replay/logging mechanism
* A MIME typing system
* A transport-specific attachment protocol

BlobPointer **MUST NOT** attempt to guarantee dereference success across runtimes. Dereferencing failures are handled by the agent/runtime as general "resource unavailable" errors.

---

## 4. Terminology

The key words **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**, and **MAY** in this document are to be interpreted as described in BCP 14 [RFC 2119].

**URI component names** are used for clarity and interoperability:

* `scheme` - URI scheme identifier (e.g., "file", "https", "data")
* `authority` - Optional authority component (e.g., "example.com:8080")
* `path` - Required path component
* `query` - Optional query string
* `fragment` - Optional fragment identifier

The `fragment` member is an **opaque string**. It is carried for higher-layer semantics such as "page," "line range," "chunk," or "hash anchor," but this RFC does not assign meaning to any fragment syntax.

---

## 5. Detailed Design

### 5.1 BlobPointer Data Model

A BlobPointer is a JSON object with the following members:

* `scheme` (string, required)
* `path` (string, required)
* `authority` (string, optional)
* `query` (string, optional)
* `fragment` (string, optional)

A BlobPointer **MUST** contain `scheme` and `path`.

A BlobPointer **MAY** contain `authority`, `query`, and `fragment`.

If the computed or normalized `authority` is empty, the `authority` member **MUST** be omitted.

If the computed or normalized `query` is empty, the `query` member **MUST** be omitted.

If the computed or normalized `fragment` is empty, the `fragment` member **MUST** be omitted.

No additional members are defined by this RFC. Producers **MUST NOT** add additional members.

### 5.2 Minimal Forms

The minimal valid forms are:

```json
{ "scheme": "file", "path": "/abs/path/to/blob.md" }
```

```json
{ "scheme": "https", "authority": "example.com", "path": "/bucket/blob.md" }
```

### 5.3 Supported Schemes

Implementations **MUST** support the following `scheme` values:

* `file`
* `https`
* `data`

Implementations **MAY** support additional schemes only via a new RFC.

### 5.4 Scheme-Specific Semantics

#### 5.4.1 `file` Scheme

For `scheme = "file"`:

* `path` **MUST** be an absolute POSIX path.
  * It **MUST** begin with `/`.
  * It **MUST NOT** be empty.
* `authority` **MUST** be omitted.
* `query` **MUST** be omitted.
* `fragment` **MAY** be present.

Examples:

```json
{ "scheme": "file", "path": "/tmp/pwo/ingest/out.md" }
```

```json
{ "scheme": "file", "path": "/tmp/pwo/ingest/out.md", "fragment": "L10-L42" }
```

#### 5.4.2 `https` Scheme

For `scheme = "https"`:

* `authority` **MUST** be present and **MUST NOT** be empty.
* `authority` **MUST** be a valid authority string.
* If the authority includes an explicit default port for HTTPS (e.g., `:443`), the default port **MUST NOT** be included in normalized `authority`.
* `path` **MUST** begin with `/`.
* `query` **MAY** be present.
* `fragment` **MAY** be present.

Examples:

```json
{ "scheme": "https", "authority": "storage.example.com", "path": "/blobs/out.md" }
```

```json
{ "scheme": "https", "authority": "storage.example.com", "path": "/blobs/out.md", "query": "sig=abc&exp=1730000000" }
```

```json
{ "scheme": "https", "authority": "storage.example.com", "path": "/blobs/out.md", "query": "sig=abc&exp=1730000000", "fragment": "page=3" }
```

#### 5.4.3 `data` Scheme

For `scheme = "data"`:

* `authority` **MUST** be omitted.
* `query` **MUST** be omitted.
* `path` **MUST** contain the full `data:` payload segment following the scheme separator in a deterministic, parseable form.
* `fragment` **MAY** be present.

The `path` field for `scheme="data"` **MUST**:

* begin with a media-type or a delimiter indicating default media-type usage
* include all parameters required to interpret the data (e.g., `;base64` when applicable)

Examples:

```json
{ "scheme": "data", "path": "text/plain,Hello%20world" }
```

```json
{ "scheme": "data", "path": "text/markdown;base64,SGVsbG8gIyBUaXRsZQo=", "fragment": "chunk=1" }
```

##### 5.4.3.1 Size Policy for `data` Scheme

Because Data URLs are token-expensive, producers **SHOULD** limit `scheme="data"` BlobPointers to payloads that are at most **4096 bytes** when decoded.

Producers **SHOULD** use `file` or `https` schemes for larger content.

This is a policy recommendation and does not change validity.

### 5.5 Normalization

BlobPointer values are stored **already-normalized**.

#### 5.5.1 General Normalization

Producers **MUST** normalize BlobPointer objects such that:

* `scheme` **MUST** be lowercase.
* `authority` **MUST** be omitted if empty.
* `query` **MUST** be omitted if empty.
* `fragment` **MUST** be omitted if empty.

#### 5.5.2 `https` Authority Normalization

For `scheme="https"`, producers **MUST** normalize `authority` as follows:

* If the authority includes an explicit default port for HTTPS (e.g., `:443`), the default port **MUST** be removed.
* If userinfo is present, it **MAY** be retained as part of `authority`.

Note: userinfo is supported for completeness but is not recommended for typical PromptWar̊e ØS usage.

#### 5.5.3 Path Normalization

Producers **MUST** ensure `path` is expressed in a canonical form for the given scheme:

* For `file`: absolute POSIX path (see §5.4.1).
* For `https`: absolute path beginning with `/`.
* For `data`: payload segment as specified in §5.4.3.

No additional normalization (such as resolving `.` and `..`) is required by this RFC.

### 5.6 Deterministic Serialization

#### 5.6.1 Canonical Member Order

When producing JSON text, producers **MUST** emit BlobPointer members in the following canonical order when present:

1. `scheme`
2. `authority`
3. `path`
4. `query`
5. `fragment`

Members that are omitted are simply not emitted.

#### 5.6.2 Deterministic Semantics

Given a logical resource reference, producers **MUST** generate exactly one normalized BlobPointer representation according to this RFC.

Given a BlobPointer JSON object, consumers **MUST** interpret it deterministically according to this RFC.

### 5.7 Validation Requirements

A consumer implementation **MUST** validate a BlobPointer before use.

Validation **MUST** include:

* `scheme` present and one of the supported values.
* `path` present and non-empty.
* scheme-specific constraints from §5.4.
* absence of additional members beyond those defined in §5.1.

On validation failure, the consumer **MUST** treat the BlobPointer as invalid input.

### 5.8 Error Model

If a BlobPointer validates successfully but cannot be dereferenced in the current runtime environment, the system **MUST** treat the failure as a general resource-unavailable error (e.g., "file not found", "access denied", "network unreachable").

No retry policy is mandated by this RFC. Agent/runtime logic **MAY** retry or attempt repair.

---

## 6. Usage Guidelines (Best Practices)

To maximize AI comprehension and token efficiency, implementations SHOULD follow these usage patterns:

### 6.1. The Hybrid Pattern (Polymorphism)

Fields that may contain blob data SHOULD be defined as `string | BlobPointer`.

*   **Small Text (< 4KB)**: Use **Inline JSON String**.
    *   *Why*: Zero token overhead, instant AI readability, native JSON support.
    *   *Example*: `"body": "Hello world"`
*   **Large Text (> 4KB)**: Use **BlobPointer** (`file` or `https`).
    *   *Why*: Keeps the context window clear for reasoning.
    *   *Example*: `"body": { "scheme": "file", "path": "/tmp/large-doc.md" }`
*   **Binary Data**: Use **BlobPointer** (`file` or `https`).
    *   *Why*: Binary cannot be embedded in JSON without base64 bloat.

### 6.2. When to use `data` Scheme

The `data` scheme SHOULD only be used when:
1.  The content is **binary** (e.g., a small icon or image).
2.  The content is **small** (< 4KB).
3.  The content **must be self-contained** (no external file dependency).

**Avoid** using `data` scheme for plain text. Use an inline string instead.

## 7. Compatibility

* **PromptWar̊e ØS Integration**: BlobPointer is designed for embedding in OsMessages (see RFC 0024).
* **NDJSON Compatibility**: BlobPointer is JSON-serializable and NDJSON-friendly.
* **Ephemeral References**: BlobPointer references **ephemeral** blob resources used as intermediate plumbing between kernels.
* **Durable Logs**: Durable message logs **SHOULD NOT** include BlobPointer references as the sole source of truth for important state.
* **General Reusability**: While a PromptWar̊e ØS primitive, the data model is designed to remain generally reusable.

---

## 7. Rationale

### 7.1 Why Decomposed URI Components?

Using explicit `scheme`, `authority`, `path`, `query`, and `fragment` members instead of a single URI string provides:

* **Token Efficiency**: Only relevant components are serialized
* **LLM Readability**: Field names are self-documenting
* **Normalization Control**: Each component can be normalized independently
* **Parsing Simplicity**: No URI parsing required for common cases

### 7.2 Why These Three Schemes?

* `file`: Local filesystem access is fundamental for agent I/O
* `https`: Cloud blob storage is ubiquitous in modern systems
* `data`: Inline small payloads avoid extra I/O for trivial cases

### 7.3 Why Opaque Fragments?

Fragment semantics vary widely across use cases (line ranges, page numbers, byte offsets, hash anchors). Making fragments opaque allows higher layers to define semantics without constraining this RFC.

---

## 8. Alternatives Considered

### 8.1 Single URI String

**Alternative**: Use a single `uri` field containing a full URI string.

**Rejected**: Less token-efficient, requires URI parsing, harder to normalize deterministically, less LLM-readable.

### 8.2 Inline Base64 Embedding

**Alternative**: Always embed blob content as base64 in event payloads.

**Rejected**: Token-expensive, breaks NDJSON readability, defeats purpose of pointer abstraction.

### 8.3 Content Addressing

**Alternative**: Use content hashes (e.g., SHA-256) to identify blobs.

**Rejected**: Requires content-addressed storage infrastructure, overkill for ephemeral plumbing, doesn't solve location problem.

---

## 9. Security Considerations

### 9.1 Trust Model

BlobPointer operates within PromptWar̊e ØS's trust-maximal co-founder model. No permission checks are enforced by this specification.

### 9.2 Dereference Safety

Implementations **MUST** validate BlobPointer structure before dereferencing. Dereferencing arbitrary URIs may expose the system to:

* Path traversal attacks (if `file://` paths are not validated)
* Server-Side Request Forgery (SSRF) attacks (if `https://` URLs are not filtered)
* Resource exhaustion (if `data:` payloads are unbounded)

Runtime environments **SHOULD** apply appropriate security policies during dereference operations.

### 9.3 Data URL Size Limits

The 4096-byte recommendation for `data:` scheme payloads is a token-efficiency guideline, not a security boundary. Implementations **MAY** enforce stricter limits.

---

## 10. Implementation Plan

1. **Reference Implementation**: Add BlobPointer validation and normalization to Software Kernel
2. **OsMessage Integration**: Update message serialization to support BlobPointer fields
3. **Test Suite**: Implement black-box tests per §11
4. **Documentation**: Update kernel documentation with BlobPointer examples

---

## 11. Testable Requirements

An implementation test suite **MUST** be able to verify the following via black-box tests:

* Valid forms accept: minimal `{scheme,path}` and `https` with authority
* Invalid forms reject: missing `scheme`, missing `path`, extra keys
* `file` rejects non-absolute paths
* `https` rejects missing/empty `authority`
* Default port `:443` is removed during normalization for `https`
* Empty `authority`, empty `query`, and empty `fragment` are omitted in produced JSON
* `data` rejects presence of `authority` and `query`
* Canonical member order is produced when serializing JSON text

---

## 12. Examples

### 12.1 Local Temporary Markdown Output

```json
{ "scheme": "file", "path": "/tmp/pwo/ingest/2025-12-30/out.md" }
```

### 12.2 Cloud Blob via HTTPS with Query Parameters

```json
{ "scheme": "https", "authority": "blob.example.com", "path": "/tmp/out.md", "query": "sig=abc&exp=1730000000" }
```

### 12.3 Citing a Slice (Non-Normative Fragment Examples)

The following `fragment` values are examples only. Consumers **MUST NOT** assign semantics to fragment syntax based on this RFC.

```json
{ "scheme": "file", "path": "/tmp/out.md", "fragment": "L10-L42" }
```

```json
{ "scheme": "https", "authority": "blob.example.com", "path": "/tmp/out.pdf", "fragment": "page=3" }
```

```json
{ "scheme": "https", "authority": "blob.example.com", "path": "/tmp/out.txt", "fragment": "offset=1024,length=512" }
```

### 12.4 Inline Data URL

```json
{ "scheme": "data", "path": "text/plain,Hello%20world" }
```

```json
{ "scheme": "data", "path": "text/markdown;base64,SGVsbG8gIyBUaXRsZQo=" }
```

---

## 13. Future Directions

### 13.1 Additional Schemes

Future RFCs **MAY** define support for additional URI schemes (e.g., `s3://`, `ipfs://`, `blob://`).

### 13.2 Percent-Encoding Normalization

A future RFC **MAY** specify normalization rules for percent-encoding in `data:` payloads.

### 13.3 Windows File URL Forms

A future RFC **MAY** standardize Windows file URL forms (e.g., `file:///C:/path/to/file`).

### 13.4 Maximum Data Size Enforcement

A future RFC **MAY** promote the 4096-byte `data:` size limit from SHOULD to MUST.

---

## 14. Unresolved Questions

* Should percent-encoding normalization be required for `data` payloads in a future RFC?
* Should Windows file URL forms be standardized in a future RFC?
* Should maximum decoded `data` size be promoted from SHOULD to MUST in a future RFC?

---

## 15. References

### PromptWar̊e ØS References

* [RFC 0024: CQRS Message Schema](0024-cqrs-message-schema.md)

### External References

* [RFC 2119: Key words for use in RFCs](https://www.rfc-editor.org/rfc/rfc2119)
* [RFC 3986: Uniform Resource Identifier (URI): Generic Syntax](https://www.rfc-editor.org/rfc/rfc3986)
* [RFC 2397: The "data" URL scheme](https://www.rfc-editor.org/rfc/rfc2397)

---

## Appendix A: Glossary

* **BlobPointer**: A JSON object that points to an external blob resource
* **Ephemeral Resource**: A temporary file or URL used for intermediate processing
* **Normalization**: The process of converting a URI representation to canonical form
* **NDJSON**: Newline-Delimited JSON, a streaming JSON format
* **OsMessage**: A PromptWar̊e ØS message (see RFC 0024)

---

## Appendix: Errata & Notes

None.

---

End of RFC 0025

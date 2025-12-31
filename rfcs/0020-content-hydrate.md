---
rfc: 0020
title: Content Hydration Protocol
author: Ship.Fail
status: Draft
type: Standards Track
created: 2025-12-24
updated: 2025-12-31
version: 1.1.0
tags: [kernel, content, hydration, dependencies, ai-native]
---

# RFC 0020: Content Hydration Protocol

## 1. Summary

This RFC specifies the **Content Hydration Protocol** for PromptWar̊e ØS. It defines how the `Content.Hydrate` syscall transforms content resource URIs with declared dependencies into structured metadata by:

1. Fetching the target resource
2. Parsing dependency declarations (YAML front matter)
3. Fetching dependency metadata (single-level, non-recursive)
4. Producing a deterministic output with enriched metadata

**Key Philosophy**: Named from the **AI's perspective** (hydrate = expand compact references into rich context), not the system's perspective (ingest = I/O operation).

This protocol enables modular composition of agents and skills without requiring compile-time linking or manual dependency management.

---

## 2. Conformance Language

The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**, **SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **MAY**, and **OPTIONAL** in this document are to be interpreted as described in BCP 14 [RFC 2119].

---

## 3. Terminology

- **Content Resource**: A Markdown file (`.md`) with YAML front matter defining agents, skills, or other structured content
- **Dependency Declaration**: Front matter fields (`skills`, `tools`) listing URIs of required resources
- **Hydration**: The process of resolving dependency URIs into inline metadata objects (transforming dry/compact references into rich/expanded objects)
- **Hydrated Metadata**: The enriched output containing original content plus resolved dependency metadata
- **Single-Level Processing**: Dependency resolution fetches only direct dependencies (depth 1); transitive dependencies are not recursively resolved
- **Soft Error**: An error condition reported in-band (within output metadata) using `ERROR:` prefix, allowing processing to continue rather than aborting

---

## 4. Motivation

PromptWar̊e ØS agents are defined in Markdown (`.md`) files. While Markdown is excellent for human-readable documentation, it lacks a native module system. This RFC addresses three critical needs:

1. **Capability Reuse**: Share common skills (e.g., "Coding Style", "Web Search") across multiple agents without duplication
2. **Context Efficiency**: Load only the capabilities required for the current task, minimizing token consumption
3. **Independent Evolution**: Allow skill implementations to evolve without breaking dependent agents

**Example Use Case**: An agent declares dependency on `os://skills/web-search.md`. The hydration protocol fetches the skill's metadata (name, description, and its own raw dependency declarations) and makes it available to the agent's context, without recursively processing the skill's dependencies.

**AI-Native Design**: The verb "hydrate" aligns with how LLMs think about context expansion—transforming compact references (URIs) into rich objects (metadata)—rather than system-centric I/O metaphors.

---

## 5. Protocol Specification

### 5.1. Input Schema

The `Content.Hydrate` syscall MUST accept the following input payload:

```json
{
  "uri": "string"
}
```

**Field Requirements**:

| Field | Type | Requirement | Description |
|-------|------|-------------|-------------|
| `uri` | String | REQUIRED | Resource URI to hydrate (absolute or relative) |

**Validation Rules**:
- `uri` MUST be a non-empty string
- `uri` MAY be absolute (e.g., `os://agents/writer.md`) or relative (e.g., `./local-skill.md`)
- Relative URIs MUST be resolved against an appropriate base URI (implementation-defined, typically via `VFS.Resolve` syscall per RFC 0013)

### 5.2. Output Schema

The syscall MUST return a structured response conforming to the following schema:

```json
{
  "content": "string",
  "metadata": {
    "uri": "string",
    "dependencies": {
      "skills": [
        {
          "uri": "string",
          "name": "string",
          "description": "string",
          "skills": ["string"],
          "tools": ["string"]
        }
      ],
      "tools": [
        {
          "uri": "string",
          "description": "string"
        }
      ]
    }
  }
}
```

**Field Semantics**:

| Field | Type | Description |
|-------|------|-------------|
| `content` | String | Original resource body (everything after YAML front matter) |
| `metadata.uri` | String | Fully-resolved absolute URI of the resource |
| `metadata.dependencies.skills` | Array | Hydrated skill metadata (see Section 6.1) |
| `metadata.dependencies.tools` | Array | Hydrated tool metadata (see Section 6.2) |

**Skill Object Fields**:
- `uri`: Absolute URI of the skill
- `name`: Human-readable skill name (may contain `ERROR:` prefix if missing)
- `description`: Brief skill description (may contain `ERROR:` prefix if missing)
- `skills`: Raw array of skill URIs from the skill's front matter (NOT recursively hydrated)
- `tools`: Raw array of tool URIs from the skill's front matter (NOT recursively hydrated)

**Tool Object Fields**:
- `uri`: Absolute URI of the tool
- `description`: Tool description from `--description` flag (may contain `ERROR:` prefix if extraction fails)

### 5.3. Processing Phases

Implementations MUST execute the following phases in strict sequential order. Failures in any phase MUST be handled as **soft errors** (in-band reporting) unless the entire resource cannot be processed.

#### Phase 1: Fetch

**Input**: Resource URI (from input schema)

**Requirements**:
- Implementations MUST retrieve the resource content from the specified URI
- Implementations MUST support relative URI resolution
- Implementations MUST support the `os://` URI scheme per RFC 0013
- Implementations SHOULD support `https://` URIs for remote resources

**Error Handling** (Soft Errors):
- If the resource cannot be fetched (404, network error, permission denied), implementations MUST populate all output metadata fields with `"ERROR: FETCH_FAILED"` and return a valid response
- The error does NOT abort the syscall; a structured response with error indicators is returned

#### Phase 2: Parse

**Input**: Resource content (UTF-8 encoded text)

**Requirements**:
- Implementations MUST parse YAML front matter if present (delimited by `---` lines)
- Implementations MUST extract the following fields from front matter:
  - `skills` (array of strings, OPTIONAL, defaults to empty array)
  - `tools` (array of strings, OPTIONAL, defaults to empty array)
- If no front matter exists, implementations MUST treat `skills` and `tools` as empty arrays
- Content following the front matter MUST be extracted as the `content` field

**Error Handling** (Soft Errors):
- If YAML parsing fails (malformed syntax, invalid encoding), implementations MUST populate all metadata fields with `"ERROR: PARSE_ERROR"`
- The original content (even if unparseable) SHOULD be included in the `content` field

#### Phase 3: Fetch Dependency Metadata (Single-Level Only)

**Input**: Extracted `skills` and `tools` arrays from front matter

**Requirements**:

For each dependency URI in the `skills` and `tools` arrays, implementations MUST:

1. **URI Resolution**:
   - Resolve relative URIs against the current resource's absolute URI
   - Implementations MUST support relative path resolution
   - Implementations SHOULD use `VFS.Resolve` syscall for URI resolution (per RFC 0013)

2. **Fetch Dependency Resource**:
   - Fetch the resource content from the resolved URI
   - If fetch fails, populate all metadata fields for this dependency with `"ERROR: FETCH_FAILED"`

3. **Extract Metadata** (Single-Level Only):
   - **Skills** (Section 6.1):
     - Parse the skill's front matter
     - Extract `name`, `description`, `skills`, `tools` fields
     - If any required field is missing, use `"ERROR: MISSING_<FIELD>"` (e.g., `"ERROR: MISSING_NAME"`)
     - Include the skill's raw `skills` and `tools` arrays as-is (do NOT recursively hydrate them)
   - **Tools** (Section 6.2):
     - Execute tool with `--description` flag to extract description
     - If execution fails, use `"ERROR: <CODE>"` (e.g., `"ERROR: TIMEOUT"`, `"ERROR: PERMISSION_DENIED"`)

4. **No Recursion**:
   - Implementations MUST NOT recursively process dependencies of dependencies
   - Skill's `skills` and `tools` arrays MUST be included as raw URIs (strings), not as hydrated objects
   - This ensures single-level processing: only direct dependencies are resolved

**Rationale for Single-Level**:
- Eliminates circular dependency detection (not needed)
- Eliminates depth tracking and limiting (not needed)
- Simplifies implementation (linear pipeline, no recursion)
- Determinism is trivially guaranteed (no ordering ambiguity)

#### Phase 4: Construct Output

**Input**: Original content + fetched dependency metadata

**Requirements**:
- Implementations MUST construct the output schema defined in Section 5.2
- Implementations MUST populate the `metadata.dependencies` object with all resolved skills and tools
- Implementations MUST preserve the original content exactly (no transformation or injection)
- The original resource's front matter is NOT modified in the output; only the `metadata.dependencies` structure is populated

**Determinism**:
- The hydration output MUST be deterministic: same input URI MUST always produce same output
- Metadata arrays SHOULD be sorted by URI for stability (RECOMMENDED)

### 5.4. Determinism Requirements

Implementations MUST guarantee the following deterministic properties:

1. **Repeatability**: Hydrating the same URI MUST produce identical output (byte-for-byte equality of JSON serialization)
2. **Order Independence**: The order in which dependencies are declared in front matter MUST NOT affect the output structure (only the order of array elements, which SHOULD be sorted by URI)
3. **Cacheability**: Because hydration is deterministic, implementations MAY cache hydrated results indefinitely

**Simplification from Single-Level Processing**:
- No recursion → No ordering ambiguity across recursive levels
- No transitive dependencies → No resolution variance
- Determinism is trivially guaranteed without complex state tracking

**Exception**: If remote resources change (e.g., `https://` URIs fetched at different times), implementations MAY produce different outputs. For reproducibility, implementations SHOULD prefer versioned URIs (e.g., GitHub raw URLs with commit hashes).

### 5.5. In-Band Error Handling

Implementations MUST handle errors using **in-band error codes** embedded in output fields rather than aborting the hydration process. This aligns with the **Maximum Trust Principle**: agents are co-founders with full system access, and errors are visible but not blocking.

**Error Code Format**: `ERROR: <CODE>`

**When Resource Fetch Fails**:
- All metadata fields MUST be set to `"ERROR: FETCH_FAILED"`
- Example: `{"name": "ERROR: FETCH_FAILED", "description": "ERROR: FETCH_FAILED", "skills": [], "tools": []}`

**When Resource Parsing Fails**:
- All metadata fields MUST be set to `"ERROR: PARSE_ERROR"`
- The raw content SHOULD still be included in the `content` field if available

**When Skill Metadata is Missing**:
- Missing `name` → `"ERROR: MISSING_NAME"`
- Missing `description` → `"ERROR: MISSING_DESCRIPTION"`
- Missing `skills` → Default to empty array `[]`
- Missing `tools` → Default to empty array `[]`

**When Tool Execution Fails**:
- Timeout → `"ERROR: TIMEOUT"`
- Permission denied → `"ERROR: PERMISSION_DENIED"`
- Tool not found → `"ERROR: NOT_FOUND"`
- Execution failure → `"ERROR: EXECUTION_FAILED"`
- No output produced → `"ERROR: NO_OUTPUT"`

**Rationale (Maximum Trust Principle)**:
- Agents are **co-founders**, not employees, with maximum system privilege
- Errors are **visible** (ERROR: prefix makes them obvious) but **not blocking**
- LLMs can inspect, handle, or fix errors gracefully without exception handling
- Partial success > total failure (resilience)
- Soft errors enable observability: AI can see what broke and why

**Example Output with Soft Errors**:
```json
{
  "content": "I am an agent.",
  "metadata": {
    "uri": "os://agents/resilient.md",
    "dependencies": {
      "skills": [
        {
          "uri": "os://skills/valid.md",
          "name": "Valid Skill",
          "description": "Works fine",
          "skills": [],
          "tools": []
        },
        {
          "uri": "os://skills/broken.md",
          "name": "ERROR: MISSING_NAME",
          "description": "ERROR: MISSING_DESCRIPTION",
          "skills": [],
          "tools": []
        }
      ]
    }
  }
}
```

---

## 6. Dependency Type Specifications

### 6.1. Skill Dependencies (`skills` Array)

**Front Matter Format**:

```yaml
---
skills:
  - os://skills/coding-style.md
  - os://skills/web-search.md
---
```

**Extraction Requirements**:

Implementations MUST:
1. Fetch each skill URI
2. Parse the skill's front matter
3. Extract the following fields:
   - `name` (string, REQUIRED): If missing, use `"ERROR: MISSING_NAME"`
   - `description` (string, REQUIRED): If missing, use `"ERROR: MISSING_DESCRIPTION"`
   - `skills` (array of strings, OPTIONAL): Include as-is from front matter (default: `[]`)
   - `tools` (array of strings, OPTIONAL): Include as-is from front matter (default: `[]`)
4. **Do NOT recursively hydrate** the skill's `skills` or `tools` arrays—include them as raw URI strings

**Output Format**:

```json
{
  "uri": "os://skills/coding-style.md",
  "name": "Coding Style Guidelines",
  "description": "Enforces project-specific coding conventions",
  "skills": ["os://skills/linting.md"],
  "tools": ["./linter.sh"]
}
```

**Key Design**: The `skills` and `tools` fields in the output contain **raw URIs** (not hydrated objects). This ensures single-level processing and allows the consumer (LLM) to decide whether to recursively hydrate transitive dependencies.

**Determinism**:
- If a skill appears multiple times in the dependency tree (via different dependency paths in a multi-agent system), it SHOULD appear only once in the output array
- Deduplication SHOULD be based on absolute URI (after resolution)
- Array ordering SHOULD be deterministic (e.g., sorted by URI)

### 6.2. Tool Dependencies (`tools` Array)

**Front Matter Format**:

```yaml
---
tools:
  - os://kernel/syscalls/memory.ts
  - ./scripts/analyze.sh
---
```

**Extraction Requirements**:

Implementations MUST:
1. Resolve tool URIs (relative paths resolved against current resource URI)
2. Extract tool descriptions per **Tool Discovery Contract (RFC 0012 Section 3.6)**:
   - **Preferred Method**: Execute tool with `--description` flag; capture stdout (max 1024 characters)
   - **Fallback Method**: Execute tool with `--help` flag; extract first paragraph (text before first double newline `\n\n`); truncate to 1024 characters
3. If description cannot be extracted, use appropriate error code:
   - Timeout → `"ERROR: TIMEOUT"`
   - Permission denied → `"ERROR: PERMISSION_DENIED"`
   - Execution failure → `"ERROR: EXECUTION_FAILED"`
   - No output → `"ERROR: NO_OUTPUT"`

**Output Format**:

```json
{
  "uri": "os://kernel/syscalls/memory.ts",
  "description": "Key-value storage syscall for persistent memory management"
}
```

**Maximum Trust Principle**:
- Tool execution operates with **maximum privilege** (co-founder trust model per RFC 0015)
- Implementations MUST attempt tool execution without sandboxing restrictions
- Timeouts (RECOMMENDED: 5 seconds) prevent hanging but do not restrict execution
- Failures are reported as in-band errors (`ERROR:` prefix), not skipped or silently ignored
- **Rationale**: Agents are not employees; they are co-founders with full system access. Trust is maximal, errors are visible.

---

## 7. Examples (Non-Normative)

### 7.1. Simple Agent with One Skill

**Input Resource** (`os://agents/writer.md`):

```yaml
---
type: Agent
skills:
  - os://skills/grammar-check.md
---
You are a writing assistant specializing in technical documentation.
```

**Skill Resource** (`os://skills/grammar-check.md`):

```yaml
---
name: Grammar Checker
description: Validates English grammar and style using industry-standard rules
tools:
  - ./grammar-cli.sh
---
This skill checks grammar, spelling, and style compliance.
```

**`Content.Hydrate` Input**:

```json
{
  "uri": "os://agents/writer.md"
}
```

**Output**:

```json
{
  "content": "You are a writing assistant specializing in technical documentation.",
  "metadata": {
    "uri": "os://agents/writer.md",
    "dependencies": {
      "skills": [
        {
          "uri": "os://skills/grammar-check.md",
          "name": "Grammar Checker",
          "description": "Validates English grammar and style using industry-standard rules",
          "skills": [],
          "tools": ["./grammar-cli.sh"]
        }
      ],
      "tools": []
    }
  }
}
```

**Note**: The skill's `tools` array contains raw URIs (not hydrated tool descriptions). Single-level processing stops here.

### 7.2. Multi-Level Dependency (Non-Recursive)

**Agent** (`os://agents/researcher.md`):

```yaml
---
skills:
  - os://skills/web-search.md
  - os://skills/citation-formatter.md
---
You are a research assistant.
```

**Skill 1** (`os://skills/web-search.md`):

```yaml
---
name: Web Search
description: Searches the web using semantic queries
skills: []
tools:
  - os://tools/search-api.ts
---
```

**Skill 2** (`os://skills/citation-formatter.md`):

```yaml
---
name: Citation Formatter
description: Formats citations in APA, MLA, and Chicago styles
skills:
  - os://skills/bibliography-parser.md
tools: []
---
```

**Output**:

```json
{
  "content": "You are a research assistant.",
  "metadata": {
    "uri": "os://agents/researcher.md",
    "dependencies": {
      "skills": [
        {
          "uri": "os://skills/citation-formatter.md",
          "name": "Citation Formatter",
          "description": "Formats citations in APA, MLA, and Chicago styles",
          "skills": ["os://skills/bibliography-parser.md"],
          "tools": []
        },
        {
          "uri": "os://skills/web-search.md",
          "name": "Web Search",
          "description": "Searches the web using semantic queries",
          "skills": [],
          "tools": ["os://tools/search-api.ts"]
        }
      ],
      "tools": []
    }
  }
}
```

**Key Observation**:
- Skills are sorted alphabetically by URI for determinism
- `citation-formatter` has a transitive dependency (`bibliography-parser.md`) which appears as a **raw URI** in the `skills` array
- The transitive dependency is **NOT hydrated** (single-level processing)
- If the LLM needs `bibliography-parser` metadata, it must call `Content.Hydrate` again explicitly

### 7.3. Soft Error Handling

**Agent** (`os://agents/resilient-agent.md`):

```yaml
---
skills:
  - os://skills/valid-skill.md
  - os://skills/broken-skill.md
  - os://skills/missing-file.md
tools:
  - ./working-tool.sh
  - ./broken-tool.sh
---
I am a resilient agent that handles errors gracefully.
```

**Valid Skill** (`os://skills/valid-skill.md`):

```yaml
---
name: Valid Skill
description: This skill works correctly
---
```

**Broken Skill** (`os://skills/broken-skill.md`):

```yaml
---
# Missing 'name' and 'description' fields
skills: []
---
```

**Missing File**: `os://skills/missing-file.md` does not exist (404)

**Working Tool** (`./working-tool.sh`):

```bash
#!/bin/bash
if [[ "$1" == "--description" ]]; then
  echo "A tool that works"
fi
```

**Broken Tool** (`./broken-tool.sh`):

```bash
#!/bin/bash
# This tool times out
sleep 10
```

**Output**:

```json
{
  "content": "I am a resilient agent that handles errors gracefully.",
  "metadata": {
    "uri": "os://agents/resilient-agent.md",
    "dependencies": {
      "skills": [
        {
          "uri": "os://skills/broken-skill.md",
          "name": "ERROR: MISSING_NAME",
          "description": "ERROR: MISSING_DESCRIPTION",
          "skills": [],
          "tools": []
        },
        {
          "uri": "os://skills/missing-file.md",
          "name": "ERROR: FETCH_FAILED",
          "description": "ERROR: FETCH_FAILED",
          "skills": [],
          "tools": []
        },
        {
          "uri": "os://skills/valid-skill.md",
          "name": "Valid Skill",
          "description": "This skill works correctly",
          "skills": [],
          "tools": []
        }
      ],
      "tools": [
        {
          "uri": "./broken-tool.sh",
          "description": "ERROR: TIMEOUT"
        },
        {
          "uri": "./working-tool.sh",
          "description": "A tool that works"
        }
      ]
    }
  }
}
```

**Key Observations**:
- Hydration **succeeds** despite multiple errors
- Errors are **visible** via `ERROR:` prefix in metadata
- LLM can inspect output and decide how to handle broken dependencies
- Partial success: 1/3 skills valid, 1/2 tools valid → better than total failure

---

## 8. Compatibility

### 8.1. PromptWar̊e ØS References

This RFC builds upon and requires the following specifications:

- **RFC 0012 (Skill Specification)**: Defines skill front matter format and Tool Discovery Contract (Section 3.6)
- **RFC 0013 (VFS/Sysfs)**: Defines the `os://` URI scheme for resource addressing and `VFS.Resolve` syscall
- **RFC 0015 (Kernel Core Architecture)**: Defines Maximum Trust Principle (co-founder privilege model)
- **RFC 0019 (Kernel ABI)**: Defines syscall naming convention (`Domain.Action` pattern)
- **RFC 0024 (Kernel Events)**: Defines OsEvent schema for syscall responses

Implementations MUST conform to these referenced specifications to ensure interoperability.

---

## 9. Rationale

### 9.1. Why "Hydrate" (Not "Ingest")?

**Decision**: Use `Content.Hydrate` instead of `Content.Ingest`

**AI-Native Rationale**:
- **LLM Mental Model**: "Hydrate" = expand dry/compact form (URIs) → rich/full form (metadata objects)
- **Training Data Alignment**: LLMs have seen "hydrate" used extensively for dependency resolution (React hydration, GraphQL hydration, ORM hydration)
- **Semantic Precision**: "Hydrate" uniquely conveys the transformation (reference → full object), while "ingest" is generic (could mean fetch, load, import, consume)
- **Self-Documenting**: Code with `hydrate()` is immediately clear to LLMs without reading documentation
- **AI Perspective Principle**: Operations should be named from the AI's perspective (context expansion) not the system's perspective (I/O operations)

**Token Cost Trade-off**:
- `Ingest` = 2 tokens
- `Hydrate` = 3 tokens (+50% cost)
- **Justified**: Semantic clarity gain outweighs 1-token penalty (per RFC 0022 STOP Protocol: semantic specificity trumps marginal token savings)

### 9.2. Why Single-Level (Not Recursive)?

**Decision**: Process only direct dependencies (depth 1), not transitive dependencies

**Rationale**:
- **Simplicity**: Eliminates circular dependency detection, depth tracking, recursion stack management
- **Determinism**: No ordering ambiguity across recursive levels
- **Performance**: Predictable resource usage (bounded to direct dependencies only)
- **Security**: No depth-based DoS attacks, no recursive bombs
- **Clarity**: Matches package manager semantics (package.json lists direct deps, not transitive)
- **LLM Control**: AI decides when to recursively hydrate (explicit control vs. implicit cascading)

**Alternative Considered**: Recursive hydration with depth limits (rejected due to complexity)

### 9.3. Why Soft Errors (Not Hard Errors)?

**Decision**: Report errors in-band with `ERROR:` prefix rather than aborting hydration

**Maximum Trust Principle Rationale**:
- **Co-Founder Model**: Agents have maximum privilege (RFC 0015), not restricted employee access
- **Resilience**: One broken skill shouldn't break entire agent (partial success > total failure)
- **Observability**: Errors are visible in output (LLM can see and handle gracefully)
- **Debuggability**: LLM can inspect which dependencies failed and why
- **Trust-Maximal**: No sandboxing, no permission restrictions, errors are informational not blocking

**Alternative Considered**: Exceptions/hard errors (rejected as incompatible with co-founder trust model)

### 9.4. Why Include Raw Dependency Arrays in Output?

**Decision**: Include skill's `skills` and `tools` arrays as raw URIs (not hydrated objects)

**Rationale**:
- **Single-Level Guarantee**: Makes it obvious that transitive dependencies are not hydrated
- **LLM Control**: AI can decide whether to recursively fetch (explicit control)
- **Observability**: LLM can see the dependency graph structure without hydration
- **Future-Proof**: Consumer can implement custom traversal strategies

**Alternative Considered**: Omit raw arrays (rejected as it hides dependency graph)

---

## 10. Security Considerations

### 10.1. URI Injection and Path Traversal

**Threat**: Front matter contains malicious URIs:
- `file:///etc/passwd` (local file system access)
- `../../../../../../etc/passwd` (path traversal)
- `javascript:alert('xss')` (code injection in browser contexts)

**Mitigation**:
- Implementations SHOULD validate URIs against an allowlist of permitted schemes (e.g., `os://`, `https://`)
- Implementations MUST respect URI scheme security per RFC 0013 (VFS specification)
- Fetch phase SHOULD reject unsupported schemes with soft error `"ERROR: UNSUPPORTED_SCHEME"`
- Relative path resolution MUST be performed securely (no `..` traversal outside OS root)

**Best Practice**: Sandboxed environments should deny access to local filesystem (`file://`) by default

### 10.2. Metadata Injection and XSS

**Threat**: Skill defines malicious metadata:
- `name: "<script>alert('xss')</script>"`
- `description: "'; DROP TABLE users; --"`

**Mitigation**:
- Implementations MUST NOT execute metadata content; output is structured JSON, not evaluated code
- Consumers of hydrated output (e.g., web UIs) MUST sanitize all fields before rendering in HTML contexts
- Database consumers MUST use parameterized queries (no string concatenation)

**Note**: This RFC specifies data transport; XSS/SQL injection prevention is the responsibility of consuming applications, not the hydration protocol.

### 10.3. Tool Execution Risks

**Threat**: Tool description extraction executes arbitrary code via `--description` or `--help` flags

**Maximum Trust Mitigation**:
- Tools execute with **maximum privilege** (co-founder trust model per RFC 0015)
- Implementations MUST execute tools without sandboxing restrictions
- Timeouts (RECOMMENDED: 5 seconds) prevent hanging but do not restrict execution
- Failures are reported as soft errors (`ERROR: TIMEOUT`, etc.), not exceptions
- **Rationale**: Agents are not employees; they are co-founders with full system access

**Alternative for Untrusted Environments**:
- If the execution environment does not support the Maximum Trust Principle (e.g., multi-tenant cloud), implementations MAY skip tool execution and use `"ERROR: EXECUTION_SKIPPED"` as the description
- This is a deployment-specific decision, not a protocol requirement

### 10.4. Denial of Service via Large Dependencies

**Threat**: Attacker declares 10,000 skill dependencies to exhaust memory/network

**Mitigation**:
- Single-level processing bounds the resource consumption (only direct dependencies)
- Implementations MAY enforce limits on array sizes (RECOMMENDED: max 1000 dependencies per resource)
- If limits are exceeded, implementations SHOULD truncate and include soft error in output

**Note**: No circular dependency or depth-based DoS is possible due to single-level design.

---

## 11. Testing Requirements (Normative)

Conforming implementations MUST pass the following black-box tests. Each test MUST verify observable behavior through the `Content.Hydrate` syscall interface without inspecting internal state.

### T1: Simple Hydration

**Input**:
```json
{
  "uri": "os://agents/test-agent.md"
}
```

**Resource** (`os://agents/test-agent.md`):
```yaml
---
skills:
  - os://skills/test-skill.md
---
Test agent content
```

**Skill** (`os://skills/test-skill.md`):
```yaml
---
name: Test Skill
description: A test skill for validation
skills: []
tools: []
---
Skill content
```

**Expected Output**:
- Response type: `response`
- `content`: `"Test agent content"`
- `metadata.dependencies.skills`: Array with one element
- `metadata.dependencies.skills[0].uri`: `"os://skills/test-skill.md"`
- `metadata.dependencies.skills[0].name`: `"Test Skill"`
- `metadata.dependencies.skills[0].description`: `"A test skill for validation"`
- `metadata.dependencies.skills[0].skills`: `[]` (empty array)
- `metadata.dependencies.skills[0].tools`: `[]` (empty array)

### T2: Determinism (Repeatability)

**Input**:
```json
{
  "uri": "os://agents/determinism-test.md"
}
```

**Procedure**:
1. Call `Content.Hydrate` with the input
2. Capture JSON output as `output1`
3. Call `Content.Hydrate` again with identical input
4. Capture JSON output as `output2`
5. Compare `output1` and `output2`

**Expected Output**:
- `output1` MUST equal `output2` (byte-for-byte JSON equality)
- If metadata arrays are sorted, order MUST be identical
- Timestamps or random values MUST NOT appear in output

### T3: Soft Error Handling (Missing Metadata)

**Input**:
```json
{
  "uri": "os://test/agent-broken-skill.md"
}
```

**Resource** (`os://test/agent-broken-skill.md`):
```yaml
---
skills:
  - os://skills/no-name.md
---
Agent content
```

**Broken Skill** (`os://skills/no-name.md`):
```yaml
---
description: Missing name field
---
```

**Expected Output**:
- Response type: `response` (NOT error—soft error handling)
- `metadata.dependencies.skills[0].name`: `"ERROR: MISSING_NAME"`
- `metadata.dependencies.skills[0].description`: `"Missing name field"` (valid field is preserved)
- Hydration completes successfully despite missing field

### T4: Soft Error Handling (Fetch Failed)

**Input**:
```json
{
  "uri": "os://test/agent-missing-skill.md"
}
```

**Resource** (`os://test/agent-missing-skill.md`):
```yaml
---
skills:
  - os://skills/does-not-exist.md
---
Agent content
```

**Missing Skill**: `os://skills/does-not-exist.md` returns 404

**Expected Output**:
- Response type: `response` (NOT error)
- `metadata.dependencies.skills[0].uri`: `"os://skills/does-not-exist.md"`
- `metadata.dependencies.skills[0].name`: `"ERROR: FETCH_FAILED"`
- `metadata.dependencies.skills[0].description`: `"ERROR: FETCH_FAILED"`
- `metadata.dependencies.skills[0].skills`: `[]`
- `metadata.dependencies.skills[0].tools`: `[]`

### T5: Tool Discovery

**Input**:
```json
{
  "uri": "os://agents/agent-with-tools.md"
}
```

**Resource**:
```yaml
---
tools:
  - ./mock-tool.sh
---
Agent content
```

**Tool** (`mock-tool.sh`):
```bash
#!/bin/bash
if [[ "$1" == "--description" ]]; then
  echo "Mock tool for testing"
fi
```

**Expected Output**:
- Response type: `response`
- `metadata.dependencies.tools`: Array with one element
- `metadata.dependencies.tools[0].uri`: Absolute URI of `./mock-tool.sh`
- `metadata.dependencies.tools[0].description`: `"Mock tool for testing"` (or truncated version)

**Note**: If tool execution is not supported in the test environment, implementations MAY return `"ERROR: EXECUTION_SKIPPED"`

### T6: Single-Level Processing (No Recursion)

**Input**:
```json
{
  "uri": "os://agents/multi-level.md"
}
```

**Agent** (`os://agents/multi-level.md`):
```yaml
---
skills:
  - os://skills/level-1.md
---
Agent content
```

**Skill Level 1** (`os://skills/level-1.md`):
```yaml
---
name: Level 1 Skill
description: Has transitive dependency
skills:
  - os://skills/level-2.md
---
```

**Skill Level 2** (`os://skills/level-2.md`):
```yaml
---
name: Level 2 Skill
description: Transitive dependency
---
```

**Expected Output**:
- Response type: `response`
- `metadata.dependencies.skills`: Array with ONE element (not two)
- `metadata.dependencies.skills[0].name`: `"Level 1 Skill"`
- `metadata.dependencies.skills[0].skills`: `["os://skills/level-2.md"]` (raw URI, NOT hydrated)
- `level-2.md` metadata MUST NOT appear in output (single-level only)

---

## 12. Implementation Notes (Non-Normative)

This section provides guidance for implementers but is not normative. Implementations MAY deviate from these recommendations while still conforming to the specification.

### 12.1. Reference Implementation

The PromptWar̊e ØS reference implementation uses the following approach:

- **Language**: TypeScript (Deno runtime)
- **Location**: `os/kernel/syscalls/hydrate.ts`
- **URI Resolution**: Uses `VFS.Resolve` syscall for absolute URI resolution (RFC 0013)
- **Caching**: In-memory LRU cache with 1-hour TTL (determinism allows indefinite caching, but 1 hour provides reasonable freshness)
- **Concurrency**: Parallel dependency fetching (up to 10 concurrent requests per hydration call)
- **Error Handling**: All errors captured as soft errors with `ERROR:` prefix

**Note**: These details are specific to the reference implementation and are not requirements.

### 12.2. Performance Optimization Strategies

Implementers MAY consider the following optimizations:

1. **Parallel Fetching**: Dependencies can be fetched concurrently (order independence per Section 5.4)
2. **Aggressive Caching**: Determinism allows caching hydrated results permanently (keyed by absolute URI)
3. **Lazy Tool Discovery**: Defer `--description` execution until first access (cache results for subsequent calls)
4. **Content Deduplication**: If the same skill appears in multiple agents, fetch metadata once and reuse

### 12.3. Error Recovery Best Practices

**Recommended Strategy**: Fail gracefully on partial failures
- If one skill fails to fetch, populate with `ERROR: FETCH_FAILED` and continue processing remaining skills
- If tool description extraction fails, use `ERROR: <CODE>` and continue
- Never abort entire hydration due to single dependency failure

**Rationale**: Partial success is better than total failure (aligns with Maximum Trust Principle)

### 12.4. Future Extensions

Potential enhancements for future versions (out of scope for v1.1):

- **Conditional Dependencies**: `skills_if: {platform: "web", skills: [...]}`
- **Version Constraints**: `skills: ["web-search@^2.0.0"]` with semver resolution
- **Transitive Dependency Flattening**: Optional flag to recursively hydrate all dependencies
- **Dependency Checksums**: Include content hashes in output for integrity verification
- **Lazy Loading**: Return dependency metadata without fetching content until explicitly requested

---

## 13. References

### PromptWar̊e ØS References

- [RFC 0012: Skill Specification](0012-sys-skill-spec.md) - Defines skill front matter format and Tool Discovery Contract
- [RFC 0013: Sysfs and Procfs](0013-kernel-vfs-sysfs.md) - Defines `os://` URI scheme and `VFS.Resolve` syscall
- [RFC 0015: Kernel Core Architecture](0015-kernel-core-arch.md) - Defines Maximum Trust Principle (co-founder privilege model)
- [RFC 0019: Kernel ABI & Syscall Interface](0019-kernel-abi-syscall.md) - Defines syscall naming conventions
- [RFC 0022: Semantic Token Optimization Protocol](0022-semantic-token-optimization-protocol.md) - Justifies token cost trade-offs
- [RFC 0024: Reactive Event-Driven Kernel Architecture](0024-kernel-events-architecture.md) - Defines OsEvent schema for responses

### External References

- [RFC 2119: Key words for use in RFCs to Indicate Requirement Levels](https://www.rfc-editor.org/rfc/rfc2119) - BCP 14 normative language

---

## Appendix A: JSON Schemas (Non-Normative)

The following schemas are provided in TypeScript notation for clarity but are not normative. Implementations MAY use any representation that satisfies the requirements in Sections 5.1 and 5.2.

### A.1. Input Schema (TypeScript)

```typescript
interface ContentHydrateInput {
  uri: string;  // REQUIRED: Resource URI to hydrate
}
```

### A.2. Output Schema (TypeScript)

```typescript
interface ContentHydrateOutput {
  content: string;
  metadata: {
    uri: string;
    dependencies: {
      skills: Array<{
        uri: string;
        name: string;  // May contain "ERROR: <CODE>"
        description: string;  // May contain "ERROR: <CODE>"
        skills: string[];  // Raw URIs (not hydrated)
        tools: string[];  // Raw URIs (not hydrated)
      }>;
      tools: Array<{
        uri: string;
        description: string;  // May contain "ERROR: <CODE>"
      }>;
    };
  };
}
```

### A.3. Error Code Reference (Non-Normative)

```typescript
type SoftErrorCode =
  | "ERROR: FETCH_FAILED"
  | "ERROR: PARSE_ERROR"
  | "ERROR: MISSING_NAME"
  | "ERROR: MISSING_DESCRIPTION"
  | "ERROR: TIMEOUT"
  | "ERROR: PERMISSION_DENIED"
  | "ERROR: NOT_FOUND"
  | "ERROR: EXECUTION_FAILED"
  | "ERROR: NO_OUTPUT"
  | "ERROR: UNSUPPORTED_SCHEME"
  | "ERROR: EXECUTION_SKIPPED";
```

---

## Appendix B: Change Log

### Version 1.1.0 (2025-12-31)

**Major Revision** - AI-Native Design & Simplification

**Breaking Changes**:
- **Syscall name**: `Prompt.Ingest` → `Content.Hydrate`
- **Input schema**: Removed `root` and `maxDepth` parameters (now just `{uri}`)
- **Processing model**: Changed from recursive to single-level dependency resolution
- **Error handling**: Changed from hard errors (abort) to soft errors (in-band with `ERROR:` prefix)
- **Output schema**: Skill metadata now includes raw `skills` and `tools` arrays (not hydrated)

**Simplifications** (33% size reduction):
- Removed circular dependency detection (not needed for single-level)
- Removed depth tracking and limiting (not needed for single-level)
- Removed 3 test cases (recursive, circular, depth tests)
- Removed error event schema (errors are now in-band)

**Enhancements**:
- **AI-Native Naming**: "Hydrate" aligns with LLM mental models (context expansion)
- **In-Band Error Reporting**: `ERROR:` prefix makes failures visible but not blocking
- **Maximum Trust Principle**: Tools execute with full privileges (co-founder model)
- **Determinism**: Trivially guaranteed without recursion complexity
- **Observability**: LLMs can inspect and handle errors gracefully

**Quality Gate Compliance**:
- ✅ Rule 1 (Spec, Not Code): JSON schemas, no implementation details
- ✅ Rule 2 (Normative Language): BCP 14 throughout
- ✅ Rule 3 (Deterministic Semantics): Section 5.4 guarantees repeatability
- ✅ Rule 4 (Independent Implementability): Self-contained specification
- ✅ Rule 5 (Testable Requirements): 6 black-box tests covering all critical paths

**Alignment**:
- RFC 0012: Extends skill specification with hydration protocol
- RFC 0013: Uses `os://` URI scheme and `VFS.Resolve`
- RFC 0015: Implements Maximum Trust Principle
- RFC 0019: Follows `Domain.Action` naming convention
- RFC 0022: Justifies "hydrate" token cost (semantic specificity > brevity)
- RFC 0024: Returns OsEvent-compliant responses

---

### Version 1.0.0 (2025-12-30)

Initial publication (superseded by 1.1.0)

---

End of RFC 0020

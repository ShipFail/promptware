---
rfc: 0020
title: Dependency Metadata Hydration
author: Ship.Fail
status: Draft
type: Standards Track
created: 2025-12-24
updated: 2025-12-31
version: 2.0.0
tags: [dependency, metadata, hydration, transformation, markdown]
---

# RFC 0020: Dependency Metadata Hydration

## 1. Summary

This RFC specifies **Dependency Metadata Hydration** - a deterministic transformation that expands dependency references in Markdown front matter from compact URI arrays into rich URI-keyed metadata objects.

**Transformation:**

```
Input:  Markdown file with `skills: [uri1, uri2]` in front matter
Output: Markdown file with `skills: {uri1: {name, description}, uri2: {...}}` in front matter
```

**Invariant:** Content body remains byte-identical.

**Use Case:** An agent file declares `skills: [os://skills/web-search.md]`. The transformation replaces this URI array with a URI-keyed object containing the skill's identity and capabilities metadata.

---

## 2. Conformance Language

The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**, **SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **MAY**, and **OPTIONAL** in this document are to be interpreted as described in BCP 14 [RFC 2119].

---

## 3. Motivation

Markdown files lack a native module system. When content references external dependencies (skills, tools, libraries), those references are opaque URIs.

**Problems with opaque URIs:**
1. Consumers must manually resolve each dependency
2. No standardized format for dependency metadata
3. Dependency information is not self-contained

**Solution: Hydration Transformation**

This RFC defines a standard transformation that:
- Expands dependency URIs into structured metadata objects
- Preserves original content exactly
- Produces deterministic, cacheable output

**Example:** Instead of `skills: [uri1, uri2]`, output contains `skills: {uri1: {name, desc}, uri2: {name, desc}}`

---

## 4. Hydration Transformation Specification

### 4.1. Input File Format

A hydration input file MUST be a Markdown file with structured metadata.

**Structured Metadata Requirements:**
- MUST be machine-parseable key-value metadata
- MUST support string, array, and object values
- MUST be clearly delimited from content body

**Reference Format:** YAML front matter delimited by `---` lines (see Appendix A for canonical format).

**Dependency Declaration Fields:**

The metadata MAY contain:
- `skills` (array of strings): URIs of skill dependencies
- `tools` (array of strings): URIs of tool dependencies

All other metadata fields MUST be preserved unchanged.

**Content Body:**

All content after metadata MUST be preserved byte-identical in output.

**Example Input:**

```yaml
---
name: Research Agent
skills:
  - os://skills/web-search.md
  - ./local-skill.md
tools:
  - ./fact-checker.sh
---
You are a research assistant specializing in academic work.
```

### 4.2. Output File Format

The hydration output MUST be a Markdown file with expanded metadata.

**Metadata Transformation:**

Original dependency URI arrays are replaced with URI-keyed metadata objects.

**Input Format:**
```yaml
skills: [uri1, uri2, ...]
tools: [uri1, uri2, ...]
```

**Output Format:**
```yaml
skills:
  uri1:
    name: "..."
    description: "..."
  uri2:
    name: "..."
    description: "..."
tools:
  uri1:
    description: "..."
  uri2:
    description: "..."
```

**Skill Metadata Object:**

Each skill URI key MUST map to an object containing:
- `name` (string): Skill identifier for agent reasoning
- `description` (string): Skill capabilities and purpose

**Tool Metadata Object:**

Each tool URI key MUST map to an object containing:
- `description` (string): Tool capabilities and usage

**Field Absence Handling:**

When required metadata fields cannot be obtained, the transformation MUST indicate the absence in a manner that:
1. Is distinguishable from valid values
2. Allows programmatic detection
3. Preserves the dependency entry in the output

(See Appendix B for suggested error representation strategies.)

**Content Preservation:**

The content body MUST be byte-identical to the input file.

**Example Output:**

```yaml
---
name: Research Agent
skills:
  os://skills/web-search.md:
    name: Web Search
    description: Semantic web search capability with result ranking
  file:///workspace/local-skill.md:
    name: Local Skill
    description: Project-specific skill for domain tasks
tools:
  file:///workspace/fact-checker.sh:
    description: Verifies factual claims against knowledge base
---
You are a research assistant specializing in academic work.
```

### 4.3. Transformation Semantics

**URI-to-Metadata Mapping:**

The transformation expands dependency URI arrays into URI-keyed metadata objects.

Each URI in the input array becomes a key in the output object, mapped to its metadata.

**Determinism:**

The transformation MUST be deterministic:
- Same input file → semantically equivalent output file
- URI order in input MAY differ from output order
- Implementations SHOULD use consistent URI ordering (e.g., lexicographic)

**URI Resolution:**

Relative URIs in input MUST be resolved to absolute URIs in output.

Resolution base: The URI of the input file itself (or an explicitly provided base).

**Example:**
- Input file: `os://agents/writer.md`
- Relative skill: `./local-skill.md`
- Output key: `os://agents/local-skill.md`

**Field Preservation:**

All metadata fields except `skills` and `tools` MUST be preserved unchanged.

The content body MUST be preserved byte-identical.

---

## 5. Dependency Metadata Requirements

### 5.1. Skill Metadata

Each skill URI key MUST map to an object with the following fields:

**Required Fields:**
- `name`: Skill identifier for agent reasoning and capability lookup
- `description`: Skill capabilities, purpose, and behavioral constraints

**Semantic Meaning:**
- `name`: Used by agents to identify and reference the skill in reasoning chains
- `description`: Explains the skill's capabilities, constraints, and appropriate usage contexts

**Field Absence:**

If `name` or `description` cannot be obtained from the skill resource, the transformation MUST represent this absence in a distinguishable manner (see Appendix B).

### 5.2. Tool Metadata

Each tool URI key MUST map to an object with the following field:

**Required Field:**
- `description`: Tool capabilities, parameters, and usage patterns

**Semantic Meaning:**
- `description`: Explains the tool's purpose, expected inputs, and behavioral characteristics for agent planning

**Field Absence:**

If `description` cannot be obtained, the transformation MUST represent this absence in a distinguishable manner (see Appendix B).

---

## 6. Examples (Non-Normative)

### 6.1. Simple Skill Expansion

**Input File:**

```yaml
---
skills:
  - os://skills/grammar.md
---
Agent content.
```

**Skill Resource** (`os://skills/grammar.md`):

```yaml
---
name: Grammar Checker
description: Validates English grammar and suggests corrections
---
```

**Output File:**

```yaml
---
skills:
  os://skills/grammar.md:
    name: Grammar Checker
    description: Validates English grammar and suggests corrections
---
Agent content.
```

**Observations:**
- URI array → URI-keyed object
- Content preserved exactly
- Clean, flat structure

### 6.2. Multiple Dependencies

**Input File:**

```yaml
---
skills:
  - os://skills/search.md
  - os://skills/citations.md
tools:
  - ./formatter.sh
---
```

**Output File:**

```yaml
---
skills:
  os://skills/citations.md:
    name: Citation Formatter
    description: Formats academic citations in APA, MLA, Chicago styles
  os://skills/search.md:
    name: Web Search
    description: Semantic web search with result filtering
tools:
  file:///workspace/formatter.sh:
    description: Formats text output with configurable styles
---
```

**Observations:**
- URIs sorted lexicographically for determinism
- Relative tool path resolved to absolute
- All dependencies at same nesting level

### 6.3. Field Absence Representation

**Input File:**

```yaml
---
skills:
  - os://skills/broken.md
---
```

**Skill** (`os://skills/broken.md`):

```yaml
---
# Missing 'name' and 'description'
---
```

**Output File (Example Representation):**

```yaml
---
skills:
  os://skills/broken.md:
    name: <field-absent>
    description: <field-absent>
---
```

**Note:** Exact absence representation is implementation-defined (see Appendix B). The requirement is only that absence be distinguishable from valid values.

---

## 7. Compatibility

### 7.1. PromptWar̊e ØS Integration

This transformation is designed for use within PromptWar̊e ØS but the specification is implementation-agnostic.

**Integration Patterns:**
- File-to-file transformation tools
- Syscall interfaces (see Appendix C)
- Build-time preprocessing
- Runtime dynamic loading

### 7.2. Relationship to Other RFCs

This RFC defines a pure transformation specification. Related RFCs:

- **RFC 0012 (Skill Specification)**: Defines skill front matter format
- **RFC 0013 (VFS/Sysfs)**: Defines `os://` URI scheme for resource addressing

---

## 8. Rationale

### 8.1. Why URI-as-Key Format?

**Decision:** Use URIs as object keys, not as fields within objects.

**Rationale:**
- **DRY Principle**: Eliminates redundant `uri` field in each object
- **Clarity**: Direct mapping from URI to metadata is semantically clearer
- **Simplicity**: No need to explain "single-level" vs "recursive" expansion
- **Agent-Friendly**: Flat structure easier for LLMs to parse and reason about

**Alternative Considered:** Array of `{uri, name, description, skills, tools}` objects (rejected due to nested complexity)

### 8.2. Why AI-First Language?

**Decision:** Optimize field semantics for AI agents, not humans.

**Rationale:**
- PromptWar̊e ØS is an AI-native OS
- Fields like `name` and `description` serve agent reasoning, not UI display
- Agents use `name` for capability lookup and planning
- Agents use `description` for understanding behavioral constraints

**Alternative Considered:** "Human-readable" terminology (rejected as secondary concern)

### 8.3. Why Determinism Requirement?

**Decision:** Require deterministic transformation.

**Rationale:**
- Enables caching without invalidation complexity
- Makes testing straightforward (same input always produces same output)
- Simplifies distributed systems (no coordination needed)
- Supports reproducible builds

---

## 9. Security Considerations

### 9.1. URI Validation

Implementations SHOULD validate URIs to prevent:
- Path traversal attacks (e.g., `../../etc/passwd`)
- Unsupported scheme injection
- Malformed URI syntax

### 9.2. Metadata Injection

Skill and tool metadata is untrusted input. Consumers MUST NOT:
- Execute metadata content as code
- Interpolate metadata into shell commands without escaping
- Render metadata in HTML contexts without sanitization

This RFC specifies data transport; security is the consumer's responsibility.

### 9.3. Denial of Service

Implementations MAY enforce limits on:
- Number of dependencies per file (e.g., max 1000)
- Metadata field sizes (e.g., max 10KB per description)
- Transformation depth (though this spec defines depth=1)

---

## 10. Conformance Testing (Normative)

Conforming transformations MUST satisfy the following black-box tests.

### T1: Simple Expansion

**Input:** Markdown file with `skills: [uri]` in front matter
**Expected:** Output has `skills: {uri: {name, description}}` object
**Verification:** Content body unchanged, metadata fields present

### T2: Determinism

**Input:** Same file transformed twice
**Expected:** Outputs are semantically equivalent
**Verification:** Repeated transformation produces consistent results

### T3: Field Absence

**Input:** Skill dependency with missing `name` field
**Expected:** Output skill object indicates `name` absence in distinguishable manner
**Verification:** Consumer can detect absence programmatically

### T4: URI Resolution

**Input:** File with relative skill URI `./skill.md`
**Expected:** Output uses absolute URI as key
**Verification:** Relative URIs resolved to absolute

### T5: Content Preservation

**Input:** File with arbitrary content body
**Expected:** Output content is byte-identical
**Verification:** `diff` shows no content body changes

### T6: Field Preservation

**Input:** File with metadata fields other than `skills`/`tools`
**Expected:** All other fields preserved unchanged
**Verification:** Non-dependency fields remain identical

---

## 11. References

### PromptWar̊e ØS References

- [RFC 0012: Skill Specification](0012-sys-skill-spec.md) - Defines skill front matter format

### External References

- [RFC 2119: Key words for use in RFCs](https://www.rfc-editor.org/rfc/rfc2119) - BCP 14 normative language
- [RFC 3986: URI Generic Syntax](https://www.rfc-editor.org/rfc/rfc3986) - URI resolution rules

---

## Appendix A: YAML Front Matter Format (Reference)

The canonical structured metadata format is YAML front matter delimited by `---`:

```yaml
---
field: value
array: [item1, item2]
object:
  key: value
---
Content body
```

**Parsing Rules:**
- Front matter MUST be at the beginning of the file
- Delimiters MUST be `---` on their own lines
- YAML MUST be valid per YAML 1.2 specification
- Content body starts after closing `---`

Alternative formats (JSON, TOML) MAY be supported but are outside this specification's scope.

---

## Appendix B: Error Representation Strategies (Non-Normative)

Implementations may use various strategies to represent field absence:

**Strategy 1: Sentinel Values**
```yaml
name: "<field-absent>"
description: "<field-absent>"
```

**Strategy 2: Null Values**
```yaml
name: null
description: null
```

**Strategy 3: Error Prefix Convention**
```yaml
name: "ERROR: MISSING_NAME"
description: "ERROR: MISSING_DESCRIPTION"
```

**Strategy 4: Dedicated Error Field**
```yaml
name: ""
description: ""
__error__: {name: "missing", description: "missing"}
```

All strategies are valid if consumers can programmatically detect absence.

**Recommended:** Sentinel values or error prefix for simplicity and LLM readability.

---

## Appendix C: Change Log

### Version 2.0.0 (2025-12-31)

**Major Rewrite** - Pure Transformation Specification

**Breaking Changes:**
- **Conceptual Shift**: From syscall protocol to file format transformation
- **Output Format**: From array of objects to URI-keyed objects
- **Metadata Fields**: Removed nested `skills` and `tools` arrays from output
- **Terminology**: AI-first language (name/description for agent reasoning, not human display)
- **Scope**: Pure specification with no implementation details

**Simplifications:**
- Removed "single-level processing" explanations (eliminated by URI-keyed design)
- Removed "multi-level dependency" examples (no longer relevant)
- Removed syscall interface specifications (moved to Appendix C)
- Removed processing phases (Fetch, Parse, Extract, Construct)
- Removed JSON schemas and TypeScript types

**Quality Gate Compliance:**
- ✅ Rule 1 (Spec, Not Code): Pure transformation semantics, no implementation
- ✅ Rule 2 (Normative Language): BCP 14 throughout
- ✅ Rule 3 (Deterministic Semantics): Same input → equivalent output
- ✅ Rule 4 (Independent Implementability): File-to-file transformation
- ✅ Rule 5 (Testable Requirements): 6 black-box file comparison tests

**New Design Principles:**
- AI-first: Optimize for agent reasoning, not human readability
- Format-focused: Defines transformation, not execution mechanism
- Minimal: URI-keyed objects eliminate nested dependency complexity

### Version 1.2.0 (2025-12-31)

**RFC Quality Gate Compliance Revision** (superseded by 2.0.0)

### Version 1.1.0 (2025-12-31)

**AI-Native Design & Simplification** (superseded by 2.0.0)

### Version 1.0.0 (2025-12-30)

Initial publication (superseded by 2.0.0)

---

End of RFC 0020

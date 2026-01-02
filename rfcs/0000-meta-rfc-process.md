---
rfc: 0000
title: RFC Process Guide
author: Huan Li
status: Draft
type: Process
created: 2025-12-20
updated: 2025-12-20
version: 1.0
tags: [process, guide, standard]
---

# RFC 0000: RFC Process Guide

## 1. Purpose

This document defines the **process, structure, and lifecycle** for Pr̊ØS (PromptWar̊e ØS) RFCs. It establishes how design proposals are:

* written,
* reviewed,
* accepted,
* implemented,
* and archived.

RFC 0000 itself does **not** specify product behavior; rather, it specifies **how all other RFCs must be managed**.

---

## 2. Goals

The RFC process aims to:

1. Provide a **clear, consistent, lightweight** format for technical proposals.
2. Ensure that major design decisions are **discoverable** and **preserved historically**.
3. Allow both humans and AI co-founders to reason through design evolution.
4. Keep the system **minimalist**, aligned with PromptWar̊e ØS philosophy.

---

## 3. When an RFC Is Required

An RFC **SHOULD** be created when a change:

* introduces a new PromptWar̊e ØS subsystem or concept,
* alters user-facing behavior,
* affects compatibility guarantees,
* impacts execution semantics (skills, kernel, bootloader, memory, etc.),
* defines a new standard or profile (e.g., Skill spec extensions).

An RFC **MAY** be created for documentation improvements, philosophical statements, or process updates.

Small implementation details **SHOULD NOT** require an RFC.

---

## 4. RFC File Location & Naming (The Component-First Standard)

All RFCs **MUST** live in the repository under:

```
rfcs/
```

Each RFC filename **MUST** use the following pattern:

```
<4-digit-number>-<domain>-<subsystem>-<concept>.md
```

### 4.1 Hierarchy Definitions
To ensure discoverability, use these categories:
*   **Domain**: The broad field (e.g., `security`, `memory`, `process`, `net`).
*   **Subsystem**: The specific machinery (e.g., `crypto`, `vault`, `rfc`, `http`).
*   **Concept**: The specific leaf node (e.g., `primitives`, `storage`, `guide`, `client`).

### 4.2 The Taxonomy Rule
To reduce cognitive load and redundancy:
*   **Drop the Brand**: Filenames **MUST NOT** include the project name (`promptware`, `promptwareos`, `pr0s`).
*   **Kebab-Case**: Use lowercase with hyphens.
*   **Length Constraint**: Target **3 slugs** for optimal readability. Use **4 slugs** if needed. **Max: 5 slugs**.

**Examples**:
*   ✅ `0016-security-crypto-primitives.md` (Domain-Subsystem-Concept)
*   ✅ `0018-system-memory-subsystem.md` (Clear hierarchy)
*   ❌ `0015-kernel.md` (Too short, missing hierarchy)
*   ❌ `0022-stop-protocol.md` (2 slugs: missing domain layer - expand acronyms into hierarchical taxonomy)
*   ❌ `0016-promptwareos-security-layer-definition-specification.md` (Too verbose)

### 4.2 Numbering
RFC numbers:
*   **MUST** be assigned sequentially.
*   **MUST** remain immutable.
*   **MUST NOT** be reused.
*   **Agent Protocol**: Agents **MUST** list the `rfcs/` directory to find the next available number before creating a file.

---

## 5. RFC Metadata Header (Template)

Every RFC **MUST** begin with the following Frontmatter YAML header block:

**Field Name Convention**: PromptWar̊e ØS follows the modern industry standard (Hugo, Jekyll, Docusaurus) of using **lowercase field names** for front matter to minimize cognitive load and maximize compatibility with existing Markdown tooling.

```yaml
---
rfc: <number>
title: <Noun Phrase Title>
author: <name(s)>
status: <Draft | Accepted | Final | Superseded>
type: <Standards Track | Informational | Process>
created: <YYYY-MM-DD>
updated: <YYYY-MM-DD>
version: <Major.Minor> (Optional)
tags: [comma, separated, tags] (Optional)
---
```

### 5.1 Title Style (Drop the Brand)
*   **Format**: `# RFC NNNN: <Noun Phrase>`
*   **Rule**: Titles **SHOULD** omit "PromptWare OS" unless necessary for external context.
*   **Example**: Use "Kernel Architecture", not "The PromptWare OS Kernel Architecture".

Example for RFC 0001:


```yaml
---
RFC: 0001
Title: Skill Specification
Author: Huan Li
Status: Draft
Type: Standards Track
Created: 2025-01-20
Updated: 2025-01-20
---
```

---

## 6. RFC Lifecycle

### 6.1 Draft

A proposal under active development. An RFC in Draft:

* **MAY** change rapidly,
* **MAY** solicit comments from contributors,
* **MUST NOT** be considered stable.

### 6.2 Accepted

An RFC is fully reviewed and approved. It:

* **MUST** reflect final intended design,
* **SHOULD** be stable,
* **MAY** still permit minor editorial updates.

### 6.3 Final

The RFC is fully implemented in PromptWar̊e ØS.

### 6.4 Superseded

The RFC has been replaced by a new RFC. The file remains for historical purposes.

---

## 7. Immutability & Errata

Once an RFC reaches **Accepted** or **Final**, the **normative sections are immutable**. Edits to normative meaning are not permitted.

### 7.1 Errata (Append-Only)

Non-breaking improvements **MAY** be appended under an internal appendix section titled:

```
Appendix: Errata & Notes
```

Errata entries:

* **MUST** be append-only.
* **MUST NOT** modify or contradict normative sections.
* **MUST** be clearly dated and scoped.
* **SHOULD** clarify intent, fix minor errors, or add non-normative examples.

Example format:

```
Appendix: Errata & Notes

Erratum 0001 (2026-03-01):
- Clarifies that URL-first execution may fall back to local scripts.
```

### 7.2 When a New RFC Is Required

Any change that affects **normative behavior** (MUST/SHOULD/MAY semantics) or introduces a **breaking or semantic** change **MUST** be published as a new RFC, which may supersede the prior one.

---

## 8. Review Process

1. Author drafts RFC in the `rfcs/` directory.
2. Discussion occurs via issues, pull requests, AI-assisted review, or synchronous sessions.
3. When consensus is reached, the RFC status becomes **Accepted**.
4. After implementation, the RFC becomes **Final**.

PromptWar̊e ØS prioritizes **speed and founder intuition** over committee governance. Consensus may be declared by the project owner.

---

## 9. Style Guidelines

RFCs **SHOULD**:

* be written in **clear, concise Markdown**,
* use **BCP 14 keywords** appropriately,
* separate **motivation**, **design**, **rationale**, and **compatibility**,
* include diagrams or examples when useful.

RFCs **MAY**:

* include alternative designs,
* provide migration notes,
* reference external documents.

### 9.1 Project Naming Convention
*   **Official Name**: Always use the stylized name **PromptWar̊e ØS** or the abbreviation **Pr̊ØS**.
*   **Prohibition**: Do **NOT** use the ASCII "PromptWare OS" unless strictly required by technical limitations (e.g., filenames, URLs, code variables).
*   **Rationale**: Preserves the unique brand identity and "Ring 0" philosophy.

### 9.2 Reference Style
To maintain clarity between internal laws and external standards, the **References** section **MUST** be split into two subsections:
1.  **PromptWar̊e ØS References**: Links to other internal RFCs (e.g., `RFC 0016`).
2.  **External References**: Links to IETF/W3C standards (e.g., `RFC 2119`).

**Example**:
```markdown
## References

### PromptWar̊e ØS References
* [RFC 0016: Crypto Primitives Specification](0016-security-crypto-primitives.md)

### External References
* [RFC 2119: Key words for use in RFCs](https://www.rfc-editor.org/rfc/rfc2119)
```

---

## 10. AI Co-Founder Considerations

RFCs **SHOULD** be written so that both humans and AI agents:

* can parse the structure easily,
* can progressively reason about design changes,
* can ingest RFCs as part of a boot sequence or training corpus.

RFCs **MAY** include machine-readable blocks, schemas, or instructions for agent behavior.

### 10.1 Agent Protocols (Pre-Flight Checks)
When creating or modifying RFCs, AI Agents **MUST**:
1.  **List Directory**: Run `list_dir rfcs/` to identify the next sequential number.
2.  **Check Style**: Verify the proposed filename against the **Component-First Rule** (Section 4.1).
3.  **Resolve Conflicts**: If a number conflict exists, increment to `NNNN+1`.
4.  **Refactor**: If existing RFCs violate the naming convention, propose a rename.
5.  **Slug Count Validation**: Split filename on hyphens (exclude number), count parts, verify 3 ≤ count ≤ 5. If fails, STOP and reconstruct before file creation.

---

## 11. Conclusion

RFC 0000 establishes a unified, minimal, forward-compatible process for PromptWar̊e ØS technical evolution. It ensures that new ideas are documented, discoverable, and preserved, without imposing unnecessary friction or ceremony.

The guiding principle of PromptWar̊e ØS RFCs is:

> **Document the future, but stay minimal.**

---

End of RFC 0000

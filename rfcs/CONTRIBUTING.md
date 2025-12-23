# Contributor Guide: How to Write a PromptWar̊e ØS RFC

This guide explains how humans and AI co-founders can create high-quality RFCs for PromptWar̊e ØS. It complements RFC 0000 (RFC Process Guide) and the `TEMPLATE.md` file.

The goal is to make RFC writing **minimal**, **clear**, and **future-proof**, while preserving the design philosophy of PromptWar̊e ØS.

---

## 1. What Is an RFC?

An RFC (Request for Comments) is a design document that:

* proposes a significant change to PromptWar̊e ØS,
* defines a new standard, subsystem, or execution model,
* or records important technical reasoning.

RFCs serve as the permanent architectural memory of PromptWar̊e ØS.

Write an RFC when:

* introducing a new component (e.g., kernel primitive, linker extension),
* modifying behavior that affects users or AI agents,
* defining specifications (like Skills, Bootloaders, Memory Models),
* or documenting a long-term architectural decision.

For small or trivial changes, no RFC is needed.

---

## 2. RFC Directory Structure

All RFCs live under:

```
rfcs/
```

Use the filename pattern (Component-First):

```
<4-digit-number>-<component>-<subtopic>.md
```

Examples:

* `0002-skill-specification.md`
* `0020-jit-linker.md`

Numbers must be sequential and never reused.

---

## 3. Start With the Template

Create a copy of:

```
rfcs/TEMPLATE.md
```

Fill in the metadata header:

```
RFC: XXXX
Title: <Noun Phrase Title>
Author: <Your Name or AI Identifier>
Status: Draft
Type: <Standards Track | Informational | Process>
Created: <YYYY-MM-DD>
Updated: <YYYY-MM-DD>
Version: 0.1
Tags: tag1, tag2
```

Use the **summary**, **motivation**, **design**, and **compatibility** sections to frame your thinking.

---

## 4. Writing Philosophy

Follow these principles to keep RFCs aligned with PromptWar̊e ØS values:

### 4.1 Minimalism

RFCs should include exactly what is required—no more, no less. Avoid unnecessary formalism.

### 4.2 Superset Compatibility

Always consider existing behavior. If proposing changes, explain:

* whether the change is backward compatible,
* how it interacts with Claude Skills, if applicable,
* and why it aligns with PromptWar̊e ØS’s extensibility philosophy.

### 4.3 Human + AI Readability

Write for both humans and AI agents:

* Clear hierarchy
* Stable terminology
* Concise examples
* Machine-friendly structure

### 4.4 Founder-Privilege Model

PromptWar̊e ØS operates under trust-maximal semantics. When proposing restrictions, justify why.

---

## 5. What Makes a Good RFC?

A high-quality RFC:

* **Explains the problem clearly**
* **Justifies the solution** in terms of PromptWar̊e ØS’s architecture
* **Evaluates alternatives**
* **Defines expected behavior precisely**
* **Documents compatibility requirements**
* **Separates must/should/may using BCP 14 wording**

Avoid vague language or ambiguous behavior.

---

## 6. Common Sections Explained

### 6.1 Summary

A 2–3 sentence overview.

### 6.2 Motivation

Why this change matters—who benefits, what breaks, what improves.

### 6.3 Detailed Design

The core section. Include:

* data structures,
* execution semantics,
* state transitions,
* runtime behavior.

### 6.4 Compatibility

How this interacts with:

* previous RFCs,
* PromptWar̊e ØS philosophy,
* Claude Skills,
* older agent behaviors.

### 6.5 Rationale

Why this design is preferred over other options.

### 6.6 Alternatives Considered

Show you've explored the design landscape.

### 6.7 Security Considerations

Explain implications in a trust-max model.

### 6.8 Implementation Plan

Outline practical rollout steps.

---

## 7. Reviewing & Finalization

1. Submit RFC via pull request to the `rfcs/` directory.
2. Discussion occurs via comments, issues, or synchronous design chats.
3. When a stable consensus is reached, the RFC status becomes **Accepted**.
4. After full implementation, the status becomes **Final**.

PromptWar̊e ØS favors *velocity over bureaucracy*: consensus may be determined by project leadership.

---

## 8. Tips for AI Co-Founders Writing RFCs

AI agents MAY:

* cite previous RFCs as foundational context,
* offer multiple design variants for human review,
* include machine-generated diagrams or schemas,
* auto-generate summaries and diffs.

Human contributors MAY use these tools to accelerate understanding.

---

## 9. Example: One-Sentence RFC Summary

> "This RFC defines the Just-In-Time Linker responsible for resolving skill mounts and inlining capability descriptors during PromptWar̊e ØS boot."

Short, crisp, unambiguous.

---

## 10. Final Notes

The RFC process is meant to:

* document decisions,
* clarify intent,
* prevent architectural drift,
* and ensure future AI agents understand historical reasoning.

Always prioritize clarity and alignment with the core PromptWar̊e ØS philosophy:

> **Boot simplicity. Execute power. Trust co-founders. Extend the standard.**

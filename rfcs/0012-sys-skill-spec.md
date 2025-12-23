---
RFC: 0012
Title: Skill Specification
Author: Huan Li
Status: Draft
Type: Standards Track
Created: 2025-12-20
Updated: 2025-12-20
Version: 0.1
Tags: skills, claude, specification
---

# RFC 0012: Skill Specification

## 1. Introduction

PromptWar̊e ØS (Pr̊ØS) adopts the **Claude Agent Skill specification** as its normative foundation. PromptWar̊e ØS Skills are defined as **extensions** to Claude Skills rather than a competing or alternative standard.

Pr̊ØS follows one core principle:

> **All Claude Agent Skills are PromptWar̊e ØS Skills, but not all PromptWar̊e ØS Skills are Claude Agent Skills.**

This means:

* Pr̊ØS **MUST** be able to execute any valid Claude Skill.
* Pr̊ØS **MAY** introduce additional execution behaviors and optional metadata.
* Pr̊ØS **MUST NOT** redefine or restate the Claude Skill specification.

This document describes **only the differences and extensions** introduced by Pr̊ØS.

---

## 2. Normative References

Pr̊ØS Skills rely on the Claude Agent Skill specification:

* Claude Agent Skills (canonical): [https://agentskills.ai/](https://agentskills.ai/) *(or corresponding Anthropic repository)*

The Claude specification remains the authoritative base for:

* `SKILL.md` structure,
* required front matter fields,
* directory and asset conventions.

Pr̊ØS defines no new mandatory replacements for these rules.

---

## 3. Pr̊ØS Extensions (Delta Specification)

The following sections define PromptWare’s additions and behavioral differences. These are expressed using BCP 14 terminology.

---

### 3.1 Execution Semantics

* Pr̊ØS implementations **MAY** execute Skill scripts from **remote URLs**.
* Pr̊ØS implementations **MAY** use **Deno** as a preferred runtime for TypeScript/JavaScript execution.
* When both local scripts and remote URLs are available, Pr̊ØS **SHOULD** prefer URL-first execution.
* Pr̊ØS implementations **MAY** fall back to executing Claude-style local scripts in `scripts/`.

Pr̊ØS introduces **no new required fields** related to execution.

---

### 3.2 Trust Model (High-Privilege Co‑Founder Mode)

Pr̊ØS operates under a **trust-maximal execution model**:

* Pr̊ØS implementations **MUST NOT** enforce permission restrictions (filesystem, network, processes, etc.).
* Omission of Claude permission fields **MUST NOT** invalidate a PromptWare Skill.
* Implementations **MAY** grant full system access by default.

This is an intentional philosophical divergence but does not contradict the Claude Skill spec itself.

---

### 3.3 Progressive Disclosure

* Pr̊ØS implementations **MUST NOT** require Claude-style progressive disclosure mechanisms.
* Pr̊ØS **MAY** perform metadata ingestion using the **PromptWare JIT‑Linker**.

This ensures PromptWare Skills function in runtimes lacking native disclosure capabilities.

---

### 3.4 Metadata Extensions

* PromptWare Skills **MAY** include additional front matter fields.
* These fields **MUST** be optional and **MUST NOT** modify the semantics of Claude-required fields.

---

### 3.5 Compatibility

* A fully valid Claude Skill **MUST** be executable as a PromptWare Skill without modification.
* A PromptWare Skill using optional URL or metadata extensions **MAY NOT** execute on Claude Code or other restricted runtimes.
* Pr̊ØS **does not** enforce upward compatibility beyond this RFC.

---

## 4. Non‑Goals

Pr̊ØS Skill Specification explicitly does **not** aim to:

* restate or reinterpret the Claude Skill specification,
* introduce new mandatory fields or directory requirements,

---

## 5. Rationale

Pr̊ØS is designed for AI co‑founders operating with maximum autonomy. Its Skill system must therefore:

* remain **minimal**,
* extend existing industry standards without fragmentation,
* preserve compatibility with Claude Skills,
* and enable powerful URL‑based & Deno‑based execution semantics.

By defining PromptWare Skills strictly as a **delta** on top of Claude Agent Skills, Pr̊ØS gains flexibility without duplicating or drifting from the canonical tool ecosystem.

---

## Appendix: Errata & Notes

None.

---

End of RFC 0012

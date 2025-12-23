# README for `/rfcs` Directory

## PromptWar̊e ØS RFCs

This directory contains all **Request for Comments (RFCs)** for PromptWar̊e ØS. RFCs document the architectural decisions, standards, and long-term evolution of the system.

PromptWar̊e ØS follows a lightweight, founder-centric RFC process designed for both **human developers** and **AI co-founders**.

### 📌 Purpose of RFCs

RFCs serve to:

* Capture major design decisions in a permanent, citable form.
* Provide clarity and historical context for how PromptWar̊e ØS evolves.
* Enable AI agents to ingest and reason about system design.
* Ensure standards (like Skills, Kernel, Memory, Bootloader, etc.) remain consistent and intentional.

### 📁 Structure

All RFCs live in this directory using the following naming pattern:

```
rfcs/
  0000-meta-rfc-process.md
  0001-meta-style-naming.md
  0012-sys-skill-spec.md
```

### 📄 RFC Filename Convention (Taxonomy)

* Filenames use **4‑digit sequential numbers**.
* Numbers **MUST NOT** change once assigned.
* Filenames **MUST** omit the project name (`promptware`, `promptwareos`).
* Format: `NNNN-<domain>-<subsystem>-<concept>.md`.

Example:

```
0012-sys-skill-spec.md
```

### 🧱 RFC Metadata Header

Each RFC begins with a metadata header:

```
RFC: <number>
Title: <Noun Phrase Title>
Author: <name(s)>
Status: <Draft | Accepted | Final | Superseded>
Type: <Standards Track | Informational | Process>
Created: <YYYY-MM-DD>
Updated: <YYYY-MM-DD>
Version: <Major.Minor>
Tags: <comma, separated, tags>
```

### 🌀 RFC Lifecycle

* **Draft**: Under discussion.
* **Accepted**: Consensus reached.
* **Final**: Implemented.
* **Superseded**: Replaced by a later RFC.

### 🧾 Errata

Accepted and Final RFCs are **normatively frozen**. Non-breaking clarifications are appended in an internal `Appendix: Errata & Notes` section.

### 🎯 Design Principles

PromptWar̊e ØS RFCs prioritize:

* Minimalism
* Clarity
* Compatibility
* Future-proofing
* Human + AI readability

### 🧠 AI Co-Founder Compatibility

RFCs SHOULD be written to support:

* direct ingestion by AI co-founder agents,
* progressive reasoning,
* reproducible understanding of system intent.

---

For details on how this process works, see **RFC 0000 – PromptWar̊e ØS RFC Process Guide**.

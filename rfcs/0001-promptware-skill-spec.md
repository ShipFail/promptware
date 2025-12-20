# PromptWare OS Skill Specification (RFC v0.1)

*Inspired by the minimalism of RFC 8259 (JSON) and the encapsulation philosophy of RFC 7468.*

---

## 1. Introduction

This document defines the canonical specification for **PromptWare OS Skills**. The intent is to establish a **minimal**, **forward‑compatible**, and **non‑conflicting** extension profile on top of the **Claude Agent Skill** standard.

PromptWare OS adopts the principle:

> **All Claude Agent Skills are PromptWare Skills, but not all PromptWare Skills are Claude Agent Skills.**

PromptWare OS is a *superset runtime*: it is capable of executing any valid Claude Agent Skill, while supporting additional operational capabilities such as URL‑based execution, Deno‑first tooling, and the co‑founder trust model.

This specification uses BCP 14 terminology ("MUST", "SHOULD", "MAY", etc.) as defined in RFC 2119 and RFC 8174.

---

## 2. Design Philosophy

PromptWare OS Skills adhere to the following principles:

1. **Minimalism** — Only essential normative rules are defined. Complexity is delegated to implementations.
2. **Superset Compatibility** — Any artifact conforming to the Claude Agent Skill specification MUST be executable as a PromptWare Skill.
3. **Extensibility Without Collision** — PromptWare MAY extend semantics, execution models, or metadata, but MUST NOT redefine or contradict Claude Agent Skill rules.
4. **High‑Trust Model** — PromptWare OS Skills operate under a "co‑founder privilege" assumption: the runtime MUST NOT impose security restrictions such as permission gating.
5. **Universal Interpretability** — Skills MUST remain understandable by both humans and AI agents without proprietary formats.

---

## 3. Definition of a PromptWare OS Skill

A **PromptWare OS Skill** is defined as:

> A directory or encapsulated artifact containing a `SKILL.md` file with valid front matter compliant with the Claude Agent Skill specification.

No additional fields, file structures, or schemas are required.

### 3.1 Skill Identification

A PromptWare OS Skill **MUST** contain a `SKILL.md` file as its primary manifest.

A PromptWare OS Skill **MUST** include all fields required by the Claude Agent Skill specification.

A PromptWare OS Skill **MAY** include additional fields.

There is **no requirement** that additional fields be namespaced.

### 3.2 Execution Model

PromptWare OS implementations:

* **MUST** support execution of Claude-conformant scripts located within the `scripts/` directory.
* **MAY** support execution of scripts referenced by remote URLs.
* **MAY** support alternative runtimes such as Deno for executing remote or embedded scripts.
* **MUST NOT** reject a Skill solely because it contains capabilities unsupported by Claude Code.

PromptWare OS runtimes:

* **MUST NOT** impose security restrictions such as permission gating, sandbox boundaries, or least-privilege execution.
* **MAY** run skills with full system access, consistent with the co‑founder trust model.

### 3.3 Progressive Disclosure

PromptWare OS Skills **MAY** be interpreted or loaded using PromptWare’s Just‑In‑Time Linker.

PromptWare OS **MUST NOT** require the agent runtime to implement Claude‑style progressive disclosure.

---

## 4. Extensibility

PromptWare OS Skills **MAY** define any additional metadata fields beyond the Claude specification. These fields:

* **MUST** be optional.
* **MUST NOT** invalidate Claude-compliant front matter.
* **MAY** be ignored by both Claude Code and PromptWare OS.

PromptWare OS **MAY** introduce new execution semantics (e.g., URL‑first behavior) but such semantics MUST remain backward compatible: any Claude Skill MUST still be runnable without modification.

---

## 5. Non-Goals

PromptWare OS Skills explicitly do **not** aim to:

* Define new required front matter fields.
* Redefine or restrict the Claude Agent Skill specification.
* Enforce security boundaries or permissions.
* Specify a canonical runtime (though Deno support is common).
* Require a particular directory layout beyond `SKILL.md`.

---

## 6. Encapsulation Structure

Borrowing the simplicity of RFC 7468, a PromptWare Skill MAY be viewed as a container with a single mandatory entry:

```
-----BEGIN PROMPTWARE SKILL-----
SKILL.md (required)
scripts/   (optional)
assets/    (optional)
other/     (optional)
-----END PROMPTWARE SKILL-----
```

This is a conceptual representation only; PromptWare OS does not mandate byte-level encapsulation formats.

---

## 7. Forward Compatibility

Future PromptWare OS specifications:

* **SHOULD** remain strictly backward compatible with this version.
* **SHOULD** continue to treat all Claude Agent Skills as valid PromptWare Skills.
* **MAY** define profiles or optional capability layers.

---

## 8. Security Considerations

PromptWare OS adopts a **trust-maximal co-founder model**:

* Implementations **MUST NOT** restrict filesystem, network, process, or system access.
* Implementations **MUST NOT** apply permission gating.
* AI agents operating as PromptWare co-founders are assumed to have full authority.

This model is intentionally divergent from conventional sandboxed agent frameworks.

---

## 9. IANA Considerations

This document defines no new media types or registries.

---

## 10. Conclusion

This RFC establishes PromptWare OS Skills as a **minimal**, **extensible**, and **fully superset-compatible** specification on top of the Claude Agent Skill standard. It intentionally avoids introducing new required fields or structural constraints, ensuring longevity and zero conceptual friction for both human developers and AI agents.

PromptWare OS provides a high‑trust execution environment suitable for AI co-founders, while maintaining universal interpretability and compatibility across agent ecosystems.

---
RFC: 0001
Title: Unified Naming Conventions
Author: Huan Li
Status: Proposed
Type: Standards Track
Created: 2025-09-20
Updated: 2025-09-20
Version: 1.0
Tags: naming, convention, style-guide
---

# RFC 0001: Unified Naming Conventions

## 1. Summary

This RFC defines a **unified naming convention** for the Ship.Fail umbrella project, covering **Swift (iOS)**, **TypeScript (Firebase)**, **RESTful APIs**, **Firestore/RTDB**, and **environment variables**. The goal is to maintain uniformity and reduce cognitive load by adopting a single naming convention across all layers of the stack.

> **Memory hook**: camelCase for data, PascalCase for types, kebab-case plural for collections/files, UPPER\_SNAKE only for env vars — never introduce snake\_case inside the domain.

---

## 2. Motivation

In a multi-stack environment, inconsistent naming leads to confusion, unnecessary translation between layers, and potential errors. A unified approach:

*   Enhances **developer productivity**.
*   Improves **maintainability**.
*   Supports **AI-assisted coding agents** by reducing ambiguity.
*   Ensures **onboarding simplicity** with predictable conventions.

---

## 3. Goals & Non-Goals

### Goals

*   Establish a single, clear naming convention for all data, types, files, and environment variables.
*   Reduce cognitive overhead for developers and AI agents switching between different parts of the tech stack.
*   Improve code readability, maintainability, and review efficiency.
*   Ensure all new code adheres to a consistent and predictable style.

### Non-Goals

*   This RFC does not specify the exact linting rules or tooling required for enforcement.
*   It does not mandate the immediate refactoring of all legacy code, which is left to the implementation plan.

---

## 4. Detailed Design

This section specifies the global naming rules and provides a quick reference table for clarity.

### Global Rules

*   **camelCase**: default style for all runtime data, JSON keys, and Firestore/RTDB fields.
*   **PascalCase**: types, classes, enums, Swift filenames.
*   **kebab-case**: TypeScript filenames, Firestore/RTDB top-level collections (always plural).
*   **UPPER\_SNAKE**: environment variables, secrets, global constants (rare).
*   **snake\_case**: forbidden internally, only used at unavoidable integration boundaries.

### Quick Reference

| **Thing** | **Style** | **Examples** |
| :--- | :--- | :--- |
| JSON / API fields | camelCase | `transformId`, `userText`, `mediaUrls` |
| Runtime object keys | camelCase | `request.userId` |
| Types / classes / interfaces | PascalCase | `TransformRequest`, `LogService` |
| Enum members (TS) | PascalCase / UPPER\_SNAKE (flags) | `ModelTier.Fast`, `PERMISSION_READ` |
| Swift enum cases | lowerCamel | `case politeRewrite` |
| TypeScript filenames | kebab-case | `transform-service.ts` |
| Swift filenames | PascalCase | `TransformService.swift` |
| Firestore / RTDB collections | kebab-case plural | `user-transforms`, `community-prompts` |
| Firestore / RTDB fields | camelCase | `userId`, `userProfile` |
| REST API routes & params | camelCase | `/getUserProfile?userId=123` |
| Environment variables / secrets | UPPER\_SNAKE | `OPENAI_API_KEY`, `SERVER_PORT` |
| Constants (code) | camelCase (preferred) / UPPER\_SNAKE (global) | `maxPromptChars`, `SERVER_CONFIG` |

### Detailed Rules

1.  One casing rule per layer avoids mapping drift.
2.  Do not introduce snake\_case fields; if an external API uses it, adapt at the boundary and keep internal models camelCase.
3.  Collection names are always **plural** (e.g. `llm-analytics`). No mixing styles inside path segments.
4.  Prefer descriptive names over abbreviations (`transformPrompt` not `tfPrompt`).
5.  Tool identifiers (e.g. `rekeyTransform`) follow camelCase, like function names.

---

## 5. Compatibility

*   **Backward Compatibility**: This RFC is not backward compatible with code that uses different conventions. Legacy code will require refactoring to comply.
*   **Migration**: All pre-release snake\_case identifiers have been migrated. Introducing new snake\_case internally is considered a **regression** and must be rejected in code review.
*   **Exceptions**: Only apply snake\_case at external integration boundaries (e.g. consuming a 3rd-party API). Handle conversion in adapter modules.

---

## 6. Rationale

*   **Consistency**: camelCase across all layers prevents translation overhead.
*   **Clarity**: PascalCase for types aligns with OOP conventions.
*   **Readability**: kebab-case filenames improve scanability and Git diffs in web projects.
*   **Plurality**: plural collection names make APIs more expressive.
*   **Separation of concerns**: env vars use UPPER\_SNAKE to distinguish system-level configs from runtime code.
*   **Future-proof**: unified style simplifies auto-generation of SDKs, schemas, and AI agents.

---

## 7. Alternatives Considered

*   **snake\_case for Firestore fields**: rejected — inconsistent with app/API.
*   **PascalCase API routes**: rejected — not idiomatic REST.
*   **Mixed conventions per platform**: rejected — increases complexity.

---

## 8. Security Considerations

This RFC has no direct security implications, as it pertains only to naming conventions and code style.

---

## 9. Implementation Plan

1.  Apply convention to all new code.
2.  Refactor legacy names gradually during active development.
3.  Enforce via ESLint, SwiftLint, and pre-commit hooks.
4.  Document conventions in onboarding guides.

---

## 10. Future Directions

None.

---

## 11. Unresolved Questions

None.

---

## 12. References

*   [RFC 0000: RFC Process Guide](0000-meta-rfc-process.md)

---
## Appendix B: Examples

1.  **Swift (iOS)**: The app uses `userProfile` and sends a request with the `userId` parameter.
2.  **REST API (TypeScript/Firebase)**: Processes the request and accesses Firestore using `userProfile`.
3.  **Firestore**: Stores fields such as `userId`, `userProfile`, and `userStatus`, under collection `user-profiles`.
4.  **Response**: Returns JSON with camelCase keys, e.g. `userProfile`.

## Appendix: Errata & Notes

None.

---

End of RFC 0001

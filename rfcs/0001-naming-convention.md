---
id: RFC-001
slug: naming-convention
title: Unified Consistent Naming Convention for Multi-Tech Stack
author: Huan Li
status: Proposed
created: 2025-09-20
updated: 2025-09-20
version: 2.0.0
tags: ["naming", "style-guide", "shipfail"]
---

## Summary

This RFC defines a **unified naming convention** for the Ship.Fail umbrella project, covering **Swift (iOS)**, **TypeScript (Firebase)**, **RESTful APIs**, **Firestore/RTDB**, and **environment variables**. The goal is to maintain uniformity and reduce cognitive load by adopting a single naming convention across all layers of the stack.

> **Memory hook**: camelCase for data, PascalCase for types, kebab-case plural for collections/files, UPPER\_SNAKE only for env vars — never introduce snake\_case inside the domain.

## Motivation

In a multi-stack environment, inconsistent naming leads to confusion, unnecessary translation between layers, and potential errors. A unified approach:

* Enhances **developer productivity**.
* Improves **maintainability**.
* Supports **AI-assisted coding agents** by reducing ambiguity.
* Ensures **onboarding simplicity** with predictable conventions.

## Specification

### Global Rules

* **camelCase**: default style for all runtime data, JSON keys, and Firestore/RTDB fields.
* **PascalCase**: types, classes, enums, Swift filenames.
* **kebab-case**: TypeScript filenames, Firestore/RTDB top-level collections (always plural).
* **UPPER\_SNAKE**: environment variables, secrets, global constants (rare).
* **snake\_case**: forbidden internally, only used at unavoidable integration boundaries.

### Quick Reference

| **Thing**                       | **Style**                                     | **Examples**                           |
| ------------------------------- | --------------------------------------------- | -------------------------------------- |
| JSON / API fields               | camelCase                                     | `transformId`, `userText`, `mediaUrls` |
| Runtime object keys             | camelCase                                     | `request.userId`                       |
| Types / classes / interfaces    | PascalCase                                    | `TransformRequest`, `LogService`       |
| Enum members (TS)               | PascalCase / UPPER\_SNAKE (flags)             | `ModelTier.Fast`, `PERMISSION_READ`    |
| Swift enum cases                | lowerCamel                                    | `case politeRewrite`                   |
| TypeScript filenames            | kebab-case                                    | `transform-service.ts`                 |
| Swift filenames                 | PascalCase                                    | `TransformService.swift`               |
| Firestore / RTDB collections    | kebab-case plural                             | `user-transforms`, `community-prompts` |
| Firestore / RTDB fields         | camelCase                                     | `userId`, `userProfile`                |
| REST API routes & params        | camelCase                                     | `/getUserProfile?userId=123`           |
| Environment variables / secrets | UPPER\_SNAKE                                  | `OPENAI_API_KEY`, `SERVER_PORT`        |
| Constants (code)                | camelCase (preferred) / UPPER\_SNAKE (global) | `maxPromptChars`, `SERVER_CONFIG`      |

### Detailed Rules

1. One casing rule per layer avoids mapping drift.
2. Do not introduce snake\_case fields; if an external API uses it, adapt at the boundary and keep internal models camelCase.
3. Collection names are always **plural** (e.g. `llm-analytics`). No mixing styles inside path segments.
4. Prefer descriptive names over abbreviations (`transformPrompt` not `tfPrompt`).
5. Tool identifiers (e.g. `rekeyTransform`) follow camelCase, like function names.

### Examples

1. **Swift (iOS)**: The app uses `userProfile` and sends a request with the `userId` parameter.
2. **REST API (TypeScript/Firebase)**: Processes the request and accesses Firestore using `userProfile`.
3. **Firestore**: Stores fields such as `userId`, `userProfile`, and `userStatus`, under collection `user-profiles`.
4. **Response**: Returns JSON with camelCase keys, e.g. `userProfile`.

## Rationale

* **Consistency**: camelCase across all layers prevents translation overhead.
* **Clarity**: PascalCase for types aligns with OOP conventions.
* **Readability**: kebab-case filenames improve scanability and Git diffs in web projects.
* **Plurality**: plural collection names make APIs more expressive.
* **Separation of concerns**: env vars use UPPER\_SNAKE to distinguish system-level configs from runtime code.
* **Future-proof**: unified style simplifies auto-generation of SDKs, schemas, and AI agents.

## Benefits

* **Uniformity**: Single convention across data, files, APIs, and Firestore.
* **Reduced Cognitive Load**: No switching between styles.
* **Maintainability**: Easier onboarding, clearer code reviews.
* **Scalability**: Predictable naming benefits AI-assisted coding and larger teams.

## Drawbacks

* Legacy code may require renaming.
* Enforcement requires linting and CI/CD rules.

## Alternatives Considered

* **snake\_case for Firestore fields**: rejected — inconsistent with app/API.
* **PascalCase API routes**: rejected — not idiomatic REST.
* **Mixed conventions per platform**: rejected — increases complexity.

## Exceptions

* Only apply snake\_case at external integration boundaries (e.g. consuming a 3rd-party API). Handle conversion in adapter modules.

## Migration Notes

* All pre-release snake\_case identifiers have been migrated.
* Introducing new snake\_case internally is considered a **regression** and must be rejected in code review.

## Adoption Plan

1. Apply convention to all new code.
2. Refactor legacy names gradually during active development.
3. Enforce via ESLint, SwiftLint, and pre-commit hooks.
4. Document conventions in onboarding guides.

## Conclusion

By adopting **RFC-001 v2: Unified Naming Convention**, Ship.Fail ensures a clean, scalable, and developer-friendly codebase across iOS, Firebase, REST APIs, Firestore, and environment variables. This alignment improves efficiency and reduces ambiguity for both human and AI contributors.

---
rfc: 0021
title: Spec-Driven Verification
author: Ship.Fail
status: Draft
type: Standards Track
category: Process
created: 2025-12-24
---

# RFC 0021: Spec-Driven Verification

## 1. Summary
This RFC establishes the **Spec-Driven Verification** standard for PromptWare OS. It mandates that the "Physics" of the system (Code) must be explicitly verified against the "Laws" of the system (RFCs). It introduces the **Compliance Rule**: every normative requirement (`MUST`, `MUST NOT`) in a Standards Track RFC requires a corresponding Unit Test.

## 2. Motivation
In an AI-Native OS, the distinction between "Intent" (Promptware) and "Precision" (Software) is critical. If the Software Kernel diverges from its specification, the Promptware Kernel's assumptions fail, leading to hallucinations or security breaches.
Traditional testing ensures code works; **Compliance Testing** ensures code obeys the Law.

## 3. The Verification Pyramid

PromptWare OS defines three levels of verification:

| Level | Name | Scope | Tooling | Goal |
| :--- | :--- | :--- | :--- | :--- |
| **L0** | **Static** | Syntax, Types | `deno lint`, `tsc` | Code is valid TypeScript. |
| **L1** | **Physics** | Kernel Logic | `deno test` | Code obeys RFC "MUST" clauses. |
| **L2** | **Intent** | Agent Behavior | `diagnostic.md` | Agents behave as designed. |

## 4. The Compliance Rule (Level 1)

### 4.1. Normative Mapping
*   **Requirement**: Every `MUST` or `MUST NOT` clause in a Standards Track RFC **MUST** have at least one corresponding Unit Test in the Kernel Test Suite.
*   **Naming Convention**: Test names **MUST** explicitly reference the RFC number and the requirement being tested.
    *   *Format*: `RFC {Number}: {Requirement Summary}`
    *   *Example*: `RFC 0018: Memory MUST enforce absolute paths`

### 4.2. The Compliance Matrix
Every release **MUST** include a generated **Verification Report** (`docs/verification-report.md`) that maps RFCs to their specific test cases.

## 5. Test Suite Standards

### 5.1. Isolation & Mocking
*   **Network**: L1 tests **MUST NOT** make real network requests. All `fetch` calls must be mocked.
*   **State**: L1 tests **MUST** use isolated memory backends (e.g., `Deno.openKv(":memory:")` or mocked KV).
*   **Determinism**: Tests **MUST** be deterministic. Flaky tests are considered failures.

### 5.2. Tooling
*   **Runner**: The standard runner is `deno test`.
*   **Permissions**: Tests should run with the minimum required permissions (`--allow-read`, `--allow-env`, etc.).
*   **Unstable APIs**: Use of `--unstable-kv` is permitted for Kernel tests.

## 6. Implementation Guide

### 6.1. Writing a Compliance Test
1.  **Identify the Law**: Locate the `MUST` clause in the RFC (e.g., RFC 0016: "Implementations MUST reject non-UTF8 input").
2.  **Write the Test**: Create a `Deno.test` block in the corresponding `.test.ts` file.
3.  **Name the Test**: `Deno.test("RFC 0016: Reject non-UTF8 input", ...)`
4.  **Assert Behavior**: Use `assertRejects` or `assertEquals` to prove compliance.

### 6.2. Review Process
Code reviews for Kernel changes **MUST** verify that:
1.  New RFC requirements have matching tests.
2.  Existing tests are not deleted without RFC updates.

## 7. Security Considerations
*   **False Confidence**: Passing tests prove compliance with the *test*, not necessarily the *spec*. Tests must be audited for correctness.
*   **Mocking Risks**: Over-mocking can hide integration bugs. L2 (Intent) tests are required to verify end-to-end behavior.

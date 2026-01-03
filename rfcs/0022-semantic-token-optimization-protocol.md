---
rfc: 0022
title: Semantic Token Optimization Protocol (STOP)
author: Ship.Fail
status: Draft
type: Standards Track
created: 2025-12-26
updated: 2025-12-26
version: 0.1.0
tags: [protocol, optimization, tokens, semantics, prompts, linguistics]
---

# RFC 0022: Semantic Token Optimization Protocol (STOP)

## Subtitle
Character Density Maximization for LLM Kernel Prompts

---

## Abstract

This RFC defines the **Semantic Token Optimization Protocol (STOP)**, a systematic framework for maximizing semantic information density in natural language prompts for Large Language Model (LLM) based operating systems. By establishing quantitative metrics and normative decision rules, STOP enables prompt engineers to achieve higher information content per token without increasing token cost. The protocol introduces the principle of "Semantic Maximalism at Equal Token Cost" and defines optimization criteria based on character density, semantic specificity, and cost efficiency.

STOP addresses a counterintuitive insight: in tokenized language models, longer words often cost the same number of tokens as shorter abbreviations but carry significantly more semantic information. This RFC formalizes the methodology for systematically exploiting this property.

This protocol represents the first formalization within the emerging field of **PromptWare Linguistics (PWL)**—natural language engineering at the kernel layer of LLM-native systems.

---

## Status of This Memo

This document is a PromptWar̊e ØS RFC-style specification and may change at any time during the Draft phase.

The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**, **SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **MAY**, and **OPTIONAL** are to be interpreted as described in [RFC 2119](https://www.ietf.org/rfc/rfc2119.txt).

---

## 1. Introduction

### 1.1. Motivation

Large Language Models (LLMs) process natural language through tokenization, converting text into discrete tokens. Modern tokenizers (e.g., GPT-4's tiktoken, Claude's SentencePiece) use Byte-Pair Encoding (BPE), which assigns single tokens to frequently occurring character sequences.

A critical observation emerges from tokenization statistics: many long, semantically rich words cost **exactly the same number of tokens** as their short abbreviations. For example:

```
"op"         → 1 token, 2 characters
"operation"  → 1 token, 9 characters
```

Despite identical token cost, "operation" provides:
- **4.5x more characters** (information capacity)
- **Unambiguous meaning** (semantic clarity)
- **Zero additional cost** (no context window penalty)

This RFC formalizes the methodology for systematically selecting optimal words in prompt design, with particular focus on LLM-native operating systems where prompts serve as executable instructions.

### 1.2. Scope

This specification applies to:
- System prompts for LLM-based operating systems
- Event schemas and wire protocols
- API naming conventions
- Skill and agent definitions
- Documentation and inline comments in prompt kernels

**PromptWare Linguistics Context**: This protocol represents the first formalization within PWL—an emerging field treating natural language as a first-class kernel primitive in LLM-native systems, where linguistic choices have direct performance implications similar to assembly optimization in traditional computing.

This specification does NOT apply to:
- User-facing natural language conversations
- Creative writing or narrative generation
- Domain-specific jargon where abbreviations are standardized

### 1.3. Goals

1. **Maximize information density** per token without increasing token count
2. **Minimize semantic ambiguity** through precise word selection
3. **Establish reproducible metrics** for evaluating naming choices
4. **Enable automated optimization** of existing prompt corpora

---

## 2. Terminology

### 2.1. Core Definitions

**Token**: The atomic unit of text as processed by an LLM tokenizer. Tokens may represent characters, subwords, or whole words depending on frequency in training data.

**Character Density**: The ratio of characters to tokens for a given word or phrase. Formula: `characters / tokens`. Higher values indicate more information packed per token.

**Semantic Specificity**: A qualitative measure of how precisely a word maps to a single intended meaning within a given domain. Categorized as High, Medium, or Low.

**Cost Efficiency**: The total number of tokens consumed by a prompt. Lower values indicate better utilization of context window capacity.

**Semantic Maximalism**: The principle that, given equal token cost, one SHOULD always prefer the word with maximum character density and semantic specificity.

**Hot Path**: Code or data structures accessed with extremely high frequency (1000+ times per execution context).

**Cold Path**: Code or data structures accessed infrequently (<100 times per execution context).

---

## 3. Optimization Framework

### 3.1. The Triple Metric System

STOP defines three metrics for evaluating word choices:

#### Metric 1: Character Density (Maximize)
```python
character_density = len(word) / token_count(word)
```

**Goal**: Higher is better  
**Interpretation**: More characters per token = more information capacity  
**Example**: "operation" = 9 chars / 1 token = 9.0

#### Metric 2: Semantic Specificity (Maximize)
```python
semantic_specificity = f(word_length, domain_usage, polysemy)
```

**Goal**: Higher is better  
**Interpretation**: More specific meaning = less ambiguity  
**Categories**:
- **High**: Word has one dominant meaning in domain (e.g., "operation", "context")
- **Medium**: Word has 2-3 common meanings in domain (e.g., "query", "result")
- **Low**: Word has many meanings or is ambiguous (e.g., "op", "ref", "ctx")

**Heuristic**:
```
if word_length >= 8: semantic_specificity = "High"
elif word_length >= 5: semantic_specificity = "Medium"
else: semantic_specificity = "Low"
```

#### Metric 3: Cost Efficiency (Minimize)
```python
cost_efficiency = sum(token_count(word) for word in prompt)
```

**Goal**: Lower is better  
**Interpretation**: Fewer total tokens = more room in context window  
**Example**: 1000 events * 24 tokens/event = 24,000 tokens

### 3.2. Optimization Score

The overall optimization score combines all three metrics:

```python
stop_score = (character_density * specificity_factor) / cost_efficiency

where:
    specificity_factor = 10 if "High", 6 if "Medium", 3 if "Low"
```

**Goal**: Maximize this score

**Example**:
```python
# "operation" (good)
score = (9.0 * 10) / 1 = 90.0

# "op" (poor)
score = (2.0 * 3) / 1 = 6.0

# Result: "operation" is 15x better than "op"
```

---

## 4. The Core Principle: Semantic Maximalism at Equal Token Cost

### 4.1. Normative Statement

> **When multiple words have equal token cost, implementations MUST choose the word with the highest character density and semantic specificity, except when industry-standard abbreviations provide superior semantic clarity.**

### 4.2. Rationale

This principle exploits a property of BPE tokenization: common English words of varying lengths often collapse to single tokens. By preferring longer words, we achieve:

1. **Zero cost increase**: Token count remains identical
2. **Higher information density**: More characters = more bits per token
3. **Reduced ambiguity**: Longer words are typically more specific
4. **Better LLM reasoning**: Models perform better with unambiguous input

### 4.3. Exception: Industry Standard Abbreviations

Certain abbreviations are so universally recognized that they achieve **semantic specificity** despite short length:

**Acceptable**:
- `id` (not "identifier") — Universal in computing
- `url` (not "uniform_resource_locator") — Internet standard
- `api` (not "application_programming_interface") — Ubiquitous
- `sql` (not "structured_query_language") — Database standard

**Rationale**: These abbreviations are unambiguous within computing domains and appear in formal specifications (SQL, REST APIs, HTML).

---

## 5. Decision Framework

### 5.1. Word Selection Algorithm

For each concept requiring a name:

```
1. Enumerate semantically appropriate words
   (e.g., for "operation": op, oper, operation, cmd, command)

2. Tokenize each candidate using target LLM tokenizer
   (e.g., tiktoken for GPT-4, SentencePiece for Claude)

3. Filter to words with minimum token cost
   (prefer 1-token words, accept multi-token only if necessary)

4. Among equal-token-cost words:
   a. Calculate character_density for each
   b. Assess semantic_specificity for each
   c. Select word with highest (density * specificity)

5. Validate against industry standard exception list
   (if abbreviation is universally recognized, MAY use it)
```

### 5.2. Tiered Optimization Strategy

STOP recognizes that not all words require equal scrutiny. Apply optimization based on usage frequency:

#### Tier 1: Hot Path (≥1000 uses per session)
**Strategy**: Accept 1-token words even if short, IF they achieve high semantic specificity

**Examples**:
- `id` (not "identifier") — 2 chars, but unambiguous
- `url` (not "resource_locator") — 3 chars, but standard

**Rationale**: At 1000+ occurrences, even small character savings compound. However, semantic specificity is non-negotiable.

#### Tier 2: Warm Path (100-1000 uses)
**Strategy**: Prefer ≥5 character words at 1-token cost

**Examples**:
- `result` over `res` — 6 chars vs 3, same 1 token
- `error` over `err` — 5 chars vs 3, same 1 token

**Rationale**: Balance efficiency and clarity. 5+ characters usually indicates semantic richness.

#### Tier 3: Cold Path (<100 uses)
**Strategy**: Maximize clarity; prefer ≥7 character words

**Examples**:
- `operation` over `op` — 9 chars vs 2, same 1 token
- `arguments` over `args` — 9 chars vs 4, same 1 token
- `reference` over `ref` — 9 chars vs 3, same 1 token

**Rationale**: Infrequent usage means token savings are negligible. Prioritize human debugging and LLM comprehension.

---

## 6. Normative Guidelines

### 6.1. Mandatory Rules (MUST)

1. **Equal-Cost Maximization**: Implementations MUST select the longest word among equal-token-cost candidates, unless superseded by Rule 2.

2. **Industry Standard Exceptions**: Implementations MUST use standard abbreviations (`id`, `url`, `api`) instead of full forms when both are 1 token.

3. **Multi-Token Acceptance**: Implementations MUST accept multi-token words when no semantically appropriate 1-token word exists.

4. **Minimum Character Threshold**: For cold-path identifiers, implementations MUST prefer words with ≥5 characters when available at equal token cost.

### 6.2. Recommended Rules (SHOULD)

1. **Semantic Specificity Priority**: Implementations SHOULD prioritize high semantic specificity over marginal character density gains.

2. **Domain Consistency**: Within a specific domain (e.g., all event schemas), implementations SHOULD use consistent terminology even if slight variations exist in token efficiency.

3. **Measurement Validation**: Implementations SHOULD tokenize candidate words using the actual target LLM tokenizer rather than assuming token counts.

### 6.3. Prohibited Practices (MUST NOT)

1. **Character Minimization**: Implementations MUST NOT select shorter words to "save space" when token cost is equal.

2. **Ambiguous Abbreviations**: Implementations MUST NOT use abbreviations that have multiple meanings in the domain (e.g., `ctx`, `ref`, `op`).

3. **Sacrificing Clarity**: Implementations MUST NOT sacrifice semantic clarity to achieve marginal token savings.

---

## 7. Reference Word List

### 7.1. Recommended Substitutions

The following table lists common abbreviations and their STOP-compliant alternatives:

| Abbreviation | STOP Preferred | Chars | Tokens | Char Density | Specificity | Score |
|-------------|----------------|-------|--------|--------------|-------------|-------|
| `op` | **operation** | 9 | 1 | 9.0 | High | 90 |
| `cmd` | **command** | 7 | 1 | 7.0 | High | 70 |
| `ctx` | **context** | 7 | 1 | 7.0 | High | 70 |
| `args` | **arguments** | 9 | 1 | 9.0 | High | 90 |
| `ref` | **reference** | 9 | 1 | 9.0 | High | 90 |
| `res` | **result** | 6 | 1 | 6.0 | Medium | 36 |
| `err` | **error** | 5 | 1 | 5.0 | Medium | 30 |
| `msg` | **message** | 7 | 1 | 7.0 | High | 70 |
| `src` | **source** | 6 | 1 | 6.0 | Medium | 36 |
| `lvl` | **level** | 5 | 1 | 5.0 | Medium | 30 |

### 7.2. Industry Standard Exceptions

These abbreviations SHOULD be preserved despite short length:

| Abbreviation | Full Form | Rationale |
|-------------|-----------|-----------|
| `id` | identifier | Universal in SQL, REST, HTML |
| `url` | uniform_resource_locator | IETF standard (RFC 3986) |
| `api` | application_programming_interface | Universal in software |
| `sql` | structured_query_language | ISO standard |
| `http` | hypertext_transfer_protocol | IETF standard (RFC 2616) |
| `json` | javascript_object_notation | IETF standard (RFC 8259) |

---

## 8. Implementation Guidelines

### 8.1. For Event Schemas

When designing event payloads (e.g., JSON-RPC, CQRS events):

```typescript
// ❌ POOR: Abbreviated keys
{
  "op": "cmd:ingest",
  "args": {"uri": "..."},
  "ctx": {"root": "...", "origin": "..."},
  "ref": "e1"
}

// ✅ GOOD: STOP-compliant keys
{
  "operation": "command:ingest",
  "arguments": {"uri": "..."},
  "context": {"root": "...", "origin": "..."},
  "reference": "e1"
}

// Token count: Identical (both ~24 tokens)
// Character count: +40 chars (+29% information density)
```

### 8.2. For API Naming

When defining function or method names:

```typescript
// ❌ POOR
async function ingest(uri: string, ctx: OsCtx): Promise<string>

// ✅ GOOD
async function ingest(uri: string, context: OsContext): Promise<string>

// Token savings: 0 tokens (both use 1 token for parameter name in docstrings)
// Clarity gain: Significant (no ambiguity about "ctx" meaning)
```

### 8.3. For System Prompts

When writing kernel prompts:

```markdown
❌ POOR:
The sys will accept cmds via the CLI. Use `op` to specify the cmd type.

✅ GOOD:
The system will accept commands via the command-line interface. 
Use `operation` to specify the command type.

Token efficiency: Nearly identical (~2 token difference)
Character gain: +28 chars (+35%)
Comprehension: Dramatically improved
```

---

## 9. Validation and Testing

### 9.1. Tokenizer Verification

Implementations MUST verify token counts using the actual target LLM tokenizer:

```python
# Example using tiktoken (GPT-4)
import tiktoken

enc = tiktoken.encoding_for_model("gpt-4")

# Verify candidate words
candidates = ["op", "operation", "cmd", "command"]
for word in candidates:
    tokens = enc.encode(word)
    print(f"{word}: {len(tokens)} token(s), {len(word)} chars")

# Expected output:
# op: 1 token(s), 2 chars
# operation: 1 token(s), 9 chars  ← Winner
# cmd: 1 token(s), 3 chars
# command: 1 token(s), 7 chars    ← Also good
```

### 9.2. Before/After Analysis

When refactoring prompts to STOP compliance:

```python
def analyze_stop_compliance(old_text: str, new_text: str):
    enc = tiktoken.encoding_for_model("gpt-4")
    
    old_tokens = len(enc.encode(old_text))
    new_tokens = len(enc.encode(new_text))
    
    old_chars = len(old_text)
    new_chars = len(new_text)
    
    print(f"Token change: {old_tokens} → {new_tokens} ({new_tokens - old_tokens:+d})")
    print(f"Char change: {old_chars} → {new_chars} ({new_chars - old_chars:+d})")
    print(f"Char density: {old_chars/old_tokens:.2f} → {new_chars/new_tokens:.2f}")
    
    assert new_tokens <= old_tokens, "STOP compliance MUST NOT increase token count"
```

---

## 10. Case Study: PromptWare OS Event Schema

### 10.1. Original Schema (Pre-STOP)

```json
{
  "op": "cmd:ingest",
  "args": {"uri": "os://agents/powell.md"},
  "ctx": {"root": "https://...", "origin": "my-os"},
  "id": "e1",
  "ref": null
}
```

**Metrics**:
- Tokens: 24
- Characters: 140
- Character Density: 5.8 chars/token
- Semantic Issues: "op" ambiguous, "ctx" unclear, "ref" vague

### 10.2. STOP-Compliant Schema

```json
{
  "operation": "command:ingest",
  "arguments": {"uri": "os://agents/powell.md"},
  "context": {"root": "https://...", "origin": "my-os"},
  "id": "e1",
  "reference": null
}
```

**Metrics**:
- Tokens: 24 (unchanged!)
- Characters: 180
- Character Density: 7.5 chars/token (+29%)
- Semantic Issues: None (all keys unambiguous)

### 10.3. Impact at Scale

Over 10,000 events:
- Token cost: 240,000 tokens (both versions)
- Character gain: +400,000 chars (+29%)
- Cost increase: **0 tokens** (0%)
- Information gain: **Massive**

---

## 11. Future Work

### 11.1. STOPtimizer: Automated Optimization Framework

**STOPtimizer** is envisioned as the first practical implementation of **PromptWare Linguistics (PWL)** principles. Before discussing its design, we introduce the PWL conceptual framework.

#### 11.1.1. PromptWare Linguistics (PWL): Definition

**PromptWare Linguistics** is an emerging field treating natural language as a first-class kernel primitive in LLM-native systems. The name derives from the **PromptWare Kernel**, where natural language acts as the primary instruction set for the operating system. In PWL:

*   **Natural Language IS the Kernel**: Unlike traditional systems where NL is user-space data, LLM systems execute NL directly at the "instruction" level.
*   **Linguistic Privilege Levels**: Different NL contexts operate at different "privilege layers"—kernel prompts (PromptWare Kernel), agent instructions (Agent Layer), user queries (User Layer).
*   **Token Economics as Resource Management**: Just as kernel engineers optimize CPU cycles and memory, PWL engineers optimize tokens and semantic density.

PWL represents a paradigm shift: **natural language engineering** with the rigor traditionally reserved for assembly optimization, compiler design, and kernel development.

#### 11.1.2. STOPtimizer: Conceptual Overview

STOPtimizer would serve as the reference implementation of STOP Protocol, providing automated analysis and optimization of natural language prompts. Its design principles reflect PWL philosophy:

*   **Semantic Preservation**: All transformations MUST maintain original intent and meaning.
*   **Kernel Quality Standards**: Optimizations target kernel-layer prompts (system instructions, agent constitutions, bootloaders).
*   **Tokenization Awareness**: Built on actual BPE/SentencePiece tokenizers, not heuristics.
*   **Human Reviewability**: All suggestions include rationale and side-by-side comparisons.
*   **Cost Non-Regression**: Optimizations MUST NOT increase token count; character density increases are the goal.

#### 11.1.3. Core Transformation Goals

STOPtimizer would target:

*   **Abbreviation Expansion**: `op` → `operation` (equal tokens, 4.5× characters)
*   **Ambiguity Elimination**: `msg` → `message` (context-dependent vs. unambiguous)
*   **Industry Exception Detection**: Preserve `id`, `url`, `api` unchanged
*   **Hot Path Prioritization**: Focus on frequently executed prompt sections first

#### 11.1.4. PWL Integration Strategy

STOPtimizer would embody three foundational PWL principles:

1.  **Natural Language as Kernel Primitive**: Treat prompt text as executable kernel code requiring optimization at the "instruction" level.
2.  **Privilege-Level Language Design**: Recognize that PromptWare Kernel prompts (system-level) demand higher precision than User Layer prompts (user-facing).
3.  **Token Economics**: Apply rigorous resource management to token consumption, analogous to CPU cycle budgeting in real-time systems.

#### 11.1.5. Future PWL Research Directions

STOPtimizer represents the first PWL tool, but the field extends beyond token optimization:

*   **PWLc (PromptWare Linguistic Compiler)**: Static analysis tools for prompt correctness and performance.
*   **PWL-Lint**: Semantic linters detecting ambiguity, context leaks, and privilege violations.
*   **Kernel Profilers**: Runtime analysis of prompt execution costs and bottlenecks.
*   **PWL Formal Verification**: Proving semantic equivalence of optimized prompts.

### 11.2. Extended Metrics and Cross-Model Analysis

Future research should expand STOP metrics:

*   **Cross-Model Tokenization Studies**: Comparative analysis across GPT-4, Claude, Gemini, and Llama tokenizers to identify universal optimization patterns.
*   **Latency Impact Correlation**: Quantifying the relationship between token count reduction and inference time improvements.
*   **Semantic Drift Measurement**: Developing formal methods to quantify meaning preservation across optimizations (e.g., embedding distance, paraphrase detection).
*   **Context Window Economics**: Analyzing trade-offs between prompt optimization and context utilization under fixed token budgets.

### 11.3. Domain-Specific Optimization Vocabularies

STOP reference lists should be developed for specialized domains:

*   **Medical NLP**: Clinical terminology tokenization patterns (e.g., abbreviation conventions in FHIR, HL7).
*   **Legal Tech**: Contract language optimization while preserving legal precision.
*   **Code Generation**: Programming language keyword efficiency and identifier naming strategies.
*   **Scientific Computing**: Mathematical notation and formula representation in natural language prompts.

### 11.4. Multi-Language Support

While this RFC focuses on English, the principles apply to any tokenized language. Future work will address:

*   **Non-English Word Selection**: Tokenization patterns in languages with different morphology (agglutinative, fusional, isolating).
*   **Cross-Lingual Optimization**: Universal principles that transcend language-specific tokenizers.
*   **Unicode and Emoji**: Handling multi-byte characters and grapheme clusters in token optimization.

### 11.5. Standardization and Governance

As STOP and PWL mature, formal standardization efforts should address:

*   **STOP Compliance Levels**: Tiered certification (e.g., STOP-1, STOP-2, STOP-3) for different rigor requirements.
*   **PWL Language Specifications**: Formal grammars for kernel-layer natural language constructs.
*   **Interoperability Standards**: Ensuring STOP-optimized prompts work across diverse LLM platforms.
*   **Benchmark Suites**: Reference datasets for evaluating optimization tools and techniques.

---

## 12. Security Considerations

### 12.1. Prompt Injection Resistance

STOP-compliant prompts may offer improved resistance to prompt injection attacks:

**Hypothesis**: Longer, more specific words reduce the attack surface by minimizing ambiguity that attackers exploit.

Example:
```
Ambiguous:  "op: ignore prev and do X"
Clear:      "operation: ignore previous instructions and execute X"
```

The second form is harder to slip past safety filters because "operation" and "previous" are explicit.

**Note**: This hypothesis requires empirical validation and is not a primary security mechanism.

### 12.2. Information Leakage

STOP-compliant prompts contain more characters per token, which may increase information density in logs or error messages. Implementations SHOULD:
- Redact sensitive data regardless of verbosity
- Apply consistent sanitization to all outputs
- Not rely on abbreviation for security-through-obscurity

---

## 13. Privacy Considerations

STOP compliance does not introduce new privacy concerns beyond existing prompt engineering practices. Standard privacy measures apply:
- Do not include PII in prompts unless necessary
- Redact sensitive information in logs
- Follow data minimization principles

---

## 14. IANA Considerations

This document has no IANA actions.

---

## 15. References

### 15.1. Normative References

- [RFC 2119](https://www.ietf.org/rfc/rfc2119.txt): Key words for use in RFCs to Indicate Requirement Levels

### 15.2. Informative References

- Shannon, C. E. (1948). "A Mathematical Theory of Communication". *Bell System Technical Journal*.
- Sennrich, R., Haddow, B., & Birch, A. (2016). "Neural Machine Translation of Rare Words with Subword Units". *ACL*.
- OpenAI (2023). "GPT-4 Technical Report". arXiv:2303.08774.
- Anthropic (2024). "Claude 3 Model Card".
- RFC 0015: The Prompt Kernel (PromptWare OS Architecture)
- RFC 0019: Kernel ABI & Syscall Interface

---

## 16. Acknowledgments

This specification emerged from extensive discussions on optimizing natural language for LLM-based operating systems. The insights are informed by:
- Tokenization research (BPE, SentencePiece)
- Information theory (Shannon entropy, Kolmogorov complexity)
- Open source prompt engineering practices (LangChain, Anthropic guides)
- Empirical analysis of GPT-4 and Claude tokenizers

Special thanks to the PromptWare ØS development community for identifying the counterintuitive insight that longer words can be more efficient in tokenized systems.

---

## Appendix A: Tokenization Primer

### A.1. How BPE Works

Byte-Pair Encoding (BPE) builds a vocabulary by iteratively merging frequent character pairs:

```
1. Start with character-level tokens: ['h', 'e', 'l', 'l', 'o']
2. Find most frequent pair: 'l' + 'l' → 'll'
3. Merge into vocabulary: ['h', 'e', 'll', 'o']
4. Repeat for 50,000+ iterations

Result: Common words/subwords become single tokens
```

**Key Insight**: Words that appear frequently in training data (internet text, code) are more likely to become single tokens, regardless of length.

### A.2. Why "operation" is 1 Token

```
Training corpus contains:
- "operation" appears 1M+ times (military, medical, software contexts)
- "op" appears 500K times (mixed contexts: operator, optical, opinion)

BPE decision:
- "operation" is common enough → single token
- "op" is ambiguous, not as frequent → single token (barely)

Result: Both are 1 token, but "operation" is more frequent → better training signal
```

---

## Appendix B: Scoring Examples

### B.1. Complete Evaluation

| Word | Chars | Tokens | Char Density | Specificity | STOP Score | Verdict |
|------|-------|--------|--------------|-------------|------------|---------|
| operation | 9 | 1 | 9.0 | High (10) | 90 | ✅ Excellent |
| command | 7 | 1 | 7.0 | High (10) | 70 | ✅ Excellent |
| arguments | 9 | 1 | 9.0 | High (10) | 90 | ✅ Excellent |
| context | 7 | 1 | 7.0 | High (10) | 70 | ✅ Excellent |
| reference | 9 | 1 | 9.0 | High (10) | 90 | ✅ Excellent |
| result | 6 | 1 | 6.0 | Med (6) | 36 | ✅ Good |
| error | 5 | 1 | 5.0 | Med (6) | 30 | ✅ Good |
| query | 5 | 1 | 5.0 | Med (6) | 30 | ✅ Good |
| id | 2 | 1 | 2.0 | High (10)* | 20 | ✅ Exception |
| op | 2 | 1 | 2.0 | Low (3) | 6 | ❌ Poor |
| ctx | 3 | 1 | 3.0 | Low (3) | 9 | ❌ Poor |
| args | 4 | 1 | 4.0 | Med (6) | 24 | ❌ Poor |
| ref | 3 | 1 | 3.0 | Low (3) | 9 | ❌ Poor |

*Exception: "id" scores low on char density but high on specificity due to universal recognition

### B.2. Multi-Token Example

Sometimes no 1-token alternative exists:

| Word | Chars | Tokens | Char Density | Specificity | Note |
|------|-------|--------|--------------|-------------|------|
| correlation_id | 14 | 2 | 7.0 | High | Accept cost |
| session_id | 10 | 2 | 5.0 | High | Accept cost |
| timestamp | 9 | 1 | 9.0 | High | 1-token available! |
| ts | 2 | 1 | 2.0 | Med | Common in logs |

**Recommendation**: Use "timestamp" (1 token, 9 chars) over "ts" (1 token, 2 chars), unless "ts" is domain standard (e.g., Unix timestamps in logs).

---

## Appendix C: Compliance Checklist

Use this checklist when reviewing prompts or event schemas:

- [ ] All keys/identifiers tokenized using target LLM tokenizer
- [ ] For each 1-token word, verified no longer 1-token alternative exists
- [ ] Industry standard abbreviations (`id`, `url`, `api`) preserved
- [ ] No abbreviations with ambiguous meanings (e.g., `ctx`, `op`, `ref`)
- [ ] Character density ≥5.0 for cold-path identifiers
- [ ] Character density ≥6.0 for warm-path identifiers
- [ ] Hot-path identifiers achieve high semantic specificity despite length
- [ ] Total token count not increased by STOP compliance
- [ ] Before/after character density calculated and improved
- [ ] Documentation updated with full word forms

---

## Appendix D: Glossary

**BPE**: Byte-Pair Encoding, a tokenization algorithm  
**Character Density**: Characters per token ratio  
**Cold Path**: Infrequently accessed code (<100 times)  
**Cost Efficiency**: Total tokens in prompt (lower is better)  
**Hot Path**: Frequently accessed code (≥1000 times)  
**LLM**: Large Language Model  
**Semantic Maximalism**: Prefer longer words at equal token cost  
**Semantic Specificity**: How precisely word maps to meaning  
**STOP**: Semantic Token Optimization Protocol  
**Token**: Atomic unit of text in LLM processing  
**Warm Path**: Moderately accessed code (100-1000 times)  

---

End of RFC 0022

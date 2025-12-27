/**
 * PromptWar̊e ØS Skill: StopTimizer Dependencies
 * Precision token counting using official tokenization algorithms
 */

// gpt-tokenizer: Pure JS implementation (no WASM) supporting all GPT models
// Import encoding-specific tokenizers to ensure correct tokenization per model
import { encode as encodeO200k } from "https://esm.sh/gpt-tokenizer@2.8.0/encoding/o200k_base";
import { encode as encodeCl100k } from "https://esm.sh/gpt-tokenizer@2.8.0/encoding/cl100k_base";

/**
 * Count GPT tokens using the correct encoding for the specified model
 * 
 * Encoding mapping:
 * - o200k_base: GPT-5 family, GPT-4o, GPT-4.1, o-series (o1, o3, o4)
 * - cl100k_base: GPT-4, GPT-3.5-turbo
 */
export function countGPTTokens(text: string, model: string): number {
  // GPT-5 family and GPT-4o use o200k_base encoding
  if (model.startsWith('gpt-5') || model === 'gpt-4o' || model === 'gpt-4.1') {
    return encodeO200k(text).length;
  }
  
  // GPT-4 and GPT-3.5 use cl100k_base encoding
  if (model.startsWith('gpt-4') || model.startsWith('gpt-3.5')) {
    return encodeCl100k(text).length;
  }
  
  throw new Error(`Unknown GPT model: ${model}`);
}

// Claude Tokenization using @anthropic-ai/tokenizer
// Fallback to approximation if library unavailable
let claudeCounter: ((text: string) => number) | null = null;

try {
  const { countTokens } = await import("https://esm.sh/@anthropic-ai/tokenizer@0.0.4");
  claudeCounter = countTokens;
} catch {
  // Fallback: Official approximation from Anthropic docs
  // https://docs.anthropic.com/claude/docs/models-overview
  claudeCounter = (text: string) => Math.ceil(text.length / 3.5);
}

export async function countClaudeTokens(text: string): Promise<number> {
  if (!claudeCounter) {
    // Anthropic official approximation: ~3.5 chars per token
    return Math.ceil(text.length / 3.5);
  }
  return claudeCounter(text);
}

// Gemini SentencePiece tokenizer (TODO: Research in progress)
export async function countGeminiTokens(_text: string): Promise<number> {
  throw new Error(
    "Gemini tokenizer: Research in progress. Use Vertex AI API for token counting:\n" +
    "https://cloud.google.com/vertex-ai/docs/generative-ai/model-reference/count-tokens"
  );
}


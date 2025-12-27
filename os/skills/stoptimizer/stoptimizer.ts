#!/usr/bin/env -S deno run --allow-net
/**
 * PromptWar̊e ØS Skill: StopTimizer
 * Precise token counter for GPT, Claude, and Gemini models
 * 
 * Philosophy: Unix tool - count tokens only, no validation logic
 * Output: Raw token counts (source of truth from software kernel)
 */

import { parseArgs } from "jsr:@std/cli/parse-args";
import { countGPTTokens, countClaudeTokens, countGeminiTokens } from "./deps.ts";

const DESCRIPTION = `StopTimizer - Precise token counter for LLM models.

Counts tokens using official tokenizers (gpt-tokenizer, Anthropic tokenizer) as source of truth from software kernel. Returns raw token counts without judgment.

Usage:
  deno run --allow-net <url> "text"              # Argument mode
  deno run --allow-net <url> -                   # stdin mode (-)
  deno run --allow-net <url> --stdin             # stdin mode (long form)
  deno run --allow-net <url> --json "text"       # JSON output
  deno run --allow-net <url> --model <name> "text"  # Single model

Models: gpt-5, gpt-5.2, gpt-5-mini, gpt-4o, gpt-4, gpt-3.5, claude-3.5-sonnet, gemini-2.0-flash

Output: Space-separated integers or JSON object
Exit: 0=success, 2=error

stdin support: Use '-' or --stdin to read from pipes/redirects (Unix convention)
First run downloads ~500 KB vocabularies (cached in ~/.cache/deno/)`;

const HELP_TEXT = `StopTimizer - Precise Token Counter

Usage: deno run --allow-net stoptimizer.ts [OPTIONS] <text>
       deno run --allow-net stoptimizer.ts [OPTIONS] -
       deno run --allow-net stoptimizer.ts [OPTIONS] --stdin

Arguments:
  <text>          Text to count tokens for
  -               Read text from stdin (Unix convention)

Options:
  --description   Show tool description (RFC 0012 Section 3.6)
  --help, -h      Show this help message
  --json          Output as JSON object
  --model <name>  Count for specific model only
  --stdin         Read text from stdin (alternative to -)

Available Models:
  gpt-5           GPT-5 (o200k_base encoding)
  gpt-5.2         GPT-5.2 (o200k_base encoding)
  gpt-5-mini      GPT-5 mini (o200k_base encoding)
  gpt-4o          GPT-4o (o200k_base encoding)
  gpt-4           GPT-4 (cl100k_base encoding)
  gpt-3.5         GPT-3.5 Turbo (cl100k_base encoding)
  claude-3.5-sonnet  Claude 3.5 Sonnet
  gemini-2.0-flash   Gemini 2.0 Flash (research in progress)

Output:
  Default: Space-separated token counts (e.g., "2 2 2")
  --json:  JSON object (e.g., {"gpt-4o":2,"claude-3.5":2})
  --model: Single integer

Exit Codes:
  0  Success
  2  Tokenizer error (network, unavailable, etc.)

Examples:
  # Argument mode (small text)
  deno run --allow-net stoptimizer.ts "hello world"

  # stdin mode (large files)
  cat KERNEL.md | deno run --allow-net stoptimizer.ts -
  deno run --allow-net stoptimizer.ts --stdin < large-file.txt

  # JSON output from stdin
  cat prompt.txt | deno run --allow-net stoptimizer.ts - --json

  # Single model from pipe
  echo "test" | deno run --allow-net stoptimizer.ts - --model gpt-4o

  # STOP Protocol validation (compose in shell)
  OLD=$(echo "args" | deno run --allow-net stoptimizer.ts - --model gpt-4o)
  NEW=$(echo "arguments" | deno run --allow-net stoptimizer.ts - --model gpt-4o)
  [ "$OLD" -eq "$NEW" ] && echo "✅ STOP COMPLIANT"
`;

async function readStdin(): Promise<string> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of Deno.stdin.readable) {
    chunks.push(chunk);
  }
  const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const combined = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.length;
  }
  return new TextDecoder().decode(combined);
}

async function main() {
  const args = parseArgs(Deno.args, {
    string: ["model"],
    boolean: ["description", "help", "json", "stdin"],
    alias: { help: "h" },
  });

  // RFC 0012 Section 3.6: --description flag (≤1024 chars)
  if (args.description) {
    console.log(DESCRIPTION);
    Deno.exit(0);
  }

  if (args.help) {
    console.log(HELP_TEXT);
    Deno.exit(0);
  }

  const firstArg = args._[0]?.toString();
  const useStdin = firstArg === '-' || args.stdin === true;

  if (!firstArg && !args.stdin) {
    console.error("Error: Missing <text> argument");
    console.error("Usage: stoptimizer.ts <text> | stoptimizer.ts - | stoptimizer.ts --stdin");
    Deno.exit(2);
  }

  const text = useStdin ? await readStdin() : firstArg!;

  if (!text || text.trim().length === 0) {
    console.error("Error: Input is empty");
    Deno.exit(2);
  }

  try {
    const results: Record<string, number> = {};

    // Count tokens for all models (default: GPT-5, GPT-4o, GPT-4, GPT-3.5, Claude)
    if (!args.model || args.model === "gpt-5") {
      results["gpt-5"] = countGPTTokens(text, "gpt-5");
    }
    if (!args.model || args.model === "gpt-5.2") {
      results["gpt-5.2"] = countGPTTokens(text, "gpt-5.2");
    }
    if (!args.model || args.model === "gpt-5-mini") {
      results["gpt-5-mini"] = countGPTTokens(text, "gpt-5-mini");
    }
    if (!args.model || args.model === "gpt-4o") {
      results["gpt-4o"] = countGPTTokens(text, "gpt-4o");
    }
    if (!args.model || args.model === "gpt-4") {
      results["gpt-4"] = countGPTTokens(text, "gpt-4");
    }
    if (!args.model || args.model === "gpt-3.5") {
      results["gpt-3.5"] = countGPTTokens(text, "gpt-3.5");
    }
    if (!args.model || args.model === "claude-3.5-sonnet") {
      results["claude-3.5-sonnet"] = await countClaudeTokens(text);
    }
    if (args.model === "gemini-2.0-flash") {
      // Only count Gemini if explicitly requested
      results["gemini-2.0-flash"] = await countGeminiTokens(text);
    }

    // Output
    if (args.json) {
      console.log(JSON.stringify(results));
    } else if (args.model) {
      const count = results[args.model];
      if (count === undefined) {
        console.error(`Error: Unknown model "${args.model}"`);
        Deno.exit(2);
      }
      console.log(count);
    } else {
      // Space-separated counts (default)
      console.log(Object.values(results).join(" "));
    }

    Deno.exit(0);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    Deno.exit(2);
  }
}

if (import.meta.main) {
  main();
}

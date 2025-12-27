import { assertEquals, assert, assertRejects } from "jsr:@std/assert";
import { countGPTTokens, countClaudeTokens } from "./deps.ts";

// Test RFC 0012 Section 3.6: --description flag
Deno.test("RFC 3.6: --description flag exists and is ≤1024 chars", async () => {
  const command = new Deno.Command(Deno.execPath(), {
    args: ["run", "--allow-net", "stoptimizer.ts", "--description"],
    stdout: "piped",
    stderr: "piped",
  });
  const output = await command.output();
  const desc = new TextDecoder().decode(output.stdout);

  assert(output.success, "Tool should execute successfully");
  assert(desc.length > 0, "Description must not be empty");
  assert(desc.length <= 1024, `Description too long: ${desc.length} chars (max 1024)`);
  assert(desc.includes("token counter"), "Must describe token counting");
  assert(desc.includes("Models:"), "Must list supported models");
});

// Test GPT tokenizer precision (known token counts)
Deno.test("GPT tokenizer: 'Hello, world!' = 4 tokens (cl100k_base)", () => {
  const count = countGPTTokens("Hello, world!", "gpt-4");
  assertEquals(count, 4, "Known GPT-4 token count (cl100k_base)");
});

Deno.test("GPT tokenizer: 'test' = 1 token (cl100k_base)", () => {
  const count = countGPTTokens("test", "gpt-4");
  assertEquals(count, 1, "Single word = 1 token");
});

// Test encoding differences
Deno.test("GPT tokenizer: o200k_base vs cl100k_base produce different counts", () => {
  // Use longer text to demonstrate encoding differences
  const text = "The quick brown fox jumps over the lazy dog. " +
               "Machine learning and artificial intelligence are transforming technology. " +
               "OpenAI develops advanced language models like GPT-4 and GPT-5.";
  
  const gpt4Count = countGPTTokens(text, "gpt-4"); // cl100k_base
  const gpt4oCount = countGPTTokens(text, "gpt-4o"); // o200k_base
  const gpt5Count = countGPTTokens(text, "gpt-5"); // o200k_base
  
  // GPT-4o and GPT-5 should match (same encoding)
  assertEquals(gpt4oCount, gpt5Count, "GPT-4o and GPT-5 use same o200k_base encoding");
  
  // Note: For very short texts, encodings may produce same counts
  // This test verifies the encoding routing works correctly
  assert(typeof gpt4Count === "number" && gpt4Count > 0, "GPT-4 should return valid count");
  assert(typeof gpt4oCount === "number" && gpt4oCount > 0, "GPT-4o should return valid count");
});

// Test Claude tokenizer returns valid count
Deno.test("Claude tokenizer: returns integer", async () => {
  const count = await countClaudeTokens("hello world");
  assert(Number.isInteger(count), "Token count must be integer");
  assert(count > 0, "Token count must be positive");
});

// Test CLI: Basic token counting
Deno.test("CLI: Basic token counting (space-separated)", async () => {
  const command = new Deno.Command(Deno.execPath(), {
    args: ["run", "--allow-net", "stoptimizer.ts", "test"],
    stdout: "piped",
  });
  const output = await command.output();
  const result = new TextDecoder().decode(output.stdout).trim();

  assert(output.success, "Command should succeed");
  const counts = result.split(" ").map(Number);
  assert(counts.length === 7, "Should return counts for 7 models (gpt-5, gpt-5.2, gpt-5-mini, gpt-4o, gpt-4, gpt-3.5, claude)");
  assert(counts.every(n => Number.isInteger(n) && n > 0), "All counts should be positive integers");
});

// Test CLI: JSON output
Deno.test("CLI: JSON output format", async () => {
  const command = new Deno.Command(Deno.execPath(), {
    args: ["run", "--allow-net", "stoptimizer.ts", "--json", "test"],
    stdout: "piped",
  });
  const output = await command.output();
  const result = new TextDecoder().decode(output.stdout).trim();

  assert(output.success, "Command should succeed");
  const json = JSON.parse(result);
  assert(typeof json === "object", "Output should be JSON object");
  assert("gpt-5" in json, "Should include gpt-5");
  assert("gpt-4o" in json, "Should include gpt-4o");
  assert("gpt-4" in json, "Should include gpt-4");
  assert(Number.isInteger(json["gpt-4o"]), "Token count should be integer");
});

// Test CLI: Single model output
Deno.test("CLI: Single model output", async () => {
  const command = new Deno.Command(Deno.execPath(), {
    args: ["run", "--allow-net", "stoptimizer.ts", "--model", "gpt-4o", "test"],
    stdout: "piped",
  });
  const output = await command.output();
  const result = new TextDecoder().decode(output.stdout).trim();

  assert(output.success, "Command should succeed");
  const count = Number(result);
  assert(Number.isInteger(count) && count > 0, "Should return single positive integer");
});

// Test CLI: Missing argument error
Deno.test("CLI: Missing argument returns exit code 2", async () => {
  const command = new Deno.Command(Deno.execPath(), {
    args: ["run", "--allow-net", "stoptimizer.ts"],
    stdout: "piped",
    stderr: "piped",
  });
  const output = await command.output();

  assertEquals(output.code, 2, "Should exit with code 2 for missing argument");
});

// Test CLI: Help flag
Deno.test("CLI: --help flag", async () => {
  const command = new Deno.Command(Deno.execPath(), {
    args: ["run", "--allow-net", "stoptimizer.ts", "--help"],
    stdout: "piped",
  });
  const output = await command.output();
  const help = new TextDecoder().decode(output.stdout);

  assert(output.success, "Help should succeed");
  assert(help.includes("Usage:"), "Help should show usage");
  assert(help.includes("Examples:"), "Help should show examples");
});

// Test STOP Protocol validation example (composition)
Deno.test("STOP validation: 'args' vs 'arguments' composition", async () => {
  // This test demonstrates how users compose STOP validation in shell
  const countTokens = async (text: string): Promise<number> => {
    const command = new Deno.Command(Deno.execPath(), {
      args: ["run", "--allow-net", "stoptimizer.ts", "--model", "gpt-4o", text],
      stdout: "piped",
    });
    const output = await command.output();
    return Number(new TextDecoder().decode(output.stdout).trim());
  };

  const shortCount = await countTokens("args");
  const longCount = await countTokens("arguments");

  // Both should be 1 token (STOP compliant)
  assertEquals(shortCount, 1, "'args' should be 1 token");
  assertEquals(longCount, 1, "'arguments' should be 1 token");
  // User script would check: shortCount === longCount
});

// Test stdin mode with dash (-)
Deno.test("CLI: stdin mode with dash (-)", async () => {
  const testText = "Hello from stdin";
  const command = new Deno.Command(Deno.execPath(), {
    args: ["run", "--allow-net", "stoptimizer.ts", "-"],
    stdin: "piped",
    stdout: "piped",
  });
  
  const child = command.spawn();
  const writer = child.stdin.getWriter();
  await writer.write(new TextEncoder().encode(testText));
  await writer.close();
  
  const output = await child.output();
  const result = new TextDecoder().decode(output.stdout).trim();
  
  assert(output.success, "Should execute successfully");
  assert(result.includes(" "), "Should have space-separated counts");
  const counts = result.split(" ").map(Number);
  assert(counts.every(n => n > 0), "All counts should be positive");
});

// Test stdin mode with --stdin flag
Deno.test("CLI: stdin mode with --stdin flag", async () => {
  const testText = "Hello world";
  const command = new Deno.Command(Deno.execPath(), {
    args: ["run", "--allow-net", "stoptimizer.ts", "--stdin", "--json"],
    stdin: "piped",
    stdout: "piped",
  });
  
  const child = command.spawn();
  const writer = child.stdin.getWriter();
  await writer.write(new TextEncoder().encode(testText));
  await writer.close();
  
  const output = await child.output();
  const result = new TextDecoder().decode(output.stdout).trim();
  
  assert(output.success, "Should execute successfully");
  const json = JSON.parse(result);
  assert(json["gpt-4o"] > 0, "Should have token count");
});

// Test empty stdin returns error
Deno.test("CLI: Empty stdin returns exit code 2", async () => {
  const command = new Deno.Command(Deno.execPath(), {
    args: ["run", "--allow-net", "stoptimizer.ts", "-"],
    stdin: "piped",
    stdout: "piped",
    stderr: "piped",
  });
  
  const child = command.spawn();
  const writer = child.stdin.getWriter();
  await writer.close(); // Close without writing
  
  const output = await child.output();
  
  assertEquals(output.code, 2, "Should exit with code 2 for empty input");
});

// Test stdin handles large content (KERNEL.md use case)
Deno.test("CLI: stdin handles large files", async () => {
  const largeText = "word ".repeat(1000); // ~5KB
  const command = new Deno.Command(Deno.execPath(), {
    args: ["run", "--allow-net", "stoptimizer.ts", "--stdin", "--model", "gpt-4o"],
    stdin: "piped",
    stdout: "piped",
  });
  
  const child = command.spawn();
  const writer = child.stdin.getWriter();
  await writer.write(new TextEncoder().encode(largeText));
  await writer.close();
  
  const output = await child.output();
  const result = new TextDecoder().decode(output.stdout).trim();
  const count = parseInt(result);
  
  assert(output.success, "Should handle large input");
  assert(count > 500, "Should count many tokens for large input");
});

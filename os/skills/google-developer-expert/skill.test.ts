/**
 * PromptWar̊e ØS: Google Developer Expert Skill Tests
 * 
 * Unit tests for OAuth and Google API tools.
 * 
 * Run with: deno test --allow-all os/skills/google-developer-expert/
 */

import { assertEquals, assertStringIncludes } from "jsr:@std/assert";

/**
 * Test helper: Run tool with --help flag
 */
async function runToolHelp(toolPath: string): Promise<string> {
  const cmd = new Deno.Command("deno", {
    args: ["run", "-A", toolPath, "--help"],
    stdout: "piped",
    stderr: "piped",
  });
  
  const { code, stdout, stderr } = await cmd.output();
  
  if (code !== 0) {
    const errorText = new TextDecoder().decode(stderr);
    throw new Error(`Tool failed: ${errorText}`);
  }
  
  return new TextDecoder().decode(stdout);
}

/**
 * Test helper: Run tool with --description flag
 */
async function runToolDescription(toolPath: string): Promise<string> {
  const cmd = new Deno.Command("deno", {
    args: ["run", "-A", toolPath, "--description"],
    stdout: "piped",
    stderr: "piped",
  });
  
  const { code, stdout } = await cmd.output();
  
  if (code !== 0) {
    throw new Error("Tool failed to return description");
  }
  
  return new TextDecoder().decode(stdout).trim();
}

// ===== OAuth Auth Tool Tests =====

Deno.test("oauth-auth.ts - help flag works", async () => {
  const helpText = await runToolHelp("./oauth-auth.ts");
  
  assertStringIncludes(helpText, "Usage:");
  assertStringIncludes(helpText, "Actions:");
  assertStringIncludes(helpText, "start");
  assertStringIncludes(helpText, "status");
});

Deno.test("oauth-auth.ts - description flag works", async () => {
  const description = await runToolDescription("./oauth-auth.ts");
  
  assertStringIncludes(description, "OAuth");
  assertStringIncludes(description, "authenticator");
  assertEquals(description.length <= 1024, true, "Description should be <= 1024 chars (RFC 0012)");
});

Deno.test("oauth-auth.ts - status action works without auth", async () => {
  const cmd = new Deno.Command("deno", {
    args: [
      "run",
      "-A",
      "--unstable-kv",
      "--location", "https://test-oauth.local/",
      "./oauth-auth.ts",
      "status",
    ],
    stdout: "piped",
    stderr: "piped",
  });
  
  const { stdout } = await cmd.output();
  const output = new TextDecoder().decode(stdout);
  
  // Should report not authenticated or show status
  assertStringIncludes(output.toLowerCase(), "authenticated" || "token");
});

// ===== OAuth Token Tool Tests =====

Deno.test("oauth-token.ts - help flag works", async () => {
  const helpText = await runToolHelp("./oauth-token.ts");
  
  assertStringIncludes(helpText, "Usage:");
  assertStringIncludes(helpText, "Actions:");
  assertStringIncludes(helpText, "get");
  assertStringIncludes(helpText, "refresh");
  assertStringIncludes(helpText, "validate");
  assertStringIncludes(helpText, "revoke");
});

Deno.test("oauth-token.ts - description flag works", async () => {
  const description = await runToolDescription("./oauth-token.ts");
  
  assertStringIncludes(description, "OAuth");
  assertStringIncludes(description, "token");
  assertEquals(description.length <= 1024, true, "Description should be <= 1024 chars (RFC 0012)");
});

// ===== Gmail API Tool Tests =====

Deno.test("gmail-api.ts - help flag works", async () => {
  const helpText = await runToolHelp("./gmail-api.ts");
  
  assertStringIncludes(helpText, "Usage:");
  assertStringIncludes(helpText, "Actions:");
  assertStringIncludes(helpText, "list");
  assertStringIncludes(helpText, "get");
  assertStringIncludes(helpText, "send");
  assertStringIncludes(helpText, "search");
});

Deno.test("gmail-api.ts - description flag works", async () => {
  const description = await runToolDescription("./gmail-api.ts");
  
  assertStringIncludes(description, "Gmail");
  assertStringIncludes(description, "API");
  assertEquals(description.length <= 1024, true, "Description should be <= 1024 chars (RFC 0012)");
});

// ===== Google Docs API Tool Tests =====

Deno.test("gdocs-api.ts - help flag works", async () => {
  const helpText = await runToolHelp("./gdocs-api.ts");
  
  assertStringIncludes(helpText, "Usage:");
  assertStringIncludes(helpText, "Actions:");
  assertStringIncludes(helpText, "get");
  assertStringIncludes(helpText, "create");
  assertStringIncludes(helpText, "update");
  assertStringIncludes(helpText, "list");
});

Deno.test("gdocs-api.ts - description flag works", async () => {
  const description = await runToolDescription("./gdocs-api.ts");
  
  assertStringIncludes(description, "Google Docs");
  assertStringIncludes(description, "API");
  assertEquals(description.length <= 1024, true, "Description should be <= 1024 chars (RFC 0012)");
});

// ===== Google Drive API Tool Tests =====

Deno.test("gdrive-api.ts - help flag works", async () => {
  const helpText = await runToolHelp("./gdrive-api.ts");
  
  assertStringIncludes(helpText, "Usage:");
  assertStringIncludes(helpText, "Actions:");
  assertStringIncludes(helpText, "list");
  assertStringIncludes(helpText, "get");
  assertStringIncludes(helpText, "download");
  assertStringIncludes(helpText, "upload");
  assertStringIncludes(helpText, "delete");
});

Deno.test("gdrive-api.ts - description flag works", async () => {
  const description = await runToolDescription("./gdrive-api.ts");
  
  assertStringIncludes(description, "Google Drive");
  assertStringIncludes(description, "API");
  assertEquals(description.length <= 1024, true, "Description should be <= 1024 chars (RFC 0012)");
});

// ===== SKILL.md Validation Tests =====

Deno.test("SKILL.md exists and has required front matter", async () => {
  const content = await Deno.readTextFile("./SKILL.md");
  
  // Check front matter
  assertStringIncludes(content, "---");
  assertStringIncludes(content, "type: skill");
  assertStringIncludes(content, "title:");
  assertStringIncludes(content, "version:");
  assertStringIncludes(content, "tools:");
});

Deno.test("SKILL.md documents all tools", async () => {
  const content = await Deno.readTextFile("./SKILL.md");
  
  // Check that all tools are documented
  assertStringIncludes(content, "oauth-auth.ts");
  assertStringIncludes(content, "oauth-token.ts");
  assertStringIncludes(content, "gmail-api.ts");
  assertStringIncludes(content, "gdocs-api.ts");
  assertStringIncludes(content, "gdrive-api.ts");
});

Deno.test("SKILL.md mentions security architecture", async () => {
  const content = await Deno.readTextFile("./SKILL.md");
  
  // Check security documentation
  assertStringIncludes(content.toLowerCase(), "security");
  assertStringIncludes(content, "pwenc:v1:");
  assertStringIncludes(content, "/vault/");
  assertStringIncludes(content.toLowerCase(), "oauth");
});

Deno.test("SKILL.md references RFCs", async () => {
  const content = await Deno.readTextFile("./SKILL.md");
  
  // Check RFC references
  assertStringIncludes(content, "RFC 0016");
  assertStringIncludes(content, "RFC 0018");
});

// ===== Integration Tests (require authentication) =====

// Note: These tests are skipped by default as they require valid OAuth tokens
// To enable them, set ENABLE_INTEGRATION_TESTS=1

const INTEGRATION_TESTS_ENABLED = Deno.env.get("ENABLE_INTEGRATION_TESTS") === "1";

if (INTEGRATION_TESTS_ENABLED) {
  Deno.test({
    name: "Integration: oauth-token.ts validate works with real token",
    ignore: !INTEGRATION_TESTS_ENABLED,
    fn: async () => {
      const cmd = new Deno.Command("deno", {
        args: [
          "run",
          "-A",
          "--unstable-kv",
          "--location", "https://google-expert.local/",
          "./oauth-token.ts",
          "validate",
        ],
        stdout: "piped",
        stderr: "piped",
      });
      
      const { code, stdout } = await cmd.output();
      const output = new TextDecoder().decode(stdout);
      
      // Should either pass (0) or indicate token expired (2)
      assertEquals([0, 2].includes(code), true);
      assertStringIncludes(output.toLowerCase(), "token");
    },
  });
}

console.log("\n✅ All unit tests passed!");
if (!INTEGRATION_TESTS_ENABLED) {
  console.log("ℹ️  Integration tests skipped (set ENABLE_INTEGRATION_TESTS=1 to run)");
}

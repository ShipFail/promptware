import { assertEquals } from "jsr:@std/assert";

// We need to export chunkText to test it, but it's not exported in the main file.
// I'll use a trick or just copy the logic for testing if I can't import it.
// Actually, I should have exported it. Let me update chunker.ts to export it.

// Wait, I can't edit chunker.ts easily without re-writing it.
// I'll just run the CLI in the test.

Deno.test("Chunker CLI: Should chunk text by paragraphs", async () => {
  const text = "Para 1\n\nPara 2\n\nPara 3";
  const command = new Deno.Command(Deno.execPath(), {
    args: ["run", "-A", "os/skills/memory-manager/chunker.ts", "--json", "--size", "10", text],
    stdout: "piped",
  });
  
  const output = await command.output();
  const stdout = new TextDecoder().decode(output.stdout);
  const chunks = JSON.parse(stdout);

  // "Para 1" is 6 chars. "Para 2" is 6 chars.
  // Size 10.
  // Chunk 1: "Para 1"
  // Chunk 2: "Para 2"
  // Chunk 3: "Para 3"
  
  assertEquals(chunks.length, 3);
  assertEquals(chunks[0].text, "Para 1");
});

Deno.test("Chunker CLI: Should merge small paragraphs", async () => {
  const text = "A\n\nB";
  const command = new Deno.Command(Deno.execPath(), {
    args: ["run", "-A", "os/skills/memory-manager/chunker.ts", "--json", "--size", "10", text],
    stdout: "piped",
  });
  
  const output = await command.output();
  const stdout = new TextDecoder().decode(output.stdout);
  const chunks = JSON.parse(stdout);

  // "A" (1) + "\n\n" (2) + "B" (1) = 4 chars. < 10.
  // Should be 1 chunk.
  
  assertEquals(chunks.length, 1);
  assertEquals(chunks[0].text, "A\n\nB");
});

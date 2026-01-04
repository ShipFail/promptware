import { parseArgs } from "jsr:@std/cli/parse-args";

/**
 * Memory Manager: Chunker
 * 
 * Splits text into semantic chunks.
 * Strategy: Paragraph-aware splitting with character limit.
 */

interface Chunk {
  text: string;
  metadata: {
    source: string;
    index: number;
    total: number;
    [key: string]: any;
  };
}

function chunkText(text: string, size: number, source: string): Chunk[] {
  const chunks: Chunk[] = [];
  const paragraphs = text.split(/\n\s*\n/); // Split by double newline
  
  let currentChunk = "";
  let chunkIndex = 0;

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    // If adding this paragraph exceeds size, push current chunk
    if (currentChunk.length + trimmed.length + 2 > size && currentChunk.length > 0) {
      chunks.push({
        text: currentChunk.trim(),
        metadata: { source, index: chunkIndex++ } // Total updated later
      });
      currentChunk = "";
    }

    // If paragraph itself is larger than size, hard split it
    if (trimmed.length > size) {
      // If we have a pending chunk, push it first
      if (currentChunk.length > 0) {
        chunks.push({
          text: currentChunk.trim(),
          metadata: { source, index: chunkIndex++ }
        });
        currentChunk = "";
      }
      
      // Split large paragraph
      let remaining = trimmed;
      while (remaining.length > 0) {
        const slice = remaining.slice(0, size);
        chunks.push({
          text: slice,
          metadata: { source, index: chunkIndex++ }
        });
        remaining = remaining.slice(size);
      }
    } else {
      // Append to current chunk
      currentChunk += (currentChunk ? "\n\n" : "") + trimmed;
    }
  }

  // Push final chunk
  if (currentChunk.length > 0) {
    chunks.push({
      text: currentChunk.trim(),
      metadata: { source, index: chunkIndex++ }
    });
  }

  // Update totals
  chunks.forEach(c => c.metadata.total = chunks.length);
  
  return chunks;
}

// CLI Entry Point
if (import.meta.main) {
  const args = parseArgs(Deno.args, {
    string: ["file", "size"],
    boolean: ["json", "help"],
    alias: { file: "f", size: "s", json: "j", help: "h" },
    default: { size: "1000" }
  });

  if (args.help) {
    console.log(`
Usage: deno run -A chunker.ts [options] [text]

Options:
  -f, --file <path>   Path to file to chunk.
  -s, --size <num>    Max characters per chunk (default: 1000).
  -j, --json          Output JSON (default: human readable).
  -h, --help          Show this help.
`);
    Deno.exit(0);
  }

  let text = "";
  let source = "stdin";

  if (args.file) {
    try {
      text = await Deno.readTextFile(args.file);
      source = args.file;
    } catch (e: any) {
      console.error(`Error reading file: ${e.message}`);
      Deno.exit(1);
    }
  } else if (args._.length > 0) {
    text = args._.join(" ");
    source = "arg";
  } else {
    // Try reading stdin
    try {
      const buf = new Uint8Array(1024);
      const n = await Deno.stdin.read(buf);
      if (n && n > 0) {
        // This is a simplistic stdin check, for full stdin support we'd readAll
        // But for now let's just require args or file
        console.error("Error: No input provided. Use --file or pass text as argument.");
        Deno.exit(1);
      }
    } catch {
      // Ignore
    }
    console.error("Error: No input provided.");
    Deno.exit(1);
  }

  const size = parseInt(args.size, 10);
  const chunks = chunkText(text, size, source);

  if (args.json) {
    console.log(JSON.stringify(chunks, null, 2));
  } else {
    chunks.forEach(c => {
      console.log(`--- Chunk ${c.metadata.index + 1}/${c.metadata.total} ---`);
      console.log(c.text);
      console.log("\n");
    });
  }
}

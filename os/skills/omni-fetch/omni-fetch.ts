import { parseArgs } from "jsr:@std/cli/parse-args";

if (import.meta.main) {
  const args = parseArgs(Deno.args, {
    boolean: ["help"],
    alias: { h: "help" },
  });

  if (args.help || args._.length === 0) {
    console.log(`
omni-fetch - A basic HTTP client for PromptWar̊e ØS

Usage:
  deno run --allow-net omni-fetch.ts <url>

Options:
  -h, --help    Show this help message
`);
    Deno.exit(0);
  }

  const url = args._[0].toString();

  try {
    const response = await fetch(url);

    if (!response.ok) {
      console.error(`Error: HTTP ${response.status} ${response.statusText}`);
      Deno.exit(1);
    }

    const text = await response.text();
    console.log(text);
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
    } else {
      console.error("An unknown error occurred.");
    }
    Deno.exit(1);
  }
}

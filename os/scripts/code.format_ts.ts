#!/usr/bin/env -S deno run --allow-read --allow-write --allow-run

// Simple placeholder formatter tool for Promptware OS.
// v0: just prints help; you can later hook it to `deno fmt` or prettier.

const HELP = `
format_ts.ts - Format TypeScript files in the current project

USAGE:
  deno run --allow-all https://raw.githubusercontent.com/ShipFail/promptware/main/scripts/format_ts.ts --help

OPTIONS:
  --help           Show this help message

NOTES:
  - This is a placeholder tool for Promptware OS.
  - In a real version, it might call \`deno fmt\` or another formatter
    on files in the current directory.
`;

const args = new Set(Deno.args);

if (args.has("--help") || args.size === 0) {
  console.log(HELP.trim());
  Deno.exit(0);
}

// Future: implement real formatting behavior here.
console.error("format_ts: non-help modes are not implemented yet.");
Deno.exit(1);
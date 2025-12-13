#!/usr/bin/env -S deno run --allow-run --allow-read --allow-write

/**
 * fit-image.ts
 * Copyright (c) 2025 Ship.Fail
 * Licensed under the MIT License.
 */

import { parseArgs } from "jsr:@std/cli/parse-args";
import { walk } from "jsr:@std/fs/walk";
import { extname, resolve } from "jsr:@std/path";

const HELP_MESSAGE = `
fit-image - Image optimization utility

Usage:
  fit-image [options] [path]

Options:
  --help, -h        Show this help message
  --width, -w       Max width in pixels (default: 1600)
  --dry-run, -d     Preview changes without executing
  --recursive, -r   Process directories recursively
  --quiet, -q       Suppress output

Description:
  Resizes images to a maximum width and converts them to WebP format.
  If [path] is a file, it processes that file.
  If [path] is a directory, it processes images within it.
`;

async function runCommand(cmd: string[], cwd?: string): Promise<{ success: boolean; stdout: string; stderr: string }> {
  const command = new Deno.Command(cmd[0], {
    args: cmd.slice(1),
    cwd,
    stdout: "piped",
    stderr: "piped",
  });
  const output = await command.output();
  const decoder = new TextDecoder();
  return {
    success: output.success,
    stdout: decoder.decode(output.stdout).trim(),
    stderr: decoder.decode(output.stderr).trim(),
  };
}

async function getImageWidth(filePath: string): Promise<number | null> {
  const { success, stdout } = await runCommand(["identify", "-ping", "-format", "%w", filePath]);
  if (!success) return null;
  const width = parseInt(stdout, 10);
  return isNaN(width) ? null : width;
}

async function processFile(filePath: string, options: { width: number; dryRun: boolean; quiet: boolean }) {
  const ext = extname(filePath).toLowerCase();
  if (![".jpg", ".jpeg", ".png", ".gif", ".webp"].includes(ext)) {
    return;
  }

  const width = await getImageWidth(filePath);
  if (width === null) {
    if (!options.quiet) console.error(`Failed to get width for ${filePath}`);
    return;
  }

  const needsResize = width > options.width;
  const needsConvert = ext !== ".webp";

  if (!needsResize && !needsConvert) {
    if (!options.quiet) console.log(`Skipping ${filePath} (width ${width} <= ${options.width}, already webp)`);
    return;
  }

  if (options.dryRun) {
    if (needsResize) console.log(`[Dry Run] Would resize ${filePath} (width: ${width} -> ${options.width})`);
    if (needsConvert) console.log(`[Dry Run] Would convert ${filePath} to WebP`);
    return;
  }

  if (needsResize) {
    if (!options.quiet) console.log(`Resizing ${filePath} ...`);
    // mogrify -verbose -quality 80 -resize "1600>" file
    await runCommand([
      "mogrify",
      "-verbose",
      "-quality",
      "80",
      "-resize",
      `${options.width}>`,
      filePath,
    ]);
  }

  if (needsConvert) {
    if (!options.quiet) console.log(`Converting ${filePath} to webp ...`);
    const webpPath = filePath.replace(new RegExp(`${ext}$`), ".webp");
    // convert file file.webp
    const { success } = await runCommand(["convert", filePath, webpPath]);
    if (success) {
      await Deno.remove(filePath);
    } else {
      console.error(`Failed to convert ${filePath}`);
    }
  }
}

async function main() {
  const args = parseArgs(Deno.args, {
    boolean: ["help", "dry-run", "recursive", "quiet"],
    string: ["width"],
    alias: { h: "help", w: "width", d: "dry-run", r: "recursive", q: "quiet" },
    default: { width: "1600" },
  });

  if (args.help) {
    console.log(HELP_MESSAGE);
    Deno.exit(0);
  }

  const targetPath = resolve(args._[0]?.toString() || ".");
  const width = parseInt(args.width, 10);
  const recursive = args.recursive;
  const dryRun = args["dry-run"];
  const quiet = args.quiet;

  if (isNaN(width)) {
    console.error("Error: Width must be a number");
    Deno.exit(1);
  }

  try {
    const stat = await Deno.stat(targetPath);

    if (stat.isFile) {
      if (!quiet) console.log(`fit-image: ${targetPath} is file`);
      await processFile(targetPath, { width, dryRun, quiet });
    } else if (stat.isDirectory) {
      if (!quiet) console.log(`fit-image: ${targetPath} is directory`);
      
      const walkOptions = {
        maxDepth: recursive ? Infinity : 1,
        includeDirs: false,
        exts: [".jpg", ".jpeg", ".png", ".gif", ".webp"],
      };

      for await (const entry of walk(targetPath, walkOptions)) {
        await processFile(entry.path, { width, dryRun, quiet });
      }
    } else {
      console.error(`Error: ${targetPath} is not a file or directory`);
      Deno.exit(1);
    }
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      console.error(`Error: Path not found: ${targetPath}`);
    } else {
      console.error(error);
    }
    Deno.exit(1);
  }
}

if (import.meta.main) {
  main();
}

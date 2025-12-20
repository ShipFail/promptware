import { parse, stringify } from "jsr:@std/yaml";
import { join, dirname, isAbsolute } from "jsr:@std/path";
import { parseArgs } from "jsr:@std/cli/parse-args";

const HELP_TEXT = `
PromptWar̊e ØS JIT Linker
Usage: deno run -A linker.ts <file_path_or_url>

Description:
  Hydrates a Markdown file by expanding its 'skills' and 'tools' front matter.
  - Resolves 'skills' paths and injects their description from their own front matter.
  - Resolves 'tools' paths, runs them with --help, and injects the output as description.
  - Supports both local files and remote URLs (http/https).

Options:
  --help, -h  Show this help message.
`;

function isUrl(path: string): boolean {
  try {
    new URL(path);
    return true;
  } catch {
    return false;
  }
}

async function fetchOrRead(path: string): Promise<string> {
  if (isUrl(path)) {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`Failed to fetch ${path}: ${res.statusText}`);
    return res.text();
  } else {
    return Deno.readTextFile(path);
  }
}

function resolveRelative(base: string, relative: string): string {
  if (isUrl(base)) {
    // URL resolution handles relative paths correctly (e.g. "skills/foo.md" relative to "https://.../agents/")
    return new URL(relative, base).href;
  } else {
    // Local filesystem resolution
    if (isAbsolute(relative)) return relative;
    return join(base, relative);
  }
}

function getDir(path: string): string {
  if (isUrl(path)) {
    // For URLs, dirname is the path up to the last slash
    return new URL(".", path).href;
  } else {
    return dirname(path);
  }
}

async function getSkillDescription(path: string): Promise<string> {
  try {
    const content = await fetchOrRead(path);
    const match = content.match(/^---\n([\s\S]+?)\n---/);
    if (match) {
      const fm = parse(match[1]) as any;
      return fm.description || fm.title || "No description provided.";
    }
    return "No front matter found.";
  } catch (e) {
    return `Error reading skill: ${e.message}`;
  }
}

async function getToolHelp(path: string): Promise<string> {
  try {
    // If it's a URL, we can't "run" it directly with Deno.Command unless we download it or use `deno run <url>`.
    // But `deno run` works with URLs!
    const command = new Deno.Command(Deno.execPath(), {
      args: ["run", "-A", path, "--help"],
      stdout: "piped",
      stderr: "piped",
    });
    const output = await command.output();
    if (output.success) {
      return new TextDecoder().decode(output.stdout).trim();
    } else {
      return `Error running tool: ${new TextDecoder().decode(output.stderr)}`;
    }
  } catch (e) {
    return `Error executing tool: ${e.message}`;
  }
}

export async function linker(targetPath: string): Promise<string> {
  // Resolve initial path. If it's not a URL and not absolute, assume CWD.
  let absolutePath = targetPath;
  if (!isUrl(targetPath) && !isAbsolute(targetPath)) {
    absolutePath = join(Deno.cwd(), targetPath);
  }
  
  const fileDir = getDir(absolutePath);
  
  let content = "";
  try {
    content = await fetchOrRead(absolutePath);
  } catch (e) {
    console.error(`Error reading ${absolutePath}: ${e.message}`);
    Deno.exit(1);
  }

  const match = content.match(/^---\n([\s\S]+?)\n---/);
  if (!match) {
    // No front matter, return as is
    return content;
  }

  const rawFm = match[1];
  const body = content.substring(match[0].length);
  const fm = parse(rawFm) as any;

  // Process Skills
  if (Array.isArray(fm.skills)) {
    const hydratedSkills = [];
    for (const skillPath of fm.skills) {
      if (typeof skillPath === "string") {
        const resolved = resolveRelative(fileDir, skillPath);
        const description = await getSkillDescription(resolved);
        hydratedSkills.push({
          [skillPath]: { description }
        });
      } else {
        hydratedSkills.push(skillPath);
      }
    }
    fm.skills = hydratedSkills;
  }

  // Process Tools
  if (Array.isArray(fm.tools)) {
    const hydratedTools = [];
    for (const toolPath of fm.tools) {
      if (typeof toolPath === "string") {
        const resolved = resolveRelative(fileDir, toolPath);
        const description = await getToolHelp(resolved);
        hydratedTools.push({
          [toolPath]: { description }
        });
      } else {
        hydratedTools.push(toolPath);
      }
    }
    fm.tools = hydratedTools;
  }

  const newFm = stringify(fm);
  return `---\n${newFm}---\n${body}`;
}

async function main() {
  const args = parseArgs(Deno.args, {
    boolean: ["help"],
    alias: { help: "h" },
  });

  if (args.help || args._.length === 0) {
    console.log(HELP_TEXT);
    Deno.exit(0);
  }

  const filePath = String(args._[0]);
  const result = await linker(filePath);
  console.log(result);
}

if (import.meta.main) {
  main();
}

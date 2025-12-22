import { parseArgs } from "jsr:@std/cli/parse-args";
import { parse, stringify } from "jsr:@std/yaml";
import resolve from "./resolve.ts";

/**
 * PromptWar̊e ØS Syscall: Ingest
 * Fetches and hydrates a Markdown file (JIT Linking).
 */

const HELP_TEXT = `
Usage: deno run -A ingest.ts --root <os_root> <uri>

Arguments:
  uri     The URI of the markdown file to ingest.

Options:
  --root <url>    The OS Root URL (Required).
  --help, -h      Show this help message.
`;

function isUrl(path: string): boolean {
  try {
    new URL(path);
    return true;
  } catch {
    return false;
  }
}

async function fetchContent(path: string): Promise<string> {
  if (isUrl(path)) {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`Failed to fetch ${path}: ${res.statusText}`);
    return res.text();
  } else {
    return Deno.readTextFile(path);
  }
}

async function getSkillDescription(path: string): Promise<string> {
  try {
    const content = await fetchContent(path);
    const match = content.match(/^---\n([\s\S]+?)\n---/);
    if (match) {
      const fm = parse(match[1]) as any;
      return fm.description || fm.title || "No description provided.";
    }
    return "No front matter found.";
  } catch (e: any) {
    return `Error reading skill: ${e.message}`;
  }
}

async function getToolHelp(path: string): Promise<string> {
  try {
    // For tools, we execute them with --help
    // If it's a URL, we use `deno run <url>`
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
  } catch (e: any) {
    return `Error executing tool: ${e.message}`;
  }
}

export default async function ingest(root: string, targetUri: string): Promise<string> {
  // Resolve the target URI first
  const resolvedPath = await resolve(root, targetUri);
  
  let content = "";
  try {
    content = await fetchContent(resolvedPath);
  } catch (e: any) {
    throw new Error(`Failed to read ${resolvedPath}: ${e.message}`);
  }

  const match = content.match(/^---\n([\s\S]+?)\n---/);
  if (!match) return content;

  const rawFm = match[1];
  const body = content.substring(match[0].length);
  const fm = parse(rawFm) as any;

  // Hydrate Skills
  if (Array.isArray(fm.skills)) {
    const hydratedSkills = [];
    for (const skillPath of fm.skills) {
      if (typeof skillPath === "string") {
        // Resolve skill path relative to the *current file* (resolvedPath)
        const absoluteSkillPath = await resolve(root, skillPath, resolvedPath);
        const description = await getSkillDescription(absoluteSkillPath);
        hydratedSkills.push({ [skillPath]: { description } });
      } else {
        hydratedSkills.push(skillPath);
      }
    }
    fm.skills = hydratedSkills;
  }

  // Hydrate Tools
  if (Array.isArray(fm.tools)) {
    const hydratedTools = [];
    for (const toolPath of fm.tools) {
      if (typeof toolPath === "string") {
        const absoluteToolPath = await resolve(root, toolPath, resolvedPath);
        const description = await getToolHelp(absoluteToolPath);
        hydratedTools.push({ [toolPath]: { description } });
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
    string: ["root"],
    boolean: ["help"],
    alias: { help: "h" },
  });

  if (args.help) {
    console.log(HELP_TEXT);
    Deno.exit(0);
  }

  const root = args.root;
  if (!root) {
    console.error("Error: --root <url> is required.");
    Deno.exit(1);
  }

  const uri = String(args._[0]);

  if (!uri || uri === "undefined") {
    console.error("Error: Missing uri argument");
    Deno.exit(1);
  }

  try {
    const content = await ingest(root, uri);
    console.log(content);
  } catch (e: any) {
    console.error(`Error: ${e.message}`);
    Deno.exit(1);
  }
}

if (import.meta.main) {
  main();
}

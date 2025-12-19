import { parse, stringify } from "jsr:@std/yaml";
import { join, dirname, isAbsolute } from "jsr:@std/path";
import { parseArgs } from "jsr:@std/cli/parse-args";

const HELP_TEXT = `
PromptWar̊e ØS JIT Linker
Usage: deno run -A linker.ts <file_path>

Description:
  Hydrates a Markdown file by expanding its 'skills' and 'tools' front matter.
  - Resolves 'skills' paths and injects their description from their own front matter.
  - Resolves 'tools' paths, runs them with --help, and injects the output as description.

Options:
  --help, -h  Show this help message.
`;

async function resolvePath(baseDir: string, targetPath: string): Promise<string> {
  if (isAbsolute(targetPath)) {
    return targetPath;
  }
  return join(baseDir, targetPath);
}

async function getSkillDescription(path: string): Promise<string> {
  try {
    const content = await Deno.readTextFile(path);
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

export async function linker(filePath: string): Promise<string> {
  const absolutePath = await resolvePath(Deno.cwd(), filePath);
  const fileDir = dirname(absolutePath);
  
  let content = "";
  try {
    content = await Deno.readTextFile(absolutePath);
  } catch (e) {
    console.error(`Error reading file ${absolutePath}: ${e.message}`);
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
        const resolved = await resolvePath(fileDir, skillPath);
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
        const resolved = await resolvePath(fileDir, toolPath);
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

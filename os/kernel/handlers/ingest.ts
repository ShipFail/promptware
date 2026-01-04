import { z } from "jsr:@zod/zod";
import { Capability } from "../schema/contract.ts";
import { createMessage } from "../schema/message.ts";
import { parseArgs } from "jsr:@std/cli/parse-args";
import { parse, stringify } from "jsr:@std/yaml";
import { resolve, isUrl, getKernelParams } from "../vfs/core.ts";

/**
 * PromptWare ØS Ingest Capability
 *
 * Fetches and hydrates markdown files (JIT linking).
 * Resolves skill and tool metadata from YAML frontmatter.
 */

async function fetchContent(path: string): Promise<string> {
  if (isUrl(path)) {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`Failed to fetch ${path}: ${res.statusText}`);
    return res.text();
  } else {
    return Deno.readTextFile(path);
  }
}

async function getSkillMetadata(path: string): Promise<{ name?: string; description: string }> {
  try {
    const content = await fetchContent(path);
    const match = content.match(/^---\n([\s\S]+?)\n---/);
    if (match) {
      const fm = parse(match[1]) as any;
      return {
        name: fm.name,
        description: fm.description || "No description provided.",
      };
    }
    return { description: "No front matter found." };
  } catch (e: any) {
    return { description: `Error reading skill: ${e.message}` };
  }
}

async function getToolDescription(path: string): Promise<string> {
  const MAX_LENGTH = 1024;

  try {
    const command = new Deno.Command(Deno.execPath(), {
      args: ["run", "-A", path, "--description"],
      stdout: "piped",
      stderr: "piped",
    });
    const output = await command.output();
    if (output.success) {
      let desc = new TextDecoder().decode(output.stdout).trim();
      if (desc.length > MAX_LENGTH) {
        desc = desc.substring(0, MAX_LENGTH) + "... (truncated)";
      }
      return desc;
    }
  } catch {
    // Ignore errors, fall back to --help
  }

  try {
    const command = new Deno.Command(Deno.execPath(), {
      args: ["run", "-A", path, "--help"],
      stdout: "piped",
      stderr: "piped",
    });
    const output = await command.output();
    const rawOutput = new TextDecoder().decode(output.success ? output.stdout : output.stderr).trim();

    let desc = rawOutput.split("\n\n")[0];

    if (desc.length > MAX_LENGTH) {
      desc = desc.substring(0, MAX_LENGTH) + "... (Run with --help for full usage)";
    }
    return desc;
  } catch (e: any) {
    return `Error executing tool: ${e.message}`;
  }
}

async function ingest(targetUri: string, explicitRoot?: string): Promise<string> {
  let root: string = explicitRoot || "";

  if (!root) {
    const params = await getKernelParams();
    if (params) {
      root = params.root;
    } else {
      throw new Error("Kernel Panic: proc/cmdline not found. Is the kernel initialized?");
    }
  }

  if (!root) {
    throw new Error("Kernel Panic: No root found. Unable to resolve paths.");
  }

  const resolvedPath = await resolve(targetUri, undefined, root);

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

  if (Array.isArray(fm.skills)) {
    const hydratedSkills = [];
    for (const skillPath of fm.skills) {
      if (typeof skillPath === "string") {
        const absoluteSkillPath = await resolve(skillPath, resolvedPath, root);
        const metadata = await getSkillMetadata(absoluteSkillPath);
        hydratedSkills.push({ [skillPath]: metadata });
      } else {
        hydratedSkills.push(skillPath);
      }
    }
    fm.skills = hydratedSkills;
  }

  if (Array.isArray(fm.tools)) {
    const hydratedTools = [];
    for (const toolPath of fm.tools) {
      if (typeof toolPath === "string") {
        const absoluteToolPath = await resolve(toolPath, resolvedPath, root);
        const description = await getToolDescription(absoluteToolPath);
        hydratedTools.push({ [toolPath]: { description } });
      } else {
        hydratedTools.push(toolPath);
      }
    }
    fm.tools = hydratedTools;
  }

  const newFm = stringify(fm);
  return `---\n${newFm}---${body}`;
}

const InputSchema = z.object({
  uri: z.string().describe("The URI of the resource to ingest (markdown file)"),
}).describe("Input for the ingest capability.");

const OutputSchema = z.object({
  content: z.string().describe("The ingested and hydrated content with resolved metadata"),
}).describe("Output from the ingest capability.");

export const IngestModule = {
  "FileSystem.Ingest": (): Capability<any, any> => ({
    description: "Ingest and hydrate a markdown file with metadata.",
    inbound: z.object({
      kind: z.literal("query"),
      type: z.literal("FileSystem.Ingest"),
      data: InputSchema
    }),
    outbound: z.object({
      kind: z.literal("reply"),
      type: z.literal("FileSystem.Ingest"),
      data: OutputSchema
    }),
    factory: () => new TransformStream({
      async transform(msg, controller) {
        const input = msg.data as z.infer<typeof InputSchema>;
        const content = await ingest(input.uri);
        controller.enqueue(createMessage("reply", "FileSystem.Ingest", { content }, undefined, msg.metadata?.correlation, msg.metadata?.id));
      }
    })
  })
};

export default IngestModule;

// CLI Entry Point
if (import.meta.main) {
  const args = parseArgs(Deno.args, {
    string: ["root"],
    boolean: ["help"],
    alias: { help: "h" },
  });

  if (args.help) {
    console.log(`
Usage: deno run -A ingest.ts [--root <os_root>] <uri>

Arguments:
  uri     The URI of the markdown file to ingest.

Options:
  --root <url>    The OS Root URL (optional, loads from KV if not provided).
  --help, -h      Show this help message.
`);
    Deno.exit(0);
  }

  const root = args.root;
  const uri = String(args._[0]);

  if (!uri || uri === "undefined") {
    console.error("Error: Missing uri argument");
    Deno.exit(1);
  }

  try {
    const content = await ingest(uri, root);
    console.log(content);
  } catch (e: any) {
    console.error(`Error: ${e.message}`);
    Deno.exit(1);
  }
}

import { parse } from "jsr:@std/yaml";
import { walk } from "jsr:@std/fs";
import { assert } from "jsr:@std/assert";

/**
 * PromptWar̊e ØS RFC Validator
 * Enforces "Component-First" naming and "Stylized" branding.
 */

const RFC_DIR = new URL(".", import.meta.url).pathname;

// Regex for Component-First Filenames: NNNN-component-subtopic.md
// Must NOT contain 'promptware' or 'promptwareos'
const FILENAME_REGEX = /^\d{4}-(?!promptware|promptwareos)[a-z0-9]+(-[a-z0-9]+)*\.md$/;

Deno.test("RFC Validation", async (t) => {
  console.log(`🔍 Validating RFCs in ${RFC_DIR}...\n`);
  let errors = 0;

  for await (const entry of walk(RFC_DIR, { maxDepth: 1, exts: ["md"] })) {
    // Whitelist: Only validate files starting with 4 digits (RFCs)
    if (!/^\d{4}-/.test(entry.name)) continue;

    await t.step(`Checking ${entry.name}`, async () => {
        // 1. Check Filename
        if (!FILENAME_REGEX.test(entry.name)) {
          console.error(`  ❌ Filename Violation: ${entry.name}`);
          console.error(`     Rule: Must be NNNN-component-subtopic.md and NOT contain project name.`);
          errors++;
        }

        // 2. Check Frontmatter
        const content = await Deno.readTextFile(entry.path);
        const match = content.match(/^---\n([\s\S]+?)\n---/);
        
        if (!match) {
          console.error(`  ❌ Missing Frontmatter`);
          errors++;
          return;
        }

        const fm = parse(match[1]) as any;

        // Check Required Fields
        const required = ["RFC", "Title", "Author", "Status", "Type", "Version", "Tags"];
        for (const field of required) {
          if (fm[field] === undefined || fm[field] === null || fm[field] === "") {
            console.error(`  ❌ Missing Metadata: ${field}`);
            errors++;
          }
        }

        // 3. Check Title Style (Drop the Brand)
        if (fm.Title && (fm.Title.includes("PromptWare") || fm.Title.includes("Promptware"))) {
           console.error(`  ❌ Title Violation: "${fm.Title}"`);
           console.error(`     Rule: Titles should omit the brand name.`);
           errors++;
        }
    });
  }

  assert(errors === 0, `Validation Failed with ${errors} errors.`);
});

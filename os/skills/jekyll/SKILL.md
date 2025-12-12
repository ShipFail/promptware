---
type: skill
title: "Jekyll Blog Post Author"
version: "0.1.0"
tags:
- jekyll
- workflow
---

This skill teaches you how to create and maintain a Jekyll blog post in a repository that uses:

* `docs/_posts/` for posts
* `docs/assets/YYYY/MM-slug-slug-slug/` for assets
* `docs/_authors/` for author metadata

Your job is to follow these contracts exactly so that posts are consistent, discoverable, and always pass `deno task test`.

---

## When to use this skill

Use this skill whenever you are asked to:

* Create a new blog post.
* Update or fix an existing post that lives under `docs/_posts/`.
* Add or adjust assets (images, PDFs, ZIPs, SVGs) for a post.

If the repository does not follow this layout, ask for confirmation or updated instructions before proceeding.

---

## Inputs and outputs

### Inputs you should expect

* A topic or rough idea for the post.
* The publishing date (or permission to choose a reasonable date).
* The author name or identity.
* Any assets you should embed (images, diagrams, PDFs, etc.), or instructions to create them.

### Outputs you must produce

* One Markdown file in `docs/_posts/` with a valid filename and correct YAML front matter.
* One matching asset folder under `docs/assets/YYYY/MM-slug-slug-slug/` (even if empty at first).
* All assets placed in that folder using allowed formats.
* A clean verification run: `deno task test` completes successfully.

---

## Repository layout and naming contracts

### Post files

* **Directory**: `docs/_posts/`
* **Filename format**: `YYYY-MM-DD-slug-slug-slug.md`

Rules for filenames:

1. Must start with the date: `YYYY-MM-DD`.
2. Must contain at least **three** slugs after the date, separated by hyphens.

   * Example: `my-new-post` is three slugs: `my`, `new`, `post`.
3. Must use only:

   * lowercase letters `a–z`
   * digits `0–9`
   * hyphens `-`
4. Must end with `.md`.

### Asset folders

* **Directory**: `docs/assets/YYYY/MM-slug-slug-slug/`

Rules for asset folders:

1. The `YYYY` and `MM` components must match the date in the post filename.

2. The `MM-slug-slug-slug` part must match the slug portion of the post filename.

3. Example mapping:

   * Post: `docs/_posts/2025-11-25-my-awesome-feature.md`
   * Assets: `docs/assets/2025/11-my-awesome-feature/`

4. Allowed file extensions inside the asset folder:

   * `.webp`
   * `.pdf`
   * `.zip`
   * `.svg`

5. Format priority:

   * Prefer `.svg` when possible.
   * Otherwise use `.webp` for images.

---

## Front matter contract

Every post **must** start with YAML front matter that satisfies this schema:

```yaml
---
title: "post_title"
excerpt: "post_excerpt" # strong hook, max ~160 characters
categories: "category_name" # best-fitting existing category
author: "author_name"       # MUST match docs/_authors/<author_name>.md
tags:
  - tag1
  - tag2
image: /assets/YYYY/MM-slug-slug-slug/post-teaser-image.webp
# Optional flags:
# mermaid: true
# mathjax: true
---
```

Rules:

* **title**

  * Human-readable title for the post.
* **excerpt**

  * Short, strong hook.
  * Aim for tweet-length (~160 characters or less).
* **categories**

  * Use the best existing category name from the site’s categories.
  * If unsure, choose the closest reasonable category instead of inventing many new ones.
* **author**

  * Must match a filename in `docs/_authors/` (without `.md`).
  * Example: if `docs/_authors/huan.md` exists, use `author: huan`.
  * If the author file does not exist, create a minimal `docs/_authors/<author>.md` first.
* **tags**

  * Short list of descriptive labels.
  * Lowercase; hyphens allowed.
* **image**

  * Mandatory.
  * Must point to a valid teaser image inside the asset folder.
  * Use an absolute path starting with `/assets/...`.
  * The path must match the asset folder contract.

Optional flags:

* `mermaid: true`

  * Required if the post includes Mermaid diagrams.
  * Always use double quotes for labels in Mermaid diagrams (e.g. `A["Label (with parens)"]`).
* `mathjax: true`

  * Required if the post includes LaTeX equations (e.g. `$$ ... $$`).

---

## Markdown and layout rules

You must follow the repository’s `.markdownlint.json` rules, plus these clarifications:

1. **No trailing punctuation in headers**

   * Do not end headers with `. , ; : !`
   * Example:

     * ✅ `## Why this matters`
     * ❌ `## Why this matters:`
2. **No hard tabs**

   * Use spaces for indentation.
3. **Trailing spaces**

   * By default, remove trailing whitespace.
   * **Exception (allowed use):**

     * You may use exactly **two spaces at the end of a line** when you *intentionally* want a Markdown soft line break (new line without a blank line).
     * Do **not** use trailing spaces for any other reason.
4. **First header**

   * The title from front matter acts as the H1.
   * Do **not** add a duplicate H1 at the top of the content.
   * Start content with text or an H2 (`##`).
5. **Content style**

   * Use standard Markdown.
   * Keep paragraphs readable: avoid overly long, unbroken walls of text.

### Links and assets

* **Internal links**

  * Respect the Jekyll `permalink` configuration in `docs/_config.yml`.
  * Do not assume categories are part of URLs unless the config says so.
* **Asset links**

  * Use absolute paths starting with `/assets/...`.
  * Example:

    ```markdown
    ![Architecture Diagram](/assets/2025/11-my-awesome-feature/architecture.webp)
    ```

---

## Workflow

Always follow this sequence:

1. **Plan**

   * Clarify:

     * Title
     * Target date
     * Slug base (e.g. `my-awesome-feature`)
     * Intended category, author, and rough outline
   * Draft the main sections and structure in your head or scratch notes.

2. **Add post**

   * Choose the filename: `YYYY-MM-DD-slug-slug-slug.md`.
   * Create the file in `docs/_posts/`.
   * Add valid YAML front matter based on the contract above.
   * Draft the full content of the post under the front matter.
   * Use the expected teaser image path in `image`, assuming the asset folder will follow the standard layout.

3. **Asset folder**

   * Create the asset folder that matches the post filename:

     ```bash
     mkdir -p docs/assets/YYYY/MM-slug-slug-slug
     ```

   * Verify that `YYYY` and `MM-slug-slug-slug` match the post filename exactly.

4. **Add assets**

   * Place all related assets into `docs/assets/YYYY/MM-slug-slug-slug/`.
   * Convert images to `.svg` when appropriate, otherwise `.webp`.
   * Ensure the teaser image referenced in front matter actually exists and matches the path.

5. **Verify**

   * Run the full verification:

     ```bash
     deno task test
     ```

   * If any test fails, read the error messages and fix:

     * Filenames and slugs.
     * Asset paths and extensions.
     * Front matter keys and values.
     * Markdown lint issues (including trailing spaces).

Repeat steps 2–5 until `deno task test` completes without errors.

---

## Tools and commands

This skill assumes you can request or execute commands in a shell-like environment.

Primary command:

```bash
deno task test
```

Behavior:

* Runs all relevant checks for:

  * File naming conventions.
  * Asset folder layout and allowed formats.
  * Front matter correctness (including `image`).
  * Markdown/style rules defined for the repo.

If you have access to a `--help` or documentation for the Deno tasks, you may inspect it when debugging, but always treat `deno task test` as the canonical final gate.

---

## Failure modes and recovery

If something goes wrong:

1. **Tests fail due to filename or asset folder**

   * Re-derive the filename and asset folder from the date and slug.
   * Confirm:

     * `docs/_posts/YYYY-MM-DD-slug-slug-slug.md`
     * `docs/assets/YYYY/MM-slug-slug-slug/`

2. **Tests fail due to missing teaser image**

   * Confirm that:

     * The file exists under `docs/assets/YYYY/MM-slug-slug-slug/`.
     * The `image` path in front matter points to that file with an absolute `/assets/...` path.

3. **Tests fail due to front matter**

   * Check that:

     * All required keys are present.
     * `author` matches a file in `docs/_authors/`.
     * Optional flags (`mermaid`, `mathjax`) are only present when needed.

4. **Markdownlint issues**

   * Remove unintended trailing spaces.
   * Fix headers with trailing punctuation.
   * Replace tabs with spaces.

If you cannot resolve a failure with the rules in this skill, clearly describe the problem and ask for help, including the exact error output and the files involved.

---

## Examples

### Example filename and asset folder

* Post: `docs/_posts/2025-12-08-promptware-os-one-line-boot-ai-native-co-founders.md`
* Asset folder: `docs/assets/2025/12-promptware-os-one-line-boot-ai-native-co-founders/`

### Minimal front matter example

```yaml
---
title: "Promptware OS: One Line to Boot Your AI Co-Founders"
excerpt: "Turn fragile, copy-pasted prompts into a shared operating system for your AI co-founders, booted by a single line in their setup."
categories: "ideas"
author: "huan"
tags:
  - promptware
  - agents
  - prompt-engineering
  - markdown
  - libraries
image: /assets/2025/12-promptware-os-one-line-boot-ai-native-co-founders/teaser.webp
---
```

---

## Non-goals

This skill does **not** decide:

* The brand voice, tone, or deeper persona of the authoring agent.
* The long-term content strategy, series planning, or publishing calendar.
* Any behavior outside of Jekyll blog posts in this specific repo layout.

Those aspects belong to the agent’s persona and mini-library. This skill only defines **how** to create compliant posts and assets that always pass `deno task test`.

#!/usr/bin/env node

/**
 * Promptware OS Boot Validator
 * 
 * This script demonstrates the GitHub URL parsing logic for os_chroot.
 * It validates the boot sequence logic without actually executing it.
 */

// GitHub raw URL pattern
const GITHUB_RAW_PATTERN = /^https:\/\/raw\.githubusercontent\.com\/([^\/]+)\/([^\/]+)\/([^\/]+)\/(.*)$/;

function parseGitHubRawUrl(url) {
  const match = url.match(GITHUB_RAW_PATTERN);
  if (!match) return null;
  
  return {
    org: match[1],
    repo: match[2],
    ref: match[3],
    path: match[4],
  };
}

function deriveApplicationRoot(initUrl) {
  const parsed = parseGitHubRawUrl(initUrl);
  if (!parsed) return null;
  
  return `https://raw.githubusercontent.com/${parsed.org}/${parsed.repo}/${parsed.ref}/`;
}

function shouldChroot(osRoot, initUrl) {
  // If init is not a full URL, no chroot
  if (!initUrl.startsWith('https://')) return false;
  
  const osRootParsed = parseGitHubRawUrl(osRoot);
  const initParsed = parseGitHubRawUrl(initUrl);
  
  if (!osRootParsed || !initParsed) return false;
  
  // Chroot if org, repo, or ref differ
  return (
    osRootParsed.org !== initParsed.org ||
    osRootParsed.repo !== initParsed.repo ||
    osRootParsed.ref !== initParsed.ref
  );
}

function rewriteInitPath(initUrl) {
  const parsed = parseGitHubRawUrl(initUrl);
  if (!parsed) return initUrl;
  
  return `/${parsed.path}`;
}

function validateBootConfig(config) {
  console.log("=== Promptware OS Boot Validator ===\n");
  
  console.log("Boot Configuration:");
  console.log(`  version: ${config.version}`);
  console.log(`  root: ${config.root}`);
  console.log(`  kernel: ${config.kernel}`);
  console.log(`  init: ${config.init}\n`);
  
  // Step 1: Kernel URL
  const kernelUrl = config.root + config.kernel.substring(1); // Remove leading /
  console.log(`Step 1: Kernel URL = ${kernelUrl}`);
  
  // Step 2: Check for chroot
  const needsChroot = shouldChroot(config.root, config.init);
  console.log(`Step 2: Needs chroot? ${needsChroot}`);
  
  if (needsChroot) {
    const appRoot = deriveApplicationRoot(config.init);
    console.log(`Step 3: Application Root = ${appRoot}`);
    
    const rewrittenInit = rewriteInitPath(config.init);
    console.log(`Step 4: Init rewritten to: ${rewrittenInit}`);
    console.log(`Step 5: Final init URL = ${appRoot}${rewrittenInit.substring(1)}`);
  } else {
    const initUrl = config.init.startsWith('/') 
      ? config.root + config.init.substring(1)
      : config.init;
    console.log(`Step 3: No chroot, init URL = ${initUrl}`);
  }
  
  console.log("\n✅ Boot validation complete\n");
}

// Test cases
const testConfigs = [
  {
    version: "0.1",
    root: "https://raw.githubusercontent.com/ShipFail/promptware/main/os/",
    kernel: "/kernel.md",
    init: "/agents/jekyll.md",
  },
  {
    version: "0.1",
    root: "https://raw.githubusercontent.com/ShipFail/promptware/main/os/",
    kernel: "/kernel.md",
    init: "https://raw.githubusercontent.com/bmadcode/bmad-method/main/bundle/init.txt",
  },
  {
    version: "0.1",
    root: "https://raw.githubusercontent.com/ShipFail/promptware/main/os/",
    kernel: "/kernel.md",
    init: "https://raw.githubusercontent.com/myorg/myapp/v1.0.0/init.md",
  },
];

console.log("\n");
for (let i = 0; i < testConfigs.length; i++) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`TEST CASE ${i + 1}`);
  console.log("=".repeat(60) + "\n");
  validateBootConfig(testConfigs[i]);
}

# External Bundle Boot - Quick Start

## Quick Start

To boot PromptWar̊e ØS with an external agent bundle:

**Pattern** (replace `<org>/<repo>` with your repository):
```yaml
version: "0.1"
root: "https://raw.githubusercontent.com/ShipFail/promptware/main/os/"
kernel: "/kernel.md"
init: "https://raw.githubusercontent.com/<org>/<repo>/main/agent/init.md"
```

**Concrete example** (using different PromptWar̊e branch as external source):
```yaml
version: "0.1"
root: "https://raw.githubusercontent.com/ShipFail/promptware/refs/heads/main/os/"
kernel: "/kernel/KERNEL.md"
init: "https://raw.githubusercontent.com/ShipFail/promptware/refs/heads/feature-branch/os/agents/powell.md"
```
(If `feature-branch` exists and differs from `main`, this triggers VFS root switching)

The OS will automatically:
1. Load the kernel from the OS root
2. Detect that `init` points to a different repository or branch
3. Derive application root from the URL
4. Call VFS root switch to the application root
5. Load init from the external repository

## Key Features

### 1. VFS Root Switching - Kernel Primitive

Change the VFS root mount during boot handoff:

```
Before root switch: / → https://raw.githubusercontent.com/ShipFail/promptware/main/os/
After root switch:  / → https://raw.githubusercontent.com/<org>/<repo>/<ref>/
```

### 2. GitHub-First Loading

No installation required. Just provide a GitHub raw URL:

```yaml
# Load any agent, bundle, or application by URL (replace with real repository)
init: "https://raw.githubusercontent.com/<org>/<repo>/<ref>/<path>/init.md"
```

### 3. Mounts Support

Mount additional libraries and modules in the bootloader YAML:

```yaml
mounts:
  /lib/external: "https://raw.githubusercontent.com/<your-org>/<lib-repo>/main/"
  /lib/utils: "https://raw.githubusercontent.com/<your-org>/common-libs/main/utils/"
```

## Files

- `os/kernel.md` - Kernel with os_chroot and fstab support
- `os/bootloader.md` - 17-step boot sequence with chroot logic
- `os/fstab.yaml.example` - Example mount table
- `os/validate-boot.js` - Validation script (run with `node os/validate-boot.js`)
- `docs/bmad-boot-example.md` - Detailed examples
- `docs/implementation-summary.md` - Complete technical summary

## Testing

Run the validation script:

```bash
node os/validate-boot.js
```

Expected output: 3/3 test cases passing

## Security

- ✅ 0 vulnerabilities (CodeQL scan)
- ✅ HTTPS-only URLs enforced
- ✅ Fail-fast on mount conflicts
- ✅ Immutable kernel laws
- ✅ Read-only ingests (no local writes)

## Philosophy

Following Unix principles:
- **Microkernel**: Keep OS small (~105 lines)
- **Mechanism, not policy**: OS provides "how", not "what"
- **Fail-fast**: Panic on errors, don't guess
- **Separation of concerns**: OS layer vs Application layer
- **Do more by doing less**: Minimal features, maximum power

## What's Next

See `docs/implementation-summary.md` for future milestones:
- Milestone A: fstab becomes real (test multi-mount VFS)
- Milestone B: Friendly names (optional sugar)
- Milestone C: Dependency-aware systems (if needed)

## Proof of Concept

This implementation proves:

✅ PromptWar̊e ØS can boot reliably from an OS root  
✅ PromptWar̊e ØS can switch VFS root to an external repository  
✅ PromptWar̊e ØS can ingest arbitrary text as init  
✅ External agent bundles can be booted by URL without installation  

**This is the "cloud-native agent OS" proof.**

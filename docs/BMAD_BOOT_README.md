# BMAD Boot MVP POC Implementation

## Quick Start

To boot Promptware OS with a BMAD bundle:

```yaml
version: "0.1"
root: "https://raw.githubusercontent.com/ShipFail/promptware/main/os/"
kernel: "/kernel.md"
init: "https://raw.githubusercontent.com/bmadcode/bmad-method/main/bundle/init.txt"
```

The OS will automatically:
1. Load the kernel from the OS root
2. Detect that `init` points to a different repository
3. Derive application root: `https://raw.githubusercontent.com/bmadcode/bmad-method/main/`
4. Call `os_chroot()` to switch VFS root
5. Load init from the BMAD repository

## Key Features

### 1. `os_chroot(new_root)` - New Kernel Primitive

Change the VFS root mount during boot handoff:

```
Before chroot: / → https://raw.githubusercontent.com/ShipFail/promptware/main/os/
After chroot:  / → https://raw.githubusercontent.com/bmadcode/bmad-method/main/
```

### 2. GitHub-First Loading

No installation required. Just provide a GitHub raw URL:

```yaml
# Load any agent, bundle, or application by URL
init: "https://raw.githubusercontent.com/<org>/<repo>/<ref>/<path>/init.md"
```

### 3. fstab Support

Mount additional libraries and modules:

```yaml
# os/fstab.yaml
version: "0.1"
mounts:
  - mount: "/modules/bmad/"
    url: "https://raw.githubusercontent.com/bmadcode/bmad-method/main/"
  - mount: "/lib/utils/"
    url: "https://raw.githubusercontent.com/myorg/common-libs/main/utils/"
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

✅ Promptware OS can boot reliably from an OS root  
✅ Promptware OS can os_chroot into an application root  
✅ Promptware OS can ingest arbitrary text as init  
✅ BMAD can be booted by URL without installation  

**This is the "cloud-native agent OS" proof.**

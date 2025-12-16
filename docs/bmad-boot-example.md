# BMAD Boot Example

This document demonstrates how to boot a BMAD bundle using Promptware OS.

## Example 1: Boot with Relative Init (Default OS Agent)

```yaml
version: "0.1"
root: "https://raw.githubusercontent.com/ShipFail/promptware/main/os/"
kernel: "/kernel.md"
init: "/agents/jekyll.md"
```

**Result**: 
- No chroot occurs
- Init loaded from: `https://raw.githubusercontent.com/ShipFail/promptware/main/os/agents/jekyll.md`
- Agent runs with OS root as VFS root

## Example 2: Boot BMAD Bundle (Full URL with Chroot)

```yaml
version: "0.1"
root: "https://raw.githubusercontent.com/ShipFail/promptware/main/os/"
kernel: "/kernel.md"
init: "https://raw.githubusercontent.com/bmadcode/bmad-method/main/bundle/init.txt"
```

**Result**:
- Kernel detects full GitHub raw URL to different repo
- Application Root derived: `https://raw.githubusercontent.com/bmadcode/bmad-method/main/`
- Kernel calls: `os_chroot("https://raw.githubusercontent.com/bmadcode/bmad-method/main/")`
- Init rewritten to: `/bundle/init.txt`
- Init loaded from: `https://raw.githubusercontent.com/bmadcode/bmad-method/main/bundle/init.txt`
- Agent runs with BMAD root as VFS root

## Example 3: Boot with fstab Mounts

**OS fstab** (`https://raw.githubusercontent.com/ShipFail/promptware/main/os/fstab.yaml`):
```yaml
version: "0.1"
mounts:
  - mount: "/modules/bmad/"
    url: "https://raw.githubusercontent.com/bmadcode/bmad-method/main/"
```

**Application fstab** (after chroot, at `https://raw.githubusercontent.com/myorg/myapp/main/fstab.yaml`):
```yaml
version: "0.1"
mounts:
  - mount: "/lib/utils/"
    url: "https://raw.githubusercontent.com/myorg/common-libs/main/utils/"
```

**Bootloader config**:
```yaml
version: "0.1"
root: "https://raw.githubusercontent.com/ShipFail/promptware/main/os/"
kernel: "/kernel.md"
init: "https://raw.githubusercontent.com/myorg/myapp/main/init.md"
```

**Boot sequence**:
1. Load kernel from OS root
2. Process OS fstab → mount `/modules/bmad/` to BMAD repo
3. Detect full URL init → derive app root
4. Call `os_chroot("https://raw.githubusercontent.com/myorg/myapp/main/")`
5. Process application fstab → mount `/lib/utils/` to common libs
6. Load init from `/init.md` (resolved against app root)

**Final VFS state**:
- `/` → `https://raw.githubusercontent.com/myorg/myapp/main/` (application root)
- `/modules/bmad/` → `https://raw.githubusercontent.com/bmadcode/bmad-method/main/`
- `/lib/utils/` → `https://raw.githubusercontent.com/myorg/common-libs/main/utils/`

## Key Benefits

1. **Zero Installation**: Just provide a URL to any GitHub-hosted agent/bundle
2. **Cloud-Native**: Everything loads from GitHub raw URLs
3. **Isolation**: OS layer and application layer are cleanly separated
4. **Composability**: Use fstab to mount multiple libraries and modules
5. **Unix-Like**: Familiar chroot concept adapted for cloud-native prompt loading

## Security Notes

- All URLs must be HTTPS
- Mount conflicts cause kernel panic (security by fail-fast)
- Kernel laws remain immutable regardless of chroot
- Application cannot override OS-level mounts

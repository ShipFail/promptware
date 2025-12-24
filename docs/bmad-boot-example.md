# External Bundle Boot Examples

This document demonstrates how to boot external agent bundles using PromptWar̊e ØS VFS root switching feature (RFC 0019).

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

## Example 2: Boot External Agent Bundle (Full URL with Chroot)

**Note**: This example shows the pattern for loading external bundles. Replace `<external-org>/<external-repo>` with your actual repository.

```yaml
version: "0.1"
root: "https://raw.githubusercontent.com/ShipFail/promptware/main/os/"
kernel: "/kernel.md"
# Example pattern for external bundle (replace with real repository URL)
init: "https://raw.githubusercontent.com/<external-org>/<external-repo>/main/agent/init.md"
```

**Result**:
- Kernel detects full GitHub raw URL to different repo
- Application Root derived: `https://raw.githubusercontent.com/<external-org>/<external-repo>/main/`
- Kernel calls: `os_chroot("https://raw.githubusercontent.com/<external-org>/<external-repo>/main/")`
- Init rewritten to: `/agent/init.md`
- Init loaded from external repository
- Agent runs with external root as VFS root

**Testable Example** (using another PromptWare branch as external source):
```yaml
version: "0.1"
root: "https://raw.githubusercontent.com/ShipFail/promptware/refs/heads/main/os/"
kernel: "/kernel/KERNEL.md"
init: "https://raw.githubusercontent.com/ShipFail/promptware/refs/heads/develop/os/agents/powell.md"
```
If `develop` branch exists with different content, this would trigger VFS root switching.

## Example 3: Boot with Multiple Mounts (Template)

**Note**: Replace placeholder URLs with real repositories.

**OS fstab** (optional, in bootloader YAML):
```yaml
mounts:
  /lib/external: "https://raw.githubusercontent.com/<your-org>/<lib-repo>/main/"
```

**Application-specific mounts** (after chroot, if app provides fstab):
```yaml
version: "0.1"
mounts:
  - mount: "/lib/utils/"
    url: "https://raw.githubusercontent.com/<your-org>/common-libs/main/utils/"
```

**Bootloader config**:
```yaml
version: "0.1"
root: "https://raw.githubusercontent.com/ShipFail/promptware/main/os/"
kernel: "/kernel.md"
init: "https://raw.githubusercontent.com/<your-org>/<your-agent>/main/init.md"
mounts:
  /lib/promptware: "https://raw.githubusercontent.com/ShipFail/promptware/main/os/skills/"
```

**Boot sequence**:
1. Load kernel from OS root
2. Process OS-level mounts from bootloader
3. Detect full URL init → derive app root
4. Call `os_chroot()` to switch VFS root
5. Process application fstab (if present)
6. Load init from application repository

**Final VFS state**:
- `/` → Application root (from external repository)
- `/lib/promptware/` → PromptWar̊e OS skills directory
- `/lib/utils/` → External utility library (if app fstab exists)

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

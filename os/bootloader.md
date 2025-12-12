# Promptware OS Boot Loader

To boot the system, load the `kernel` and follow its prompt strictly using this configuration:

```yaml Promptware OS version 0.1
promptwareos: os/
kernel: kernel.md
init: agents/powell.md
```

Response:
- `Error: Kernel not found ${promptwareos}/${kernel}` if failed,
- or `Promptware OS Kernel@{version} loaded.`

---
*Usage: Copy the block above into the chat to boot the OS.*

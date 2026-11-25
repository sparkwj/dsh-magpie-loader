# dsh-magpie-loader

English | [简体中文](README.zh-CN.md)

A DeepSeek Harness (DSH) plugin that starts magpie together with DSH and stops it when DSH exits.

## What it does

- **On start:** when DSH loads the plugin, it runs `magpie web --no-open`, finding `magpie` on your `PATH`.
- **On stop:** when DSH exits, or when you disable or reload the plugin, it stops the magpie process it started.
  - macOS / Linux: sends `SIGTERM`, then `SIGKILL` after 5 seconds if magpie is still running.
  - Windows: runs `taskkill /T /F` to end magpie and its child processes.
- **Fallback:** if DSH exits without disposing plugins, the plugin still tries to kill magpie on process exit.

The plugin only manages the magpie process it started. A magpie app or other magpie processes you opened yourself keep running.

## Requirements

- DeepSeek Harness with plugin support.
- The `magpie` command available on `PATH` (enable "Add command line to PATH" in magpie's settings).

## Installation

```bash
git clone git@github.com:sparkwj/dsh-magpie-loader.git
```

Then in DSH, open **Plugins** > **Add plugin** and choose the cloned directory.

## Configuration

The command and arguments are set in `cordis.patch.yml`:

```yaml
- insert:
    - id: magpie-loader
      name: '@local/dsh-magpie-loader'
      config:
        command: magpie
        args:
          - web
          - --no-open
```

| Field | Default | Description |
|---|---|---|
| `command` | `magpie` | Executable to run. Use an absolute path if it is not on `PATH`. |
| `args` | `[]` | Arguments passed to the command. |

After editing, disable and re-enable **Magpie loader** on the Plugins page to apply the change.

## Verifying

```bash
pgrep -fl "magpie web"
```

The process should appear while DSH is running and disappear after DSH exits.

## Notes

- If the command only launches another app and exits immediately, the plugin cannot track or stop that app. Use a command that keeps running in the foreground, such as `magpie web`.
- If magpie fails to start, the error is written to the DSH log; DSH itself keeps working.

## Files

| File | Purpose |
|---|---|
| `package.json` | Bundle manifest |
| `cordis.patch.yml` | Plugin row and configuration |
| `index.js` | Starts and stops magpie |
| `locale/en.json`, `locale/zh.json` | Title and description shown in Plugins |
| `icon.svg` | Plugin icon |

## License

MIT

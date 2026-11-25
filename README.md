# dsh-magpie-loader

English | [简体中文](README.zh-CN.md)

A DeepSeek Harness (DSH) plugin that starts magpie when DSH starts and stops it when DSH exits.

## Installation

### 1. Install magpie

Install magpie, open it, go to **Settings** > **About**, and click **Add magpie command line to environment**.

### 2. Install the plugin

In DSH, open **Plugins** > **Add plugin**, enter the following npm package name, and install:

```
dsh-magpie-loader
```

Once installed, magpie starts and stops together with DSH.

## Configuration

By default the plugin runs `magpie web --no-open`. You can change this in the plugin configuration:

| Field | Default | Description |
|---|---|---|
| `command` | `magpie` | Command to run |
| `args` | `["web", "--no-open"]` | Command arguments |

## Notes

- The plugin only stops the magpie process it started; magpie instances you opened yourself are not affected.
- If magpie fails to start, DSH keeps working normally.

## License

MIT

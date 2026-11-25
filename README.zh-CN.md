# dsh-magpie-loader

[English](README.md) | 简体中文

一个 DeepSeek Harness（DSH）插件：启动 DSH 时自动启动 magpie，退出 DSH 时自动关闭 magpie。

## 功能

- **启动时：** DSH 加载插件时，从 `PATH` 中找到 `magpie` 并运行 `magpie web --no-open`。
- **关闭时：** 退出 DSH、停用或重新加载插件时，结束插件启动的 magpie 进程。
  - macOS / Linux：先发送 `SIGTERM`，5 秒后仍未退出则发送 `SIGKILL`。
  - Windows：使用 `taskkill /T /F` 连同子进程一起结束。
- **兜底：** 如果 DSH 没有正常卸载插件就退出，插件也会在进程退出时尝试结束 magpie。

插件只管理它自己启动的 magpie 进程。你手动打开的 magpie App 或其他 magpie 进程不受影响。

## 前提条件

- 支持插件的 DeepSeek Harness。
- `magpie` 命令已加入 `PATH`（在 magpie 设置中开启“将命令行添加到 PATH”）。

## 安装

```bash
git clone git@github.com:sparkwj/dsh-magpie-loader.git
```

然后在 DSH 中打开 **插件** > **添加插件**，选择克隆下来的目录。

## 配置

命令和参数在 `cordis.patch.yml` 中设置：

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

| 字段 | 默认值 | 说明 |
|---|---|---|
| `command` | `magpie` | 要运行的命令。不在 `PATH` 中时可填绝对路径。 |
| `args` | `[]` | 传给命令的参数。 |

修改后，在插件页面把“Magpie 启动器”停用再启用即可生效。

## 验证

```bash
pgrep -fl "magpie web"
```

DSH 运行时应能看到该进程，DSH 退出后进程应消失。

## 注意事项

- 如果命令只是拉起另一个 App 后立即退出，插件无法跟踪和关闭那个 App。请使用会在前台持续运行的命令，例如 `magpie web`。
- magpie 启动失败时，错误会写入 DSH 日志，DSH 本身不受影响。

## 文件说明

| 文件 | 用途 |
|---|---|
| `package.json` | 插件包清单 |
| `cordis.patch.yml` | 插件条目与配置 |
| `index.js` | 启动和关闭 magpie 的逻辑 |
| `locale/en.json`、`locale/zh.json` | 插件页面显示的名称和说明 |
| `icon.svg` | 插件图标 |

## 许可证

MIT

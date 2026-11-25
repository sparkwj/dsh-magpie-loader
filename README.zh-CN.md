# dsh-magpie-loader

[English](README.md) | 简体中文

DeepSeek Harness（DSH）插件：启动 DSH 时自动运行 magpie，退出 DSH 时自动关闭。

## 安装

### 1. 安装 magpie

先安装 magpie，然后打开 magpie，进入 **设置** > **关于**，点击 **将 magpie 命令行添加到环境中**。

### 2. 安装插件

在 DSH 中打开 **插件** > **添加插件**，输入以下 npm 包名并安装：

```
dsh-magpie-loader
```

安装完成后，magpie 会随 DSH 自动启动和关闭。

## 配置

插件默认运行 `magpie web --no-open`。如需修改，可在插件配置中调整：

| 字段 | 默认值 | 说明 |
|---|---|---|
| `command` | `magpie` | 要运行的命令 |
| `args` | `["web", "--no-open"]` | 命令参数 |

## 说明

- 插件只会关闭由它启动的 magpie 进程，你自己打开的 magpie 不受影响。
- magpie 启动失败不会影响 DSH 正常使用。

## 许可证

MIT

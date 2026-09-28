# 拾译 · Glearn Translate

[English](./misc/README_EN.md) · [使用文档](./docs/guide/getting-started.md)

简洁、美观、有设计感的 AI 翻译插件，支持网页划词和文本翻译。选中文本后点击或悬停翻译圆点；插件内按 Enter 翻译，Ctrl / ⌘ + Enter 换行。译文卡片支持复制与固定，内容和格式由提示词决定。

支持 OpenAI、DeepSeek、千问、Claude、Gemini 等 AI 服务，以及 New API 网关和 Ollama 等本地接口。

## 安装

准备好 Node.js 与 pnpm，在项目目录执行：

```bash
pnpm install
pnpm build
```

- **Chrome / Edge**：在扩展管理页开启开发者模式，加载 `.output/chrome-mv3`。
- **Firefox**：运行 `pnpm build:firefox`，在 `about:debugging` 中临时加载 `.output/firefox-mv2/manifest.json`，关闭浏览器后需重新加载。

更新后，重新加载扩展并刷新已打开的网页。

## 配置

打开插件底部“更多”，选择 **AI 服务**，依次填写 **API 地址、API Key 和模型**。地址默认使用服务地址，可修改为代理或网关；模型支持选择或手动输入，右侧刷新图标可获取列表。设置自动保存。

本地服务选择“自定义接口”，无需鉴权时 API Key 可留空；Azure 需填写自己的资源部署地址。其他接入方式见[模型 API 配置](./docs/config/translation-engines.md)。

目标语言“智能”会将中文译为英文，其他语言译为中文；也可手动指定目标语言。

**System Prompt / User Prompt** 切换编辑，支持恢复默认。User Prompt 支持 `{{to}}`（目标语言，智能模式时留空）和 `{{origin}}`（原文）。默认提示词要求单个英语单词附带音标，无论它是原文还是译文。更多说明见[功能介绍](./docs/guide/features.md)。

## 开发

使用 WXT、Vue 3、TypeScript、Element Plus 和 VitePress。

```bash
pnpm dev          # 开发模式
pnpm compile      # 类型检查
pnpm test         # 回归测试
pnpm docs:dev     # 文档预览
```

Firefox 开发使用 `pnpm dev:firefox`；浏览器验证先运行 `pnpm build`，再运行 `pnpm test:browser`。

---

插件开源免费，AI 服务可能计费。配置与密钥保存在当前浏览器，翻译文本及提示词发送至配置的 AI 服务，密钥用于鉴权。缓存启用时，译文保存在本地。

基于 [FluentRead](https://github.com/Bistutu/FluentRead) 修改 · [GPL-3.0](./LICENSE) · [常见问题](./docs/guide/faq.md)

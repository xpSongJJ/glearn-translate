# 拾译 (Glearn Translate)

> [English](./misc/README_EN.md) | 中文

一款基于 [FluentRead](https://github.com/Bistutu/FluentRead) 修改的开源浏览器翻译插件，随手拾译，让所有人都能够拥有母语般的阅读体验。

## 🌟 特性

- **AI 翻译**：支持 OpenAI、DeepSeek、千问、Claude、Gemini、New API、Ollama 等 AI 服务与自定义接口。
- **文本翻译**：在插件内输入多行文本，点击翻译或按 Ctrl / ⌘ + Enter；译文逐步显示，可一键复制和重试。
- **划词翻译**：选中文本后点击或悬停翻译圆点，支持双语显示、只显示译文或关闭。
- **简洁设置**：目标语言和划词模式保留在主界面；服务商、密钥、接口与模型集中在“更多 → 模型 API”，自动保存。
- **配置迁移**：兼容旧版配置，保留 AI 服务配置，移除机器翻译和网页翻译设置。
- **显示偏好**：支持系统、亮色和暗色主题，翻译缓存、自定义提示词与配置备份。

本版本仅保留划词与插件内文本翻译，不再提供机器翻译、全文翻译、段落悬浮翻译、网页输入框翻译或用户脚本版本。
密钥保存在当前浏览器；翻译时文本和密钥会发送给你配置的 AI 服务。插件开源免费，AI 服务费用由服务商决定。

## 快速使用

1. 打开插件，点击“更多”，选择 AI 服务。
2. 填写密钥和模型名称，或点击“获取列表”选择模型。
3. 自定义接口填写完整的翻译接口地址；本地 Ollama 可留空 API Key。New API 可填写根地址、`/v1` 地址或完整接口地址。
4. 返回翻译页，选择目标语言后输入文本，或在网页选中文本进行划词翻译。

目标语言“自动互译（中 ↔ 英）”会将中文译为英文，其它语言译为中文。

## 📦 安装

### 从源码构建

```bash
# 安装依赖
pnpm install


# 验证类型与回归检查
pnpm compile
pnpm test

# 构建 Chrome 版本
pnpm build

# 构建 Firefox 版本
pnpm build:firefox
```

构建产物在 `.output/` 目录下，在浏览器扩展管理页面加载已解压的扩展即可使用。

## 📖 文档

项目文档位于 [docs/](./docs/) 目录，使用 VitePress 构建：

```bash
pnpm docs:dev     # 本地预览文档
pnpm docs:build   # 构建文档
```

## 🛠 技术栈

- **框架**: WXT + Vue 3 + TypeScript
- **UI**: Element Plus
- **构建**: Vite
- **文档**: VitePress

## 📄 许可

[Apache-2.0](./LICENSE)

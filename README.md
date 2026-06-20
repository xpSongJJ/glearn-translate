# 拾译 (Glearn Translate)

> [English](./misc/README_EN.md) | 中文

一款基于 [FluentRead](https://github.com/Bistutu/FluentRead) 修改的开源浏览器翻译插件，随手拾译，让所有人都能够拥有母语般的阅读体验。

## 🌟 特性

- **智能翻译**：支持 20+ 种翻译引擎，包括传统翻译和 AI 大模型。如：微软翻译、谷歌翻译、DeepL、OpenAI、DeepSeek、Kimi、Ollama、自定义引擎等。
- **双语对照**：支持原文与译文并列显示，让阅读更轻松。
- **划词翻译**：选中任意文本，即可获得即时翻译结果，一键复制译文，提高阅读效率。
- **全文翻译**：通过悬浮球一键翻译整个网页，无需刷新页面即可切换。
- **隐私保护**：所有数据本地存储，代码开源透明。
- **高度定制**：丰富的自定义选项，满足不同场景需求。
- **完全免费**：开源免费，非商业化项目。

<kbd><img src="./misc/sample-git-1.gif" alt="sample-git-1.gif" style="width: 80%; max-width: 100%;border: 1px solid black;"></kbd>

<kbd><img src="./misc/sample-git-4.gif" alt="sample-git-4.gif" style="width: 80%; max-width: 100%;border: 1px solid black;"></kbd>

<kbd><img src="./misc/highlight_trans.png" alt="highlight_trans.png" style="width: 80%; max-width: 100%;border: 1px solid black;"></kbd>

## 📦 安装

### 从源码构建

```bash
# 安装依赖
pnpm install

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

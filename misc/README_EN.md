# Glearn Translate (拾译)

> [中文](../README.md) | English

A browser translation plugin forked from [FluentRead](https://github.com/Bistutu/FluentRead), providing everyone with a native-like reading experience.

## 🌟 Features

- **Smart Translation**: Supports 20+ translation engines, including traditional translation and AI large language models, such as Microsoft Translator, Google Translate, DeepL, OpenAI, DeepSeek, Kimi, Ollama, custom engines, etc.
- **Bilingual Display**: Supports side-by-side display of original text and translation for easier reading.
- **Text Selection Translation**: Select any text to get instant translation, with one-click copying of translated content, improving reading efficiency.
- **Full Page Translation**: One-click translation of entire webpages via a floating ball, switchable without page refresh.
- **Privacy Protection**: All data is stored locally, with open-source and transparent code.
- **Highly Customizable**: Rich customization options to meet various use cases.
- **Completely Free**: Open-source and free, non-commercial project.

<kbd><img src="../misc/sample-git-1.gif" alt="sample-git-1.gif" style="width: 80%; max-width: 100%;border: 1px solid black;"></kbd>

<kbd><img src="../misc/sample-git-4.gif" alt="sample-git-4.gif" style="width: 80%; max-width: 100%;border: 1px solid black;"></kbd>

<kbd><img src="../misc/highlight_trans.png" alt="highlight_trans.png" style="width: 80%; max-width: 100%;border: 1px solid black;"></kbd>

## 📦 Installation

### Build from Source

```bash
# Install dependencies
pnpm install

# Build for Chrome
pnpm build

# Build for Firefox
pnpm build:firefox
```

The build output is in the `.output/` directory. Load the unpacked extension in your browser's extension management page.

## 📖 Documentation

Project documentation is in the [docs/](../docs/) directory, built with VitePress:

```bash
pnpm docs:dev     # Preview docs locally
pnpm docs:build   # Build docs
```

## 🛠 Tech Stack

- **Framework**: WXT + Vue 3 + TypeScript
- **UI**: Element Plus
- **Bundler**: Vite
- **Docs**: VitePress

## 📄 License

[Apache-2.0](../LICENSE)

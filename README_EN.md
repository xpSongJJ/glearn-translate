# Glearn Translate · 拾译

[中文](./README.md)

Glearn Translate is an AI browser extension for selected text and popup translation.

Supports OpenAI, DeepSeek, Qwen, Claude, Gemini, New API gateways and local services such as Ollama.

## Install

With Node.js and pnpm installed, run from the project directory:

```bash
pnpm install
pnpm build
```

- **Chrome / Edge**: enable developer mode in the extensions page and load `.output/chrome-mv3`.
- **Firefox**: run `pnpm build:firefox` and temporarily load `.output/firefox-mv2/manifest.json` through `about:debugging`. Reload it after closing the browser.

After updates, reload the extension and refresh existing webpages.

## Configure

Open **More**, choose a provider, then set the **API address, API key and model**. Addresses use provider defaults where available and can be edited for gateways or proxies. Select a model or enter its ID; the refresh icon retrieves available models. Settings save automatically.

Prefer a **non-reasoning model** to reduce translation wait times and improve the user experience.

Local services use **Custom endpoint** and may leave the API key empty if authentication is not required. Azure needs your own resource deployment address. See [provider configuration](./docs/configuration.md).

**Intelligent** translates predominantly Chinese text into English and other languages into Simplified Chinese. You can also select a target language explicitly.

Switch between **System Prompt / User Prompt** to edit or reset each. User Prompt supports `{{to}}` (empty in intelligent mode) and `{{origin}}`. Defaults request IPA after a single English word, whether it is the source or translation. See [features](./docs/features.md) for details.

## Develop

Built with WXT, Vue 3, TypeScript and Element Plus.

```bash
pnpm dev
pnpm compile
pnpm test
```

Use `pnpm dev:firefox` for Firefox development. For browser tests, run `pnpm build` followed by `pnpm test:browser`.

---

The extension is free and open source; AI providers may charge for usage. Settings and credentials stay in the current browser. Translation text and prompts go to the configured AI service, with credentials used for authentication. Cached translations are stored locally.

Based on [FluentRead](https://github.com/Bistutu/FluentRead) · [GPL-3.0](./LICENSE) · [FAQ](./docs/faq.md)

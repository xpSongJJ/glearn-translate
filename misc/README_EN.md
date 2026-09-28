# Glearn Translate

An open source AI translation extension based on FluentRead.

## Features

- AI providers including OpenAI, DeepSeek, Qwen, Claude, Gemini, New API and custom OpenAI compatible endpoints such as Ollama.
- Multiline text translation in the popup with streaming output, copy, retry and Ctrl / Cmd + Enter.
- Selected text translation with bilingual or translation only display.
- Provider, API key, endpoint and model settings under **More → Model API**, saved automatically.
- Light, dark and system themes, caching, custom prompts and configuration backups.
- Migration of existing AI settings. Machine translation, full page translation, paragraph hover translation, webpage input translation and the userscript version have been removed.

Keys are stored in your browser. Text and credentials are sent to your configured AI provider when translating. Provider charges may apply.

## Build

```bash
pnpm install
pnpm compile
pnpm test
pnpm build
pnpm build:firefox
```

Load the output from `.output/` as an unpacked extension. Set up a provider and model under More before translating.

See the [Chinese README](../README.md) for details.

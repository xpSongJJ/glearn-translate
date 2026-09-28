# 快速开始

## 构建安装

```bash
pnpm install
pnpm build
# Firefox
pnpm build:firefox
```

Chrome / Edge 在扩展管理页开启开发者模式，加载 `.output/chrome-mv3`。
Firefox 在 `about:debugging` 中临时加载 `.output/firefox-mv2/manifest.json`。

## 首次配置

1. 打开插件，点击底部“更多”。
2. 在“模型 API”选择服务，填写密钥和模型名称，或点击模型右侧的刷新图标获取模型列表。
3. 设置自动保存。点击“返回”，选择目标语言。
4. 输入或粘贴文本，按 Enter 翻译；Ctrl / ⌘ + Enter 换行。

网页划词翻译：选中文本后点击或悬停翻译圆点。卡片原样展示 AI 输出，内容与格式通过提示词调整。

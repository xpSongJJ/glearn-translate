# 模型 API 配置

所有配置位于插件底部“更多 → 模型 API”。只支持 AI 服务。

为减少翻译等待时间、提高使用体验，建议优先选择**非推理模型**。

## 通用服务

选择服务，填写 API Key，在模型框中搜索、选择或直接输入模型 ID，输入后按 Enter 确认。点击模型右侧的刷新图标可从服务商获取模型列表。
适用于 OpenAI、DeepSeek、千问、Kimi、智谱、Claude、Gemini 等。
API 地址默认显示服务的官方地址，无需单独配置代理；使用网关或代理时直接修改 API 地址。地址修改后，可点击右侧恢复图标恢复默认。旧版代理地址会继续显示和使用。Azure 的资源与部署地址需自行填写。

## 自定义接口 / Ollama

接口填写完整的 OpenAI 兼容地址，例如 `http://localhost:11434/v1/chat/completions`。
本地服务无需鉴权时 API Key 可留空。模型名称填写已安装或服务端可用的模型 ID。

## New API

填写网关根地址、`/v1` 地址或完整 `/chat/completions` 地址；插件会补全路径。
填写网关 API Key 与模型 ID。

## Azure OpenAI

填写 API Key、部署端点与模型名称。端点需要包含 `/chat/completions` 和对应的 API 版本查询参数。
使用 `api-key` 鉴权。部署模型手动填写，不提供模型列表获取。

## 文心一言、腾讯混元翻译、Coze

文心一言使用 API Key / Secret Key；腾讯混元翻译使用 Secret ID / Secret Key 和模型名称；Coze 使用访问令牌与机器人 ID。

配置不完整时，主界面会提示缺少的项目。

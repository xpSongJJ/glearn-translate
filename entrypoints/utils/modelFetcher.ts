// 自动拉取各翻译服务的模型列表
import { urls } from "@/entrypoints/utils/constant";
import { servicesType } from "@/entrypoints/utils/option";

export interface FetchModelsOptions {
    token: string;      // API Key / Bearer token
    proxy?: string;      // 代理地址
    ak?: string;         // 文心一言 Access Key
    sk?: string;         // 文心一言 Secret Key
}

// 从 chat completions URL 推导出 models 端点
function chatUrlToModelsUrl(chatUrl: string): string {
    return chatUrl.replace(/\/chat\/completions$/, '/models');
}

// ============ OpenAI 兼容提供商 ============
async function fetchOpenAICompatibleModels(chatUrl: string, token: string, proxy?: string): Promise<string[]> {
    const baseUrl = proxy || chatUrl;
    const modelsUrl = chatUrlToModelsUrl(baseUrl);

    const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
    };

    const resp = await fetch(modelsUrl, { method: 'GET', headers });
    if (!resp.ok) {
        throw new Error(`获取模型列表失败: ${resp.status} ${resp.statusText}`);
    }

    const result = await resp.json();
    // OpenAI 格式: { object: "list", data: [{ id: "model-name", ... }] }
    if (result.data && Array.isArray(result.data)) {
        return result.data
            .map((m: any) => m.id)
            .filter((id: string) => id && typeof id === 'string');
    }
    throw new Error('模型列表返回格式异常');
}

// ============ Claude / Anthropic ============
async function fetchClaudeModels(token: string, proxy?: string): Promise<string[]> {
    const modelsUrl = proxy
        ? chatUrlToModelsUrl(proxy)
        : 'https://api.anthropic.com/v1/models';

    const headers: HeadersInit = {
        'x-api-key': token,
        'anthropic-version': '2023-06-01',
    };

    const resp = await fetch(modelsUrl, { method: 'GET', headers });
    if (!resp.ok) {
        throw new Error(`获取 Claude 模型列表失败: ${resp.status} ${resp.statusText}`);
    }

    const result = await resp.json();
    // Anthropic 格式: { data: [{ id: "claude-sonnet-4-0", type: "model", ... }] }
    if (result.data && Array.isArray(result.data)) {
        return result.data
            .map((m: any) => m.id)
            .filter((id: string) => id && typeof id === 'string');
    }
    throw new Error('Claude 模型列表返回格式异常');
}

// ============ Gemini ============
async function fetchGeminiModels(token: string, _proxy?: string): Promise<string[]> {
    // Gemini 的 models 列表 API 不在代理路径下，用官方端点
    const modelsUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${token}`;

    const resp = await fetch(modelsUrl, { method: 'GET' });
    if (!resp.ok) {
        throw new Error(`获取 Gemini 模型列表失败: ${resp.status} ${resp.statusText}`);
    }

    const result = await resp.json();
    // Gemini 格式: { models: [{ name: "models/gemini-2.5-flash", ... }] }
    if (result.models && Array.isArray(result.models)) {
        return result.models
            .map((m: any) => {
                // name 格式 "models/gemini-2.5-flash" → 去掉 "models/" 前缀
                const name: string = m.name || '';
                return name.replace(/^models\//, '');
            })
            .filter((id: string) => id && typeof id === 'string');
    }
    throw new Error('Gemini 模型列表返回格式异常');
}

// ============ 文心一言（百度） ============
async function fetchYiyanModels(ak: string, sk: string): Promise<string[]> {
    // 先获取 access_token
    const tokenUrl = `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${ak}&client_secret=${sk}`;
    const tokenResp = await fetch(tokenUrl, { method: 'POST' });
    if (!tokenResp.ok) {
        throw new Error(`获取百度 access_token 失败: ${tokenResp.status}`);
    }
    const tokenResult = await tokenResp.json();
    const accessToken = tokenResult.access_token;
    if (!accessToken) {
        throw new Error(`百度 access_token 响应异常: ${JSON.stringify(tokenResult)}`);
    }

    // 拉取模型列表
    const modelsUrl = `https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/list?access_token=${accessToken}`;
    const modelsResp = await fetch(modelsUrl, { method: 'GET' });
    if (!modelsResp.ok) {
        throw new Error(`获取文心一言模型列表失败: ${modelsResp.status}`);
    }
    const modelsResult = await modelsResp.json();

    // 响应格式多样，尝试提取模型名
    if (modelsResult.result && Array.isArray(modelsResult.result)) {
        return modelsResult.result
            .map((m: any) => m.modelName || m.name || m.id)
            .filter((id: string) => id && typeof id === 'string');
    }
    if (modelsResult.data && Array.isArray(modelsResult.data)) {
        return modelsResult.data
            .map((m: any) => m.id || m.modelName || m.name)
            .filter((id: string) => id && typeof id === 'string');
    }
    throw new Error('文心一言模型列表返回格式异常');
}

// ============ 主入口 ============
/**
 * 根据服务类型拉取模型列表
 * @returns 模型名称数组，失败返回 null
 */
export async function fetchModels(
    service: string,
    opts: FetchModelsOptions
): Promise<string[] | null> {
    try {
        const chatUrl = urls[service];

        // 文心一言 / 腾讯云（需要 AK/SK 鉴权）
        if (servicesType.isUseAkSk(service)) {
            if (opts.ak && opts.sk) {
                return await fetchYiyanModels(opts.ak, opts.sk);
            }
            return null;
        }

        // Coze — 不走模型选择
        if (servicesType.isCoze(service)) {
            return null;
        }

        // Claude
        if (service === 'claude') {
            return await fetchClaudeModels(opts.token, opts.proxy);
        }

        // Gemini
        if (service === 'gemini') {
            return await fetchGeminiModels(opts.token, opts.proxy);
        }

        // 腾讯云机器翻译 / 腾讯混元翻译 — 非 OpenAI 兼容，跳过
        if (servicesType.isTencent(service)) {
            return null;
        }

        // 有道 / 小牛 — 传统机器翻译，无模型列表
        if (service === 'youdao' || service === 'xiaoniu') {
            return null;
        }

        // DeepL / DeepLX / 微软 / 谷歌 — 传统翻译，无模型列表
        if (servicesType.isMachine(service)) {
            return null;
        }

        // 其余走 OpenAI 兼容路径
        if (chatUrl && typeof chatUrl === 'string') {
            return await fetchOpenAICompatibleModels(chatUrl, opts.token, opts.proxy);
        }

        return null;
    } catch (e) {
        console.warn(`[Glearn] 拉取 ${service} 模型列表失败:`, e);
        return null;
    }
}

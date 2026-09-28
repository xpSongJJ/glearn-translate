import { generateToken } from './service/zhipu';
import { defineBackground } from 'wxt/utils/define-background';
import { browser } from 'wxt/browser';
import { openaiSSEStream } from './utils/sse';
import { getConfigurationError, contentPostHandler } from './utils/check';
import { translationEndpoint } from './utils/endpoint';
import { copyInBackground } from './utils/backgroundClipboard';
import {_service} from "@/entrypoints/service/_service";
import {config, configReady, saveConfig} from "@/entrypoints/utils/config";
import {services} from "@/entrypoints/utils/option";
import {commonMsgTemplate, deepseekMsgTemplate, qwenMsgTemplate, minimaxTemplate, zhipuMsgTemplate} from "@/entrypoints/utils/template";

export default defineBackground({
    persistent: {
        safari: false,
    },
    main() {
        browser.runtime.onMessage.addListener((message: any, _sender, sendResponse) => {
            if (message.type === 'open-settings') {
                const field = ['model', 'credentials', 'configuration'].includes(message.field) ? message.field : 'configuration';
                void browser.tabs.create({ url: browser.runtime.getURL(`/popup.html#settings-${field}`) }).then(
                    () => sendResponse({ success: true }),
                    () => sendResponse({ success: false, error: '无法打开配置，请点击插件图标进入“更多”' }),
                );
                return true;
            }
            if (message.type === 'copy-translation' && typeof message.text === 'string') {
                void copyInBackground(message.text).then(
                    () => sendResponse({ success: true }),
                    error => sendResponse({ success: false, error: error instanceof Error ? error.message : '复制失败' }),
                );
                return true;
            }
            if (typeof message.origin !== 'string') return;
            void (async () => {
                await configReady;
                const error = getConfigurationError();
                if (error) throw new Error(error);
                config.count++;
                void saveConfig().catch(error => console.error('Failed to save translation count:', error));
                return _service[config.service](message);
            })().then(sendResponse, error => sendResponse({ error: error instanceof Error ? error.message : '翻译失败' }));
            return true;
        });

        // 处理流式翻译请求（端口通信）
        const streamingServices = [
            services.openai, services.azureOpenai, services.moonshot, services.baichuan,
            services.lingyi, services.jieyue, services.groq, services.huanYuan,
            services.doubao, services.siliconCloud, services.openrouter, services.grok,
            services.deepseek, services.custom, services.newapi, services.zhipu,
            services.qwen, services.infini, services.minimax,
        ];
        
        browser.runtime.onConnect.addListener((port) => {
            if (port.name !== 'translate-stream') return;
            
            // 握手：告知 content 端端口已就绪
            port.postMessage({ ready: true });
            
            port.onMessage.addListener(async (message: any) => {
                await configReady;
                const configurationError = getConfigurationError();
                if (configurationError) {
                    port.postMessage({ error: configurationError, done: true });
                    return;
                }
                const svc = config.service;
                config.count++;
                void saveConfig().catch(error => console.error('Failed to save translation count:', error));
                
                // 仅流式兼容服务走流式路径，其余回退
                if (!streamingServices.includes(svc)) {
                    // 回退到非流式
                    try {
                        const result = await _service[svc](message);
                        port.postMessage({ chunk: result, done: true });
                    } catch (err) {
                        port.postMessage({ error: err instanceof Error ? err.message : String(err), source: 'service', done: true });
                    }
                    return;
                }
                
                const controller = new AbortController();
                const abort = () => controller.abort();
                port.onDisconnect.addListener(abort);
                try {
                    // 构建请求体
                    let body: string;
                    if (svc === services.deepseek) {
                        body = deepseekMsgTemplate(message.origin);
                    } else if (svc === services.qwen) {
                        body = qwenMsgTemplate(message.origin);
                    } else if (svc === services.minimax) {
                        body = minimaxTemplate(message.origin);
                    } else if (svc === services.zhipu) {
                        body = zhipuMsgTemplate(message.origin);
                    } else {
                        body = commonMsgTemplate(message.origin);
                    }
                    
                    // 注入 stream: true
                    const bodyObj = JSON.parse(body);
                    bodyObj.stream = true;
                    body = JSON.stringify(bodyObj);
                    
                    // 构建请求头和 URL
                    const headers = new Headers({
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${config.token[svc]}`
                    });
                    
                    if (svc === services.openrouter) {
                        headers.append('HTTP-Referer', 'https://fluent.thinkstu.com');
                        headers.append('X-Title', 'Glearn');
                    }
                    
                    if (svc === services.zhipu) {
                        const token = generateToken(config.token[svc]);
                        if (!token) throw new Error('智谱 API Key 格式错误');
                        headers.set('Authorization', `Bearer ${token}`);
                    }
                    if (svc === services.azureOpenai) {
                        headers.delete('Authorization');
                        headers.set('api-key', config.token[svc]);
                    }
                    const url = translationEndpoint(config);
                    
                    const resp = await fetch(url, {
                        method: 'POST',
                        headers,
                        signal: controller.signal,
                        body
                    });
                    
                    if (!resp.ok) {
                        const data = await resp.json().catch(() => null);
                        const detail = typeof data?.error?.message === 'string' ? data.error.message : '';
                        throw new Error(`翻译失败: ${resp.status} ${resp.statusText}${detail ? ` — ${detail}` : ''}`);
                    }
                    
                    if (!resp.headers.get('content-type')?.includes('text/event-stream')) {
                        const data = await resp.json();
                        const content = data.choices?.[0]?.message?.content;
                        if (typeof content !== 'string' || !content.trim()) throw new Error('翻译服务未返回译文');
                        port.postMessage({ chunk: contentPostHandler(content), done: true });
                        return;
                    }
                    let fullText = '';
                    for await (const event of openaiSSEStream(resp)) {
                        if (event.reasoning) port.postMessage({ reasoning: true });
                        if (event.content) {
                            fullText += event.content;
                            port.postMessage({ chunk: event.content, done: false });
                        }
                    }
                    if (!fullText.trim()) throw new Error('翻译服务未返回译文');
                    port.postMessage({ result: contentPostHandler(fullText), done: true });
                } catch (error) {
                    if (controller.signal.aborted) return;
                    console.error('Streaming translation error:', error);
                    port.postMessage({
                        error: error instanceof Error ? error.message : String(error),
                        source: 'service',
                        done: true
                    });
                } finally {
                    port.onDisconnect.removeListener(abort);
                }
            });
        });
    }
});

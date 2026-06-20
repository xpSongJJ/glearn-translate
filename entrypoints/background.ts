import {_service} from "@/entrypoints/service/_service";
import {config} from "@/entrypoints/utils/config";
import {CONTEXT_MENU_IDS, urls} from "@/entrypoints/utils/constant";
import {services} from "@/entrypoints/utils/option";
import {commonMsgTemplate, deepseekMsgTemplate, qwenMsgTemplate, minimaxTemplate, zhipuMsgTemplate} from "@/entrypoints/utils/template";

// 翻译状态管理
let translationStateMap = new Map<number, boolean>(); // tabId -> isTranslated

/**
 * 在background脚本中调用微软翻译API（避免Firefox CORS问题）
 */
async function translateWithMicrosoftInBackground(text: string, targetLang: string): Promise<string> {
    try {
        // 获取微软翻译的JWT令牌
        const jwtToken = await refreshMicrosoftTokenInBackground();

        // 调用微软翻译API
        const response = await fetch(`https://api-edge.cognitive.microsofttranslator.com/translate?from=&to=${targetLang}&api-version=3.0&includeSentenceLength=true&textType=html`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + jwtToken
            },
            body: JSON.stringify([{ Text: text }])
        });

        if (response.ok) {
            const result = await response.json();
            return result[0].translations[0].text;
        } else {
            throw new Error(`微软翻译失败: ${response.status} ${response.statusText}`);
        }
    } catch (error) {
        console.error('微软翻译请求失败:', error);
        throw error;
    }
}

/**
 * 在background脚本中刷新微软翻译令牌
 */
async function refreshMicrosoftTokenInBackground(): Promise<string> {
    try {
        const response = await fetch("https://edge.microsoft.com/translate/auth");
        if (response.ok) {
            return await response.text();
        } else {
            throw new Error(`获取微软翻译令牌失败: ${response.status} ${response.statusText}`);
        }
    } catch (error) {
        console.error('获取微软翻译令牌失败:', error);
        throw error;
    }
}

export default defineBackground({
    persistent: {
        safari: false,
    },
    main() {
        const isContextMenuSupported = !!browser.contextMenus

        // 创建右键菜单项
        if (isContextMenuSupported) {
            try {
                // 创建父菜单
                browser.contextMenus.create({
                    id: 'glearn-parent',
                    title: 'Glearn',
                    contexts: ['page', 'selection'],
                });

                // 创建全文翻译子菜单
                browser.contextMenus.create({
                    id: CONTEXT_MENU_IDS.TRANSLATE_FULL_PAGE,
                    title: '全文翻译',
                    parentId: 'glearn-parent',
                    contexts: ['page', 'selection'],
                });

                // 创建撤销翻译子菜单
                browser.contextMenus.create({
                    id: CONTEXT_MENU_IDS.RESTORE_ORIGINAL,
                    title: '撤销翻译',
                    parentId: 'glearn-parent',
                    contexts: ['page', 'selection'],
                    enabled: false, // 初始状态为禁用
                });

                // 监听右键菜单点击事件
                browser.contextMenus.onClicked.addListener((info: any, tab: any) => {
                    if (!tab?.id) return;

                    if (info.menuItemId === CONTEXT_MENU_IDS.TRANSLATE_FULL_PAGE) {
                        // 发送消息到内容脚本触发全文翻译
                        browser.tabs.sendMessage(tab.id, {
                            type: 'contextMenuTranslate',
                            action: 'fullPage'
                        }).then(() => {
                            // 更新翻译状态
                            translationStateMap.set(tab.id!, true);
                            updateContextMenus(tab.id!);
                        }).catch((error: any) => {
                            console.error('Failed to send message to content script:', error);
                        });
                    } else if (info.menuItemId === CONTEXT_MENU_IDS.RESTORE_ORIGINAL) {
                        // 发送消息到内容脚本撤销翻译
                        browser.tabs.sendMessage(tab.id, {
                            type: 'contextMenuTranslate',
                            action: 'restore'
                        }).then(() => {
                            // 更新翻译状态
                            translationStateMap.set(tab.id!, false);
                            updateContextMenus(tab.id!);
                        }).catch((error: any) => {
                            console.error('Failed to send message to content script:', error);
                        });
                    }
                });

            } catch (error) {
                console.error('Error setting up context menu:', error);
            }
        } else {
            console.log("不支持右键菜单")
        }

        // 更新右键菜单状态
        const updateContextMenus = (tabId: number) => {
            const isTranslated = translationStateMap.get(tabId) || false;

            try {
                // 更新全文翻译菜单项
                browser.contextMenus.update(CONTEXT_MENU_IDS.TRANSLATE_FULL_PAGE, {
                    enabled: !isTranslated,
                    title: isTranslated ? '全文翻译 (已翻译)' : '全文翻译'
                });
                // 更新撤销翻译菜单项
                browser.contextMenus.update(CONTEXT_MENU_IDS.RESTORE_ORIGINAL, {
                    enabled: isTranslated,
                    title: isTranslated ? '撤销翻译' : '撤销翻译 (无翻译)'
                });
            } catch (error) {
                console.error('Failed to update context menus:', error);
            }
        };

        // 监听标签页切换事件，更新菜单状态
        browser.tabs.onActivated.addListener((activeInfo: any) => {
            if (isContextMenuSupported) updateContextMenus(activeInfo.tabId);
        });

        // 监听标签页更新事件（页面刷新等）
        browser.tabs.onUpdated.addListener((tabId: any, changeInfo: any) => {
            if (changeInfo.status === 'complete') {
                // 页面加载完成，重置翻译状态
                translationStateMap.set(tabId, false);
                if (isContextMenuSupported) updateContextMenus(tabId);
            }
        });

        // 监听标签页关闭事件，清理状态
        browser.tabs.onRemoved.addListener((tabId: any) => {
            translationStateMap.delete(tabId);
        });

        // 处理翻译请求
        browser.runtime.onMessage.addListener((message: any) => {
            return new Promise(async (resolve, reject) => {
                try {
                    // 处理输入框翻译请求
                    if (message.type === 'inputBoxTranslation') {
                        const translatedText = await translateWithMicrosoftInBackground(message.text, message.targetLang);
                        resolve({ success: true, translatedText });
                        return;
                    }

                    // 处理普通翻译请求
                    _service[config.service](message)
                        .then(resp => resolve(resp))    // 成功
                        .catch(error => reject(error)); // 失败
                } catch (error) {
                    resolve({ success: false, error: error instanceof Error ? error.message : String(error) });
                }
            });
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
                const svc = config.service;
                
                // 仅流式兼容服务走流式路径，其余回退
                if (!streamingServices.includes(svc)) {
                    // 回退到非流式
                    try {
                        const result = await _service[svc](message);
                        port.postMessage({ chunk: result, done: true });
                    } catch (err) {
                        port.postMessage({ error: err instanceof Error ? err.message : String(err), done: true });
                    }
                    return;
                }
                
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
                    
                    const url = config.proxy[svc] || urls[svc];
                    
                    const resp = await fetch(url, {
                        method: 'POST',
                        headers,
                        body
                    });
                    
                    if (!resp.ok) {
                        throw new Error(`翻译失败: ${resp.status} ${resp.statusText}`);
                    }
                    
                    // 流式读取 SSE 并逐块发送
                    const reader = resp.body?.getReader();
                    if (!reader) throw new Error('Response body is not readable');
                    
                    const decoder = new TextDecoder();
                    let buffer = '';
                    
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        
                        buffer += decoder.decode(value, { stream: true });
                        const lines = buffer.split('\n');
                        buffer = lines.pop() || '';
                        
                        for (const line of lines) {
                            const trimmed = line.trim();
                            if (!trimmed.startsWith('data: ')) continue;
                            
                            const data = trimmed.slice(6).trim();
                            if (data === '[DONE]') {
                                port.postMessage({ chunk: '', done: true });
                                return;
                            }
                            
                            try {
                                const parsed = JSON.parse(data);
                                const delta = parsed.choices?.[0]?.delta;
                                const content = delta?.content;
                                const reasoning = delta?.reasoning_content;
                                // 思考内容（推理模型）：仅通知 timing，不显示
                                if (reasoning) {
                                    port.postMessage({ reasoning: true });
                                }
                                // 真正的译文内容
                                if (content) {
                                    port.postMessage({ chunk: content, done: false });
                                }
                            } catch { /* skip unparseable lines */ }
                        }
                    }
                    
                    port.postMessage({ chunk: '', done: true });
                } catch (error) {
                    console.error('Streaming translation error:', error);
                    port.postMessage({
                        error: error instanceof Error ? error.message : String(error),
                        done: true
                    });
                }
            });
        });
    }
});

import type { Config } from './model';
import { customModelString, services, servicesType } from './option';
import { config } from './config';

export function getConfigurationError(settings: Config = config): string {
    if (!settings.on) return '插件已暂停，请先开启插件';
    const service = settings.service;
    if (!servicesType.isAI(service)) return '请选择 AI 翻译服务';
    if (servicesType.isUseToken(service) && service !== services.custom && !settings.token[service]?.trim()) {
        return '请在“更多 → 模型 API”中填写 API Key';
    }
    if (servicesType.isUseAkSk(service) && (!settings.ak.trim() || !settings.sk.trim())) {
        return '请在“更多 → 模型 API”中填写 API Key 和 Secret Key';
    }
    if (servicesType.isTencent(service) && (!settings.tencentSecretId.trim() || !settings.tencentSecretKey.trim())) {
        return '请在“更多 → 模型 API”中填写 Secret ID 和 Secret Key';
    }
    if (servicesType.isCoze(service) && !settings.robot_id[service]?.trim()) return '请在“更多”中填写机器人 ID';
    if (servicesType.isUseModel(service)) {
        const model = settings.model[service] === customModelString ? settings.customModel[service] : settings.model[service];
        if (!model?.trim()) return '请在“更多 → 模型 API”中选择或填写模型名称';
    }
    const endpoint = service === services.custom ? settings.custom
        : service === services.newapi ? settings.newApiUrl
        : service === services.azureOpenai ? settings.azureOpenaiEndpoint : settings.proxy[service];
    if (servicesType.isUseCustomUrl(service) && !endpoint?.trim()) return '请在“更多”中填写接口地址';
    if (endpoint) {
        try {
            const url = new URL(endpoint);
            if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
            if (service === services.azureOpenai && !url.pathname.endsWith('/chat/completions')) throw new Error();
        } catch {
            return '接口地址无效，请填写完整的 HTTP / HTTPS 地址';
        }
    }
    return '';
}

export function contentPostHandler(text: string) {
    return text.replace(/^<think>[\s\S]*?<\/think>/, '').trim();
}

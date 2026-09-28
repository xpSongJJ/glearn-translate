import type { Config } from './model';
import { urls } from './constant';
import { services, customModelString } from './option';

export function newApiEndpoint(baseUrl: string): string {
    const url = new URL(baseUrl.trim());
    const path = url.pathname.replace(/\/+$/, '');
    url.pathname = path.endsWith('/chat/completions') ? path
        : path.endsWith('/v1') ? `${path}/chat/completions` : `${path}/v1/chat/completions`;
    return url.toString();
}

export function translationEndpoint(settings: Config): string {
    const model = settings.model[settings.service] === customModelString ? settings.customModel[settings.service] : settings.model[settings.service];
    if (settings.service === services.infini) return `https://cloud.infini-ai.com/maas/${model}/nvidia/chat/completions`;
    if (settings.service === services.minimax) return `https://api.minimax.chat/v1/text/${model}`;
    if (settings.service === services.custom) return settings.custom;
    if (settings.service === services.newapi) return newApiEndpoint(settings.newApiUrl);
    if (settings.service === services.azureOpenai) return settings.azureOpenaiEndpoint;
    return settings.proxy[settings.service] || urls[settings.service];
}

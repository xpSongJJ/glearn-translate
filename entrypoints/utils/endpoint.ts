import type { Config } from './model';
import { urls } from './constant';
import { services, customModelString, defaultOption } from './option';

export function defaultApiAddress(settings: Config): string {
    if (settings.service === services.custom) return defaultOption.custom;
    if (settings.service === services.newapi) return defaultOption.newApiUrl;
    // Azure addresses depend on the user's resource and deployment.
    if (settings.service === services.azureOpenai) return '';
    if (settings.service === services.gemini) {
        const model = settings.model[settings.service] === customModelString ? settings.customModel[settings.service] : settings.model[settings.service];
        return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model || '{model}')}:generateContent`;
    }
    return typeof urls[settings.service] === 'string' ? urls[settings.service] : '';
}

export function configuredApiAddress(settings: Config): string {
    if (settings.service === services.custom) return settings.custom;
    if (settings.service === services.newapi) return settings.newApiUrl;
    if (settings.service === services.azureOpenai) return settings.azureOpenaiEndpoint;
    return settings.proxy[settings.service] || defaultApiAddress(settings);
}

export function setApiAddress(settings: Config, value: string) {
    if (settings.service === services.custom) settings.custom = value;
    else if (settings.service === services.newapi) settings.newApiUrl = value;
    else if (settings.service === services.azureOpenai) settings.azureOpenaiEndpoint = value;
    else settings.proxy[settings.service] = value === defaultApiAddress(settings) ? '' : value;
}

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

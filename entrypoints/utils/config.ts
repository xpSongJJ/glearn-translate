import { reactive } from 'vue';
import { storage } from '@wxt-dev/storage';
import { Config } from './model';
import { servicesType } from './option';

/** Merge supported settings only, so old backups cannot restore removed features. */
export function normalizeConfig(value: unknown): Config {
    const result = new Config();
    if (!value || typeof value !== 'object' || Array.isArray(value)) return result;
    const source = value as Record<string, unknown>;
    for (const key of Object.keys(result) as (keyof Config)[]) {
        const fallback = result[key];
        const candidate = source[key];
        if (fallback && typeof fallback === 'object') {
            if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
                const entries = Object.entries(candidate).filter(([service, item]) =>
                    servicesType.isAI(service) && (key === 'extra' || typeof item === 'string'));
                Object.assign(fallback, Object.fromEntries(entries));
            }
        } else if (typeof candidate === typeof fallback) {
            (result as any)[key] = candidate;
        }
    }
    if (!servicesType.isAI(result.service)) {
        result.service = Object.keys(result.token).find(service => result.token[service]?.trim()) || result.service;
        if (!servicesType.isAI(result.service)) result.service = new Config().service;
    }
    if (!['auto', 'light', 'dark'].includes(result.theme)) result.theme = 'auto';
    if (!['disabled', 'bilingual', 'translation-only'].includes(result.selectionTranslatorMode)) {
        result.selectionTranslatorMode = 'bilingual';
    }
    if (source.disableSelectionTranslator === true) result.selectionTranslatorMode = 'disabled';
    result.count = Number.isFinite(result.count) ? Math.max(0, Math.floor(result.count)) : 0;
    return result;
}

export const config = reactive(new Config());
export const configReady = loadConfig();

async function loadConfig() {
    try {
        const stored = await storage.getItem('local:config');
        const normalized = normalizeConfig(typeof stored === 'string' ? JSON.parse(stored) : stored);
        Object.assign(config, normalized);
        const serialized = JSON.stringify(normalized);
        if (serialized !== stored) await storage.setItem('local:config', serialized);
    } catch (error) {
        console.error('Failed to load translation settings:', error);
    }
}

storage.watch('local:config', value => {
    try {
        if (typeof value === 'string') Object.assign(config, normalizeConfig(JSON.parse(value)));
    } catch (error) {
        console.error('Failed to update translation settings:', error);
    }
});

export async function saveConfig() {
    await storage.setItem('local:config', JSON.stringify(normalizeConfig(config)));
}

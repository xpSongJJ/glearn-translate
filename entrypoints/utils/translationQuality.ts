// Match only dictionary responses, so prose, URLs, code and custom output stay intact.
export function formatDictionaryPartsOfSpeech(result: string): string {
    const newline = result.indexOf('\n');
    if (newline < 0 || !/^[\p{Script=Latin}\p{M}][^\n]*\/[^/\n]+\//u.test(result.slice(0, newline))) return result;
    const partsOfSpeech = '(?:aux\\.\\s*v|modal\\.\\s*v|n|v|vt|vi|adj|adv|pron|prep|conj|interj|int|art|det|num|aux|modal|abbr|phr)\\.';
    const separator = new RegExp('(^|[；; \\t]+|\\r?\\n[ \\t]*)(' + partsOfSpeech + ')(?=[ \\t]|[\\p{Script=Han}])', 'gu');
    const body = result.slice(newline + 1).replace(separator, (_, prefix: string, label: string) =>
        (!prefix || prefix.includes('\n') ? prefix : '\n') + label);
    return result.slice(0, newline + 1) + body;
}

/** Only reject objectively wrong direction/format, not legitimate synonyms. */
export function translationQualityIssue(origin: string, result: string, target: string): string {
    const source = origin.trim();
    const meaningful = source.replace(/^[\p{P}\s]+|[\p{P}\s]+$/gu, '');
    // Identifiers, URLs, numbers and punctuation legitimately have no translation.
    const preserved = /^(?:https?:\/\/\S+|[\p{L}\p{N}]+(?:_[\p{L}\p{N}]+)+|[\p{N}\p{P}\s]+)$/u.test(meaningful)
        || /^[A-Za-z]*[a-z][A-Z][A-Za-z]*$/.test(meaningful)
        || /^(?:const|let|var)\s+[\w$]+\s*=/.test(source)
        || /^`[^`]+`$/.test(source);
    if (target !== 'zh-Hans' || preserved || !/\p{L}/u.test(source)) return '';
    if (!/\p{Script=Han}/u.test(result)) {
        return 'The target is Simplified Chinese (zh-Hans). The previous response contains no Chinese translation. Translate the source into Chinese; do not echo it or give English-only definitions. Keep a single English headword with IPA only when the dictionary rule applies.';
    }
    if (/\s/u.test(meaningful) && /^[A-Za-z][^\n]*\/[^/\n]+\/[^\n]*\n/u.test(result)) {
        return 'The source contains multiple written words. Return only the Chinese translation of the entire phrase/sentence, without an English headword, IPA or dictionary entry.';
    }
    return '';
}

export async function translateWithQualityCheck(options: {
    origin: string;
    target: string;
    enabled: boolean;
    request: (correction: string, previous: string) => Promise<string>;
    onRetry?: () => void;
}): Promise<string> {
    let previous = '';
    let correction = '';
    for (let attempt = 0; attempt < 2; attempt++) {
        const raw = await options.request(correction, previous);
        const result = options.enabled ? formatDictionaryPartsOfSpeech(raw) : raw;
        correction = options.enabled ? translationQualityIssue(options.origin, result, options.target) : '';
        if (!correction) return result;
        if (attempt === 0) { previous = result; options.onRetry?.(); }
    }
    throw new Error('翻译服务未按目标语言或格式返回译文，请重试');
}

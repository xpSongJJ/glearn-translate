// 防抖限流函数，可传递参数
import {franc} from "franc-min";

export const DEFAULT_TARGET_LANGUAGE = "default";

// 输出标准的语言类型，franc 只返回最可信的结果，francAll 返回所有结果并包含确信度
export function detectlang(origin: string): string {
    const find = franc(origin, {minLength: 0});
    // 返回对应的标准语言代码
    switch (find) {
        case "cmn":
            return "zh-Hans";
        case "eng":
            return "en";
        case "jpn":
            return "ja";
        case "kor":
            return "ko";
        case "fra":
            return "fr";
        case "rus":
            return "ru";
        default:
            return find; // 返回其他语言的识别结果
    }
}

export function isDefaultTargetLanguage(language: string): boolean {
    return language === DEFAULT_TARGET_LANGUAGE;
}

export function isChineseLanguage(language: string): boolean {
    return language === "zh-Hans" || language === "zh-Hant" || language === "zh" || language === "cmn";
}

export function resolveTargetLanguage(origin: string, targetLanguage: string): string {
    if (!isDefaultTargetLanguage(targetLanguage)) return targetLanguage;

    const detectedLanguage = detectlang(origin.replace(/[\s\u3000]/g, ""));
    return isChineseLanguage(detectedLanguage) ? "en" : "zh-Hans";
}

export function getPromptTargetLanguage(origin: string, targetLanguage: string): string {
    if (!isDefaultTargetLanguage(targetLanguage)) return targetLanguage;

    const resolvedLanguage = resolveTargetLanguage(origin, targetLanguage);
    return resolvedLanguage === "en" ? "English" : "Chinese";
}

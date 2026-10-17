// 消息模板工具
import {customModelString, defaultOption, services} from "./option";
import {config} from "@/entrypoints/utils/config";
import {getPromptTargetLanguage, isDefaultTargetLanguage, resolveTargetLanguage} from "@/entrypoints/utils/common";
import {selectionFormatInstruction} from './translationPrompt';

function fillUserPrompt(origin: string): string {
    const template = config.user_role[config.service] || defaultOption.user_role;
    const target = getPromptTargetLanguage(origin, config.to);
    // One pass prevents selected text such as "{{to}}" from becoming a directive.
    const filled = template.replace(/\{\{(to|origin)\}\}/g, (_, key: string) =>
        key === 'to' ? target : template === defaultOption.user_role ? JSON.stringify(origin) : origin);
    const marker = 'Source text (JSON string; decode the string and translate its contents):\n';
    const prompt = template === defaultOption.user_role
        ? filled.replace(marker, () => selectionFormatInstruction(origin, target) + marker)
        : filled;
    // Custom prompts receive the same concrete smart-mode target as defaults.
    return isDefaultTargetLanguage(config.to)
        ? `Intelligent mode resolved target language: ${target}. Translate into this language; do not redetect or reverse the translation direction.\n\n` + prompt
        : prompt;
}

// openai 格式的消息模板（通用模板）
export function commonMsgTemplate(origin: string) {
    // 检测是否使用自定义模型
    let model = config.model[config.service] === customModelString ? config.customModel[config.service] : config.model[config.service]

    // 删除模型名称中的中文括号及其内容，如"gpt-4（推荐）" -> "gpt-4"
    model = model.replace(/（.*）/g, "");

    let system = config.system_role[config.service] || defaultOption.system_role;
    let user = fillUserPrompt(origin);

    return JSON.stringify({
        'model': model,
        "temperature": 0.2,
        'messages': [
            {'role': 'system', 'content': system},
            {'role': 'user', 'content': user},
        ],
        // 翻译场景不需要思考，通过 extra_body 透传给上游
        'extra_body': {
            'enable_thinking': false,              // 千问
            'thinking': { 'type': 'disabled' },    // DeepSeek
        },
    })
}

// deepseek
export function deepseekMsgTemplate(origin: string) {
    // 检测是否使用自定义模型
    let model = config.model[config.service] === customModelString ? config.customModel[config.service] : config.model[config.service]

    // 删除模型名称中的中文括号及其内容，如"gpt-4（推荐）" -> "gpt-4"
    model = model.replace(/（.*）/g, "");

    let system = config.system_role[config.service] || defaultOption.system_role;
    let user = fillUserPrompt(origin);

    const payload: any = {
        'model': model,
        'messages': [
            {'role': 'system', 'content': system},
            {'role': 'user', 'content': user},
        ],
        temperature: 0.2,
        // 翻译场景不需要思考，显式禁用
        thinking: { type: 'disabled' },                        // 直连 DeepSeek API
        'extra_body': { thinking: { type: 'disabled' } },      // 经代理透传
    };

    return JSON.stringify(payload);
}

// gemini
export function geminiMsgTemplate(origin: string) {
    let user = fillUserPrompt(origin);

    return JSON.stringify({
        "contents": [
            {"role": "user", "parts": [{"text": user}]},
        ]
    })
}

// claude
export function claudeMsgTemplate(origin: string) {
    let model = config.model[services.claude] === customModelString ? config.customModel[services.claude] : config.model[services.claude];
    if (model === "claude-3-5-haiku") model = "claude-3-5-haiku-20241022";
    else if (model === "claude-3-5-sonnet") model = "claude-3-5-sonnet-20241022";
    else if (model === "claude-3-opus") model = "claude-3-opus-20240229";

    let system = config.system_role[config.service] || defaultOption.system_role;
    let user = fillUserPrompt(origin);

    return JSON.stringify({
        model: model,
        max_tokens: 4096,
        stream: false,
        system: system,
        messages: [
            {role: "user", content: user},
        ]
    })
}

// 通义千问
export function qwenMsgTemplate(origin: string) {
    let model = config.model[config.service] === customModelString ? config.customModel[config.service] : config.model[config.service]
    const normalTemplate = () => {
        let system = config.system_role[config.service] || defaultOption.system_role;
        let user = fillUserPrompt(origin);

        return JSON.stringify({
            "model": model,
            "enable_thinking": false,                        // 直连 DashScope
            "extra_body": { "enable_thinking": false },      // 经代理透传
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ]
        })
    }
    // 翻译模型qwen-mt-plus和qwen-mt-turbo的格式和通用的不同
    const mtModelTemplate = () => {
        const langMap = [
            {value: "zh-Hans", target: "zh"},
            {value: "en"},
            {value: "ja"},
            {value: "ko"},
            {value: "fr"},
            {value: "ru"},
        ]
        let targetItem = langMap.find(i => i.value === resolveTargetLanguage(origin, config.to)) || langMap[0]
        let targetLang = targetItem.target || targetItem.value
        return JSON.stringify({
            "model": model,
            "messages": [
                {"role": "user", "content": origin},
            ],
            "translation_options": {
                "source_lang": "auto",
                "target_lang": targetLang
            }
        })
    }
    return model.startsWith("qwen-mt") ? mtModelTemplate() : normalTemplate()

}

// 文心一言
export function yiyanMsgTemplate(origin: string) {
    let user = fillUserPrompt(origin);

    return JSON.stringify({
        'temperature': 0.2,
        'disable_search': true, // 禁用搜索
        'messages': [
            {"role": "user", "content": user},
        ],
    })
}

export function minimaxTemplate(origin: string) {

    let system = config.system_role[config.service] || defaultOption.system_role;
    let user = fillUserPrompt(origin);

    return JSON.stringify({
        model: config.model[config.service] === customModelString ? config.customModel[config.service] : config.model[config.service],
        stream: false,
        temperature: 0.2,
        messages: [
            {role: 'system', content: system},
            {role: 'user', content: user},
        ]
    })
}

export function cozeTemplate(origin: string) {

    let system = config.system_role[config.service] || defaultOption.system_role;
    let user = fillUserPrompt(origin);

    return JSON.stringify({
        bot_id: config.robot_id[config.service],
        user: "Glearn",
        query: system + user,
        stream: false
    });
}

// 智谱清言
export function zhipuMsgTemplate(origin: string) {
    let model = config.model[config.service] === customModelString ? config.customModel[config.service] : config.model[config.service];
    model = model.replace(/（.*）/g, "");

    let system = config.system_role[config.service] || defaultOption.system_role;
    let user = fillUserPrompt(origin);

    return JSON.stringify({
        'model': model,
        'messages': [
            {'role': 'system', 'content': system},
            {'role': 'user', 'content': user},
        ],
        temperature: 0.2,
        thinking: { type: 'disabled' },                        // 直连智谱 API
        'extra_body': { thinking: { type: 'disabled' } },      // 经代理透传
    });
}

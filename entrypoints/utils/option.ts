export const services = {
    // AI 翻译
    openai: "openai",
    azureOpenai: "azureOpenai", // Azure OpenAI
    gemini: "gemini",
    yiyan: "yiyan",
    qwen: "qwen",
    zhipu: "zhipu",
    moonshot: "moonshot",
    claude: "claude",
    custom: "custom",
    infini: "infini",
    // baidu: 'baidu',
    baichuan: "baichuan",
    lingyi: "lingyi",
    deepseek: "deepseek",
    minimax: "minimax",
    jieyue: "jieyue", // 阶跃星辰
    groq: "groq",
    cozecom: "cozecom", // coze 支持机器人不支持模型
    cozecn: "cozecn",
    huanYuan: "huanYuan", // 腾讯混元
    huanYuanTranslation: "huanYuanTranslation", // 腾讯混元翻译大模型
    doubao: "doubao", // 字节豆包
    siliconCloud: "siliconCloud", // 硅流
    openrouter: "openrouter", // openrouter
    grok: "grok", // X.AI 的 Grok
    newapi: "newapi", // New API 接口
};

export const servicesType = {
    // 阵营划分
    AI: new Set([
        services.openai,
        services.azureOpenai,
        services.gemini,
        services.yiyan,
        services.qwen,
        services.zhipu,
        services.moonshot,
        services.claude, services.custom,
        services.infini,
        services.baichuan,
        services.deepseek,
        services.lingyi,
        services.minimax,
        services.jieyue,
        services.groq,
        services.cozecom,
        services.cozecn,
        services.huanYuan,
        services.huanYuanTranslation,
        services.doubao,
        services.siliconCloud,
        services.openrouter,
        services.grok,
        services.newapi,
    ]),
    // 需要 token
    useToken: new Set([
        services.openai,
        services.azureOpenai,
        services.gemini,
        services.qwen,
        services.zhipu,
        services.moonshot,
        services.claude,
        services.infini,
        services.baichuan,
        services.deepseek,
        services.lingyi,
        services.minimax,
        services.jieyue,
        services.groq,
        services.custom,
        services.cozecom,
        services.cozecn,
        services.huanYuan,
        services.doubao,
        services.siliconCloud,
        services.openrouter,
        services.grok,
        services.newapi,
    ]),
    // 需要 model
    useModel: new Set([
        services.openai,
        services.azureOpenai,
        services.gemini,
        services.yiyan,
        services.qwen,
        services.zhipu,
        services.moonshot,
        services.claude,
        services.custom,
        services.infini,
        services.baichuan,
        services.deepseek,
        services.lingyi,
        services.minimax,
        services.jieyue,
        services.groq,
        services.huanYuan,
        services.huanYuanTranslation,
        services.doubao,
        services.siliconCloud,
        services.openrouter,
        services.grok,
        services.newapi,
    ]),
    // 支持代理
    useProxy: new Set([
        services.openai,
        services.azureOpenai,
        services.gemini,
        services.claude,
        services.moonshot,
        services.qwen,
        services.baichuan,
        services.deepseek,
        services.lingyi,
        services.jieyue,
        services.groq,
        services.cozecom,
        services.cozecn,
        services.huanYuan,
        services.huanYuanTranslation,
        services.doubao,
        services.siliconCloud,
        services.openrouter,
        services.grok,
    ]),
    // 支持自定义 URL 的服务
    useCustomUrl: new Set([
        services.custom,
        services.newapi,
        services.azureOpenai,
    ]),

    isAI: (service: string) => servicesType.AI.has(service),
    isUseToken: (service: string) => servicesType.useToken.has(service),
    isUseProxy: (service: string) => servicesType.useProxy.has(service),
    isUseModel: (service: string) => servicesType.useModel.has(service),
    isCustom: (service: string) => service === services.custom,
    isNewApi: (service: string) => service === services.newapi,
    isUseAkSk: (service: string) => service === services.yiyan,
    isCoze: (service: string) => service === services.cozecom || service === services.cozecn,
    isTencent: (service: string) => service === services.huanYuanTranslation,
    isAzureOpenai: (service: string) => service === services.azureOpenai,
    isUseCustomUrl: (service: string) => servicesType.useCustomUrl.has(service),
};

export const customModelString = "自定义模型";

export const options = {
    on: [
        {value: true, label: "开启"},
        {value: false, label: "关闭"},
    ],
    // 是否使用缓存
    useCache: [
        {value: true, label: "开启"},
        {value: false, label: "关闭"},
    ],
    form: [{value: "auto", label: "自动检测"}],
    to: [
        {value: "", label: "智能"},
        {value: "zh-Hans", label: "中文"},
        {value: "en", label: "英语"},
        {value: "ja", label: "日语"},
        {value: "ko", label: "韩语"},
        {value: "fr", label: "法语"},
        {value: "ru", label: "俄语"},
    ],
    services: [
        {value: services.siliconCloud, label: "硅基流动"},
        {value: services.huanYuan, label: "腾讯混元"},
        {value: services.newapi, label: "New API"},
        {value: services.deepseek, label: "DeepSeek"},
        {value: services.openai, label: "OpenAI"},
        {value: services.azureOpenai, label: "Azure OpenAI"},
        {value: services.huanYuanTranslation, label: "腾讯混元翻译"},
        {value: services.qwen, label: "千问"},
        {value: services.doubao, label: "字节豆包"},
        {value: services.grok, label: "Grok (X.AI)"},
        {value: services.openrouter, label: "OpenRouter"},
        {value: services.groq, label: "Groq"},
        {value: services.moonshot, label: "Kimi"},
        {value: services.zhipu, label: "智谱清言"},
        {value: services.baichuan, label: "百川智能"},
        {value: services.lingyi, label: "零一万物"},
        {value: services.minimax, label: "MiniMax"},
        {value: services.jieyue, label: "阶跃星辰"},
        {value: services.infini, label: "无向芯穹"},
        {value: services.cozecom, label: "Coze国际"},
        {value: services.cozecn, label: "Coze国内"},
        {value: services.claude, label: "Claude"},
        {value: services.gemini, label: "Gemini"},
        {value: services.yiyan, label: "文心一言"},
        {value: services.custom, label: "自定义接口"},
    ],
    theme: [
        {value: "auto", label: "跟随操作系统"},
        {value: "light", label: "亮色主题"},
        {value: "dark", label: "暗色主题"},
    ],

};

export const previousDefaultSystemPrompt = 'You are a professional translation engine. Produce output that reads as if originally written in the target language — restructure sentences where needed, use idiomatic expressions, and avoid translationese. Output only the translation result.';
export const previousDefaultUserPrompt = `Target language: {{to}}
Translate the following text into the target language. Only when the target language is empty, use intelligent mode: determine the predominant language of the source text; translate predominantly Chinese text into English and all other languages into Simplified Chinese. For mixed-language text, use its predominant language. If translation is unnecessary (e.g. proper nouns, codes, etc.), return the original text. NO explanations. NO notes:

{{origin}}`;

export const previousPhoneticUserPrompt = previousDefaultUserPrompt.replace('\n\n{{origin}}', `

Single-word exception: if the entire source is a single English word (ignoring surrounding whitespace and punctuation), return the word followed by its standard IPA transcription in /slashes/, then concise translated meanings on the next line. If British and American pronunciations differ, label them UK and US; otherwise give one transcription. For words with different pronunciations by part of speech, label the relevant part of speech. Do not invent pronunciations for codes, abbreviations or unknown names. Do not add examples or commentary. For phrases, sentences and paragraphs, return only the translation without IPA.

{{origin}}`);

export const previousPhoneticSystemPrompt = `${previousDefaultSystemPrompt} Exception: when the entire source is a single English word, also provide its standard IPA pronunciation and concise translated meanings. Do not add pronunciation to phrases, sentences or paragraphs.`;
export const previousCompactUserPrompt = previousDefaultUserPrompt.replace('\n\n{{origin}}', `

Single-word exception: if the entire source is a single English word (ignoring surrounding whitespace and punctuation), output compact plain text. First line: the source word immediately followed by its standard IPA transcription in /slashes/ on the SAME line. When British and American pronunciations differ, place UK before the British transcription and US before the American transcription, both after the word on that same line. When they are identical, give one transcription without region labels. Next line: part of speech and concise translated meanings. If pronunciation varies by part of speech, use a separate two-line group for each relevant part of speech, with that part of speech beside its pronunciation. Include the source word only once per group. Never place an IPA transcription or a region label on a separate line. Do not use headings, separators, tables, Markdown or code fences. Do not invent pronunciations for codes, abbreviations or unknown names. Do not add examples or commentary. For phrases, sentences and paragraphs, return only the translation without IPA.

{{origin}}`);

export const defaultOption = {
    on: true,
    from: "auto",
    to: "",
    custom: "http://localhost:11434/v1/chat/completions",
    newApiUrl: "http://localhost:3000",
    service: services.deepseek,
    system_role:
        `${previousDefaultSystemPrompt} Mandatory dictionary-entry exception: when the source is a single English word OR the translation is a single English word, place the English word immediately followed by its standard IPA transcription on the same line. This applies equally to Chinese-to-English and English-to-Chinese, in intelligent and explicitly selected language modes. A non-English source is never a reason to omit IPA from a single-word English translation. Keep full-sentence and paragraph translations free of IPA.`,
    user_role: previousDefaultUserPrompt.replace('\n\n{{origin}}', `

Mandatory single-word format (overrides the translation-only rule above): evaluate BOTH the source and the translated result, ignoring surrounding whitespace and punctuation. Apply this format if the source is one English word OR if the translated result is one English word. In particular, when a Chinese word translates to an English word, the ENGLISH TRANSLATION MUST include IPA; do not restrict IPA to English source text. Apply the same rule in intelligent mode and when English is explicitly selected.
First line: the English word (source word for English-to-other-language, translated word for other-language-to-English) immediately followed by its standard IPA transcription in /slashes/ on the SAME line. When British and American pronunciations differ, use WORD UK /IPA/ US /IPA/; otherwise use WORD /IPA/ without region labels. Next line: part of speech and concise translated meanings; for translation into English, a brief source-language gloss may accompany the part of speech. If offering several single-word English equivalents, put each English word with its own IPA. If pronunciation varies by part of speech, use a separate compact group for each relevant part of speech, with that part of speech beside its pronunciation. Include the English word only once per group. Never put IPA or a region label on a separate line. Do not use headings, separators, tables, Markdown or code fences. Do not invent pronunciations for codes, abbreviations or unknown names. Do not add examples or commentary. Full English phrases, sentences and paragraphs must not have IPA appended to every word.
Final check before responding: if the output is a single-word English translation, verify that the English word is immediately followed by IPA on the same line. An English word alone is an incomplete response.

{{origin}}`),
    count: 0,
    useCache: true,
};


import {method, urls} from "../utils/constant";
import {services} from "../utils/option";
import {config} from "@/entrypoints/utils/config";
import {resolveTargetLanguage} from "@/entrypoints/utils/common";

async function xiaoniu(message: any) {
    // 根据需要调整目标语言
    const resolvedTargetLanguage = resolveTargetLanguage(message.origin, config.to);
    let targetLang = resolvedTargetLanguage === 'zh-Hans' ? 'zh' : resolvedTargetLanguage;

    // 判断是否使用代理
    let url: string = config.proxy[config.service] ? config.proxy[config.service] : urls[services.xiaoniu]

    const resp = await fetch(url, {
        method: method.POST,
        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        body: `from=auto&to=${targetLang}&apikey=${config.token[services.xiaoniu]}&src_text=${encodeURIComponent(message.origin)}`
    });

    if (resp.ok) {
        let result = await resp.json();
        return result.tgt_text
    } else {
        console.log(resp)
        throw new Error(`翻译失败: ${resp.status} ${resp.statusText} body: ${await resp.text()}`);
    }
}

export default xiaoniu;

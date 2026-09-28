import { newApiEndpoint } from '../utils/endpoint';
import { method, urls } from "../utils/constant";
import {commonMsgTemplate, deepseekMsgTemplate} from "../utils/template";
import { config } from "@/entrypoints/utils/config";
import { contentPostHandler } from "@/entrypoints/utils/check";

async function newapi(message: any) {
    try {
        const headers = new Headers({
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.token[config.service]}`
        });

        const url = newApiEndpoint(config.newApiUrl);

        const resp = await fetch(url, {
            method: method.POST,
            headers,
            body: commonMsgTemplate(message.origin)
        });

        if (!resp.ok) {
            throw new Error(`翻译失败: ${resp.status} ${resp.statusText} body: ${await resp.text()}`);
        }

        const result = await resp.json();

        if (result.choices && result.choices.length > 0) {
            return contentPostHandler(result.choices[0].message.content);
        }

        throw new Error('翻译失败: 上游未返回内容');
    } catch (error) {
        console.error('API调用失败:', error);
        throw error;
    }
}

export default newapi;

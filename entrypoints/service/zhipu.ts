import {method, urls} from "../utils/constant";
import {services} from "../utils/option";
import {commonMsgTemplate} from "../utils/template";
import HmacSHA256 from 'crypto-js/hmac-sha256';
import Base64 from 'crypto-js/enc-base64';
import {config} from "@/entrypoints/utils/config";


// 文档参考：https://open.bigmodel.cn/dev/api#nosdk
async function zhipu(message: any) {
    const secret = generateToken(config.token[services.zhipu]);
    if (!secret) throw new Error('智谱 API Key 格式错误');

    // 构建请求头
    let headers = new Headers();
    headers.append('Content-Type', 'application/json');
    headers.append('Authorization', `Bearer ${secret}`);

    // 发起 fetch 请求
    const resp = await fetch(urls[services.zhipu], {
        method: method.POST,
        headers: headers,
        body: commonMsgTemplate(message.origin)
    });

    if (resp.ok) {
        let result = await resp.json();
        return result.choices[0].message.content;
    } else {
        console.log(resp)
        throw new Error(`翻译失败: ${resp.status} ${resp.statusText} body: ${await resp.text()}`);
    }
}

export function generateToken(APIKey: string) {
    if (!APIKey || !APIKey.includes('.')) {
        return;
    }
    let duration = 3600000 * 24; // 生成的 token 默认24小时后过期
    const [key, secret] = APIKey.split('.');

    return generateJWT(secret, {alg: "HS256", sign_type: "SIGN", typ: "JWT"}, {
        api_key: key,
        exp: Math.floor(Date.now() / 1000) + (duration / 1000),
        timestamp: Math.floor(Date.now() / 1000)
    });
}

// 生成JWT（JSON Web Token）
function generateJWT(secret: string, header: any, payload: any) {
    // 对header和payload部分进行UTF-8编码，然后转换为Base64URL格式
    const encodedHeader = base64UrlSafe(btoa(JSON.stringify(header)));
    const encodedPayload = base64UrlSafe(btoa(JSON.stringify(payload)));
    // 生成 jwt 签名
    let hmacsha256 = base64UrlSafe(HmacSHA256(encodedHeader + "." + encodedPayload, secret).toString(Base64))
    return `${encodedHeader}.${encodedPayload}.${hmacsha256}`;
}

// 将Base64字符串转换为Base64URL格式的函数
function base64UrlSafe(base64String: string) {
    return base64String.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export default zhipu;

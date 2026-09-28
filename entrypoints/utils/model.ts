import { defaultOption, services, servicesType, customModelString } from "./option";

interface IMapping {
    [key: string]: string;
}

// 内包，存储额外信息
interface IExtra {
    [key: string]: any
}

export class Config {
    on: boolean; // 是否开启
    from: string;
    to: string;
    service: string;
    token: IMapping;
    ak: string;
    sk: string;
    model: IMapping;
    customModel: IMapping;  // 自定义模型名称
    cachedModels: IMapping;  // 远程拉取的模型列表（JSON 字符串数组，按服务存储）
    proxy: IMapping;  // 代理地址
    custom: string; // 本地服务地址
    extra: IExtra;  // 额外信息（内包信息）
    robot_id: IMapping;  // 机器人 ID（兼容 coze）
    system_role: IMapping;
    user_role: IMapping;
    count: number;  // 翻译次数
    theme: string;  // 主题模式：'auto' | 'light' | 'dark'
    useCache: boolean; // 是否使用缓存
    selectionTranslatorMode: string; // 划词翻译显示模式: 'disabled' | 'bilingual' | 'translation-only'
    newApiUrl: string; // NewAPI地址
    tencentSecretId: string; // 腾讯云 Secret ID
    tencentSecretKey: string; // 腾讯云 Secret Key
    azureOpenaiEndpoint: string; // Azure OpenAI 端点地址
    animations: boolean; // 是否启用动画效果

    constructor() {
        this.on = true;
        this.from = defaultOption.from;
        this.to = defaultOption.to;
        this.service = defaultOption.service;
        this.token = {};
        this.ak = '';
        this.sk = '';
        this.model = Object.fromEntries([...servicesType.useModel].map(service => [service, customModelString]));
        this.customModel = {};
        this.cachedModels = {};
        this.proxy = {};
        this.custom = defaultOption.custom;
        this.extra = {};
        this.robot_id = {};
        this.system_role = systemRoleFactory();
        this.user_role = userRoleFactory();
        this.count = 0;
        this.theme = 'auto';  // 默认跟随系统
        this.useCache = true; // 默认开启缓存
        this.selectionTranslatorMode = 'bilingual'; // 默认双语显示模式
        this.newApiUrl = 'http://localhost:3000'; // NewAPI 默认地址
        this.tencentSecretId = ''; // 腾讯云 Secret ID
        this.tencentSecretKey = ''; // 腾讯云 Secret Key
        this.azureOpenaiEndpoint = ''; // Azure OpenAI 端点地址
        this.animations = true; // 默认启用动画
    }
}

// 构建所有服务的 system_role
function systemRoleFactory(): IMapping {
    let systems_role: IMapping = {};
    Object.values(services).forEach(key => systems_role[key] = defaultOption.system_role);
    return systems_role;
}

// 构建所有服务的 user_role
function userRoleFactory(): IMapping {
    let users_role: IMapping = {};
    Object.values(services).forEach(key => users_role[key] = defaultOption.user_role);
    return users_role;
}

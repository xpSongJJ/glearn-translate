/**
 * 翻译API代理模块
 * 整合翻译队列管理，作为翻译函数和后台翻译服务之间的中间层
 */

import { enqueueTranslation, clearTranslationQueue, getQueueStatus } from './translateQueue';
import browser from 'webextension-polyfill';
import { config } from './config';
import { cache } from './cache';
import { detectlang } from './common';
import { storage } from '@wxt-dev/storage';

// 调试相关
const isDev = process.env.NODE_ENV === 'development';

/** 检测是否为扩展上下文失效错误（扩展重载后 content script 连接断开） */
function isContextInvalidated(error: unknown): boolean {
  const msg = String(error?.toString?.() || error || '');
  return (
    msg.includes('Extension context invalidated') ||
    msg.includes('extension context') ||
    msg.includes('context invalidated')
  );
}

/** 已显示过扩展重载提示，避免重复弹出 */
let _contextWarningShown = false;

/** 友好的扩展重载提示 */
function warnContextInvalidated(): void {
  if (_contextWarningShown) return;
  _contextWarningShown = true;
  import('./tip').then(({ sendErrorMessage }) => {
    sendErrorMessage('翻译失败：扩展已更新，请刷新页面后重试');
  }).catch(() => {
    // 降级：console 提示
    console.warn('[翻译API] 扩展已更新，请刷新页面后重试');
  });
}

/**
 * 翻译API的统一入口
 * 所有翻译请求都应该通过此函数发送，以便集中管理队列和重试逻辑
 * 
 * @param origin 原始文本
 * @param context 上下文信息，通常是页面标题
 * @param options 翻译选项
 * @returns 翻译结果的Promise
 */
export async function translateText(origin: string, context: string = document.title, options: TranslateOptions = {}): Promise<string> {
  const {
    maxRetries = 3, 
    retryDelay = 1000, 
    timeout = 45000,
    useCache = config.useCache,
  } = options;

  // 如果目标语言与当前文本语言相同，直接返回原文
  if (detectlang(origin.replace(/[\s\u3000]/g, '')) === config.to) {
    return origin;
  }

  // 检查缓存
  if (useCache) {
    const cachedResult = cache.localGet(origin);
    if (cachedResult) {
      if (isDev) {
        console.log('[翻译API] 命中缓存，直接返回缓存结果');
      }
      return cachedResult;
    }
  }

  // 增加翻译计数
  config.count++;
  // 保存配置以确保计数持久化
  storage.setItem('local:config', JSON.stringify(config));

  // 使用队列处理翻译请求
  return enqueueTranslation(async () => {
    // 创建翻译任务
    const translationTask = async (retryCount: number = 0): Promise<string> => {
      try {
        // 发送翻译请求给background脚本处理
        const result = await Promise.race([
          browser.runtime.sendMessage({ context, origin }),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('翻译请求超时')), timeout)
          )
        ]) as string;

        // 如果翻译结果为空或与原文完全相同，直接返回原文
        if (!result || result === origin) {
          return origin;
        }

        // 缓存翻译结果
        if (useCache) {
          cache.localSet(origin, result);
        }

        return result;
      } catch (error) {
        // 检测扩展上下文失效（扩展重载后 content script 连接已断开）
        if (isContextInvalidated(error)) {
          warnContextInvalidated();
          throw error; // 不重试，刷新页面是唯一解法
        }

        // 处理错误，根据重试策略决定是否重试
        if (retryCount < maxRetries) {
          if (isDev) {
            console.log(`[翻译API] 翻译失败，${retryCount + 1}/${maxRetries} 次重试，原因:`, error);
          }
          
          // 等待一段时间后重试
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          return translationTask(retryCount + 1);
        }
        
        // 超过最大重试次数，抛出异常
        throw error;
      }
    };

    // 开始执行翻译任务
    return translationTask();
  });
}

/**
 * 当用户离开页面或主动取消翻译时，清空翻译队列
 */
export function cancelAllTranslations() {
  if (isDev) {
    console.log('[翻译API] 取消所有等待中的翻译任务');
  }
  clearTranslationQueue();
}

/**
 * 获取当前翻译队列的状态
 * 可用于UI显示翻译进度等
 */
export function getTranslationStatus() {
  return getQueueStatus();
}

/**
 * 翻译参数接口
 */
export interface TranslateOptions {
  /** 最大重试次数 */
  maxRetries?: number;
  /** 重试间隔(毫秒) */
  retryDelay?: number;
  /** 超时时间(毫秒) */
  timeout?: number;
  /** 是否使用缓存 */
  useCache?: boolean;
}

/** 流式翻译各阶段耗时记录 */
export interface StreamTiming {
  /** 调用入口 */
  entry: number;
  /** sync 操作完成（语言检测+缓存+序列化） */
  afterSync: number;
  /** 收到 background 握手 ready */
  readyRcvd: number;
  /** 翻译请求已发出 */
  requestSent: number;
  /** 首个思考 chunk 到达（reasoning_content，推理模型才有） */
  firstReasoning: number;
  /** 首个译文 chunk 到达（delta.content） */
  firstChunk: number;
}

/**
 * 流式翻译API
 * 通过端口通信实现逐块返回翻译结果，减少用户等待体感
 * 
 * @param origin 原始文本
 * @param context 上下文信息
 * @param onChunk 每收到一个文本块时调用的回调
 * @param timing 可选，用于记录各阶段耗时
 * @returns 完整翻译结果的Promise
 */
export async function translateTextStream(
  origin: string,
  context: string = document.title,
  onChunk: (chunk: string) => void,
  timing?: StreamTiming
): Promise<string> {
  // 如果目标语言与当前文本语言相同，直接返回原文
  if (detectlang(origin.replace(/[\s\u3000]/g, '')) === config.to) {
    return origin;
  }

  // 检查缓存
  if (config.useCache) {
    const cachedResult = cache.localGet(origin);
    if (cachedResult) {
      onChunk(cachedResult);
      return cachedResult;
    }
  }

  // 增加翻译计数
  config.count++;
  storage.setItem('local:config', JSON.stringify(config));

  // 记录 sync 阶段结束
  if (timing) timing.afterSync = performance.now();

  return new Promise((resolve, reject) => {
    let fullText = '';
    let settled = false;

    let port: browser.Runtime.Port;
    try {
      port = browser.runtime.connect({ name: 'translate-stream' });
    } catch (error) {
      if (isContextInvalidated(error)) {
        warnContextInvalidated();
      }
      reject(error);
      return;
    }
    
    // 超时保护：45s 无响应则断开
    const timeoutId = setTimeout(() => {
      if (!settled) {
        settled = true;
        port.disconnect();
        reject(new Error('翻译请求超时'));
      }
    }, 45000);

    port.onMessage.addListener((msg: any) => {
      // 握手：收到 ready 后发送翻译请求
      if (msg.ready) {
        if (timing) timing.readyRcvd = performance.now();
        port.postMessage({ context, origin });
        if (timing) timing.requestSent = performance.now();
        return;
      }
      
      if (settled) return;

      if (msg.error) {
        settled = true;
        clearTimeout(timeoutId);
        port.disconnect();
        reject(new Error(msg.error));
        return;
      }

      // 推理模型的思考内容：仅记录首思考时间，不传给 onChunk
      if (msg.reasoning) {
        if (timing && timing.firstReasoning === 0) timing.firstReasoning = performance.now();
        return;
      }

      if (msg.chunk) {
        if (timing && timing.firstChunk === 0) timing.firstChunk = performance.now();
        fullText += msg.chunk;
        onChunk(msg.chunk);
      }

      if (msg.done) {
        settled = true;
        clearTimeout(timeoutId);
        port.disconnect();

        if (!fullText || fullText === origin) {
          resolve(origin);
          return;
        }

        // 缓存完整翻译结果
        if (config.useCache) {
          cache.localSet(origin, fullText);
        }

        resolve(fullText);
      }
    });

    port.onDisconnect.addListener(() => {
      clearTimeout(timeoutId);
      if (!settled) {
        settled = true;
        if (fullText) {
          resolve(fullText);
        } else {
          // 检查是否为扩展上下文失效
          const errMsg = port.error?.message || '';
          if (isContextInvalidated(errMsg)) {
            warnContextInvalidated();
            reject(new Error('扩展已更新，请刷新页面后重试'));
          } else {
            reject(new Error('翻译连接已断开'));
          }
        }
      }
    });
  });
}
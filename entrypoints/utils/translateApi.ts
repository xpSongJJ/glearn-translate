import { extensionRuntime } from './runtime';
import { config, configReady } from './config';
import { cache } from './cache';
import { getConfigurationError } from './check';

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
  timing?: StreamTiming,
  signal?: AbortSignal
): Promise<string> {
  await configReady;
  if (signal?.aborted) throw new DOMException('翻译已取消', 'AbortError');
  const runtime = extensionRuntime();
  const configurationError = getConfigurationError();
  if (configurationError) throw new Error(configurationError);

  // 检查缓存
  if (config.useCache) {
    const cachedResult = cache.localGet(origin);
    if (cachedResult) {
      onChunk(cachedResult);
      return cachedResult;
    }
  }

  // 记录 sync 阶段结束
  if (timing) timing.afterSync = performance.now();

  return new Promise((resolve, reject) => {
    let fullText = '';
    let settled = false;
    let timeoutId: ReturnType<typeof setTimeout>;
    const cleanup = () => { clearTimeout(timeoutId); signal?.removeEventListener('abort', abort); };
    const abort = () => {
      if (settled) return;
      settled = true; cleanup(); port.disconnect();
      reject(new DOMException('翻译已取消', 'AbortError'));
    };

    let port: ReturnType<typeof runtime.connect>;
    try {
      port = runtime.connect({ name: 'translate-stream' });
    } catch {
      reject(new Error('插件连接已失效，请刷新页面后重试'));
      return;
    }
    
    // 超时保护：45s 无响应则断开
    timeoutId = setTimeout(() => {
      if (!settled) {
        settled = true;
        cleanup();
        port.disconnect();
        reject(new Error('翻译请求超时'));
      }
    }, 45000);

    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) { abort(); return; }

    port.onMessage.addListener((msg: any) => {
      if (settled) return;
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
        cleanup();
        port.disconnect();
        reject(new Error(msg.source === 'service' ? `翻译服务返回错误：${msg.error}` : msg.error));
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
        if (typeof msg.result === 'string') fullText = msg.result;
        settled = true;
        cleanup();
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
      cleanup();
      if (!settled) {
        settled = true;
        reject(new Error(runtime.id ? '翻译连接已断开，请重试' : '插件连接已失效，请刷新页面后重试'));
      }
    });
  });
}

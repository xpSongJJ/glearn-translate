import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url);
const { build } = createRequire(require.resolve('vite'))('esbuild');
const root = resolve('.');
const temp = await mkdtemp(join(tmpdir(), 'glearn-tests-'));
const bundle = join(temp, 'modules.mjs');
try {
  await build({
    stdin: { contents: `export * from './entrypoints/utils/config'; export * from './entrypoints/utils/option'; export * from './entrypoints/utils/check'; export * from './entrypoints/utils/endpoint'; export * from './entrypoints/utils/sse'; export * from './entrypoints/utils/template'; export * from './entrypoints/utils/translateApi'; export * from './entrypoints/utils/clipboard'; export * from './entrypoints/utils/backgroundClipboard'; export * from './entrypoints/utils/translationError'; export { browser as testBrowser } from 'wxt/browser'; export { default as background } from './entrypoints/background';`, resolveDir: root },
    outfile: bundle, bundle: true, platform: 'node', format: 'esm', alias: { '@': root },
    plugins: [{ name: 'extension-mocks', setup(build) {
      build.onResolve({ filter: /^(@wxt-dev\/storage|wxt\/browser|wxt\/utils\/define-background)$/ }, args => ({ path: args.path, namespace: 'mock' }));
      build.onLoad({ filter: /.*/, namespace: 'mock' }, args => ({ contents: args.path === '@wxt-dev/storage'
        ? 'export const storage = { getItem: async () => null, setItem: async () => {}, watch: () => () => {} };'
        : args.path === 'wxt/browser'
        ? 'export const browser = { runtime: { id: "test-extension", onMessage: { addListener() {} }, onConnect: { addListener(fn) { globalThis.testOnConnect = fn; } } } };'
        : 'export const defineBackground = value => value;' }));
    } }],
  });
  const m = await import(pathToFileURL(bundle).href);
  await m.configReady;
  const tests = [];
  const test = (name, run) => tests.push({ name, run });
  test('智能目标语言留空，迁移旧互译选项，保留显式目标与自定义提示词', () => {
    assert.equal(m.normalizeConfig({ to: 'default' }).to, '');
    assert.equal(m.normalizeConfig({ to: 'ja' }).to, 'ja');
    const migrated = m.normalizeConfig({ user_role: { custom: 'Translate the following text into {{to}}, If translation is unnecessary (e.g. proper nouns, codes, etc.), return the original text. NO explanations. NO notes:\n\n{{origin}}' } });
    assert.equal(migrated.user_role.custom, m.defaultOption.user_role);
    const previousDefaults = m.normalizeConfig({ system_role: { custom: m.previousDefaultSystemPrompt }, user_role: { custom: m.previousDefaultUserPrompt } });
    assert.equal(previousDefaults.system_role.custom, m.defaultOption.system_role);
    assert.equal(previousDefaults.user_role.custom, m.defaultOption.user_role);
    assert.equal(m.normalizeConfig({ user_role: { custom: m.previousPhoneticUserPrompt } }).user_role.custom, m.defaultOption.user_role);
    const compactDefaults = m.normalizeConfig({ user_role: { custom: m.previousCompactUserPrompt }, system_role: { custom: m.previousPhoneticSystemPrompt } });
    assert.equal(compactDefaults.user_role.custom, m.defaultOption.user_role);
    assert.equal(compactDefaults.system_role.custom, m.defaultOption.system_role);
    const customized = m.normalizeConfig({ system_role: { custom: 'My system prompt' }, user_role: { custom: 'My user prompt' } });
    assert.equal(customized.system_role.custom, 'My system prompt');
    assert.equal(customized.user_role.custom, 'My user prompt');
    const settings = m.normalizeConfig({ service: 'custom', customModel: { custom: 'test-model' }, to: '', user_role: { custom: 'Target={{to}}; again={{to}}; source={{origin}}' } });
    Object.assign(m.config, settings);
    for (const source of ['你好，这是中文。', 'Hello world.', 'こんにちは。', '中文内容 with a short English phrase']) {
      const prompt = JSON.parse(m.commonMsgTemplate(source)).messages[1].content;
      assert.match(prompt, /predominant source language/);
      assert.match(prompt, /Chinese text into English/);
      assert.match(prompt, /all other languages into Simplified Chinese/);
      assert.ok(prompt.includes('Target=; again=; source=' + source));
      assert.equal(prompt.includes('{{to}}'), false);
    }
    assert.equal(m.config.user_role.custom, settings.user_role.custom);
    m.config.to = 'ja';
    const explicit = JSON.parse(m.commonMsgTemplate('Hello')).messages[1].content;
    assert.equal(explicit, 'Target=ja; again=ja; source=Hello');
    assert.equal(JSON.parse(m.commonMsgTemplate('Hello')).messages[1].content.includes('bilingual display requested'), false);
  });
  test('错误操作区分凭据、模型、网络、限流与扩展失效，服务错误不误判为刷新', () => {
    assert.equal(m.translationErrorAction('翻译服务返回错误：翻译失败: 401 Unauthorized').action, 'credentials');
    assert.equal(m.translationErrorAction('翻译服务返回错误：model test-model does not exist').action, 'model');
    assert.equal(m.translationErrorAction('接口地址无效').action, 'configuration');
    assert.equal(m.translationErrorAction('Failed to fetch').action, 'retry');
    assert.match(m.translationErrorAction('429 rate limit').hint, /稍后重试/);
    assert.equal(m.translationErrorAction('插件连接已失效，请刷新页面后重试').action, 'refresh');
    assert.equal(m.translationErrorAction('翻译服务返回错误：Extension context invalidated').action, 'retry');
  });
  test('旧机器服务迁移到已配置的 AI，保留模型与密钥，移除旧功能', () => {
    const config = m.normalizeConfig({ on: true, service: 'microsoft', autoTranslate: true, hotkey: 'Control', token: { microsoft: 'legacy', openai: 'test-key' }, model: { openai: 'test-model' }, display: 0 });
    assert.equal(config.service, 'openai'); assert.equal(config.token.openai, 'test-key');
    assert.equal(config.model.openai, 'test-model'); assert.equal(config.token.microsoft, undefined);
    for (const key of ['autoTranslate', 'hotkey', 'display', 'disableFloatingBall']) assert.equal(key in config, false);
  });
  test('无密钥的旧服务迁移后显示配置提示', () => {
    const config = m.normalizeConfig({ service: 'google' });
    assert.equal(config.service, 'deepseek'); assert.match(m.getConfigurationError(config), /API Key/);
  });
  test('配置迁移补全默认值，校正不合法值，移除旧划词模式设置', () => {
    const config = m.normalizeConfig({ service: 'openai', token: null, theme: 'invalid', disableSelectionTranslator: true, selectionTranslatorMode: 'disabled', maxConcurrentTranslations: 999 });
    assert.deepEqual(config.token, {}); assert.equal(config.theme, 'auto'); assert.equal('selectionTranslatorMode' in config, false); assert.equal('disableSelectionTranslator' in config, false); assert.equal('maxConcurrentTranslations' in config, false);
    assert.equal(m.normalizeConfig(null).on, true);
  });
  test('本地 AI 可不填写密钥，手动模型有效，错误地址被拦截', () => {
    const config = m.normalizeConfig({ service: 'custom', customModel: { custom: 'local-model' } });
    assert.equal(m.getConfigurationError(config), '');
    config.custom = 'file:///tmp/model'; assert.match(m.getConfigurationError(config), /地址无效/);
  });
  test('New API 根地址、v1 地址、完整接口和查询参数解析正确', () => {
    assert.equal(m.newApiEndpoint('https://example.com/'), 'https://example.com/v1/chat/completions');
    assert.equal(m.newApiEndpoint('https://example.com/v1/'), 'https://example.com/v1/chat/completions');
    assert.equal(m.newApiEndpoint('https://example.com/v1/chat/completions?tenant=1'), 'https://example.com/v1/chat/completions?tenant=1');
  });
  test('SSE 在中文字节拆分、CRLF 和最后一行无换行时仍完整解析', async () => {
    const bytes = new TextEncoder().encode('data: {"choices":[{"delta":{"content":"译文"}}]}\r\ndata:{"choices":[{"delta":{"content":"完成"}}]}');
    const response = new Response(new ReadableStream({ start(controller) { for (const byte of bytes) controller.enqueue(new Uint8Array([byte])); controller.close(); } }));
    let text = ''; for await (const event of m.openaiSSEStream(response)) text += event.content || '';
    assert.equal(text, '译文完成');
  });
  test('SSE 服务错误不会作为成功的译文返回', async () => {
    await assert.rejects(async () => { for await (const event of m.openaiSSEStream(new Response('data: {"error":{"message":"额度不足"}}\n'))) {} }, /额度不足/);
  });
  test('API 地址复用旧代理配置，恢复默认清除覆盖，切换服务保持各自地址', () => {
    const settings = m.normalizeConfig({ service: 'deepseek', proxy: { deepseek: 'https://gateway.test/chat/completions' } });
    assert.equal(m.configuredApiAddress(settings), 'https://gateway.test/chat/completions');
    assert.equal(m.translationEndpoint(settings), m.configuredApiAddress(settings));
    m.setApiAddress(settings, m.defaultApiAddress(settings));
    assert.equal(settings.proxy.deepseek, '');
    assert.equal(m.configuredApiAddress(settings), 'https://api.deepseek.com/chat/completions');
    m.setApiAddress(settings, 'https://gateway.test/deepseek/chat/completions');
    settings.service = 'claude';
    assert.equal(m.configuredApiAddress(settings), 'https://api.anthropic.com/v1/messages');
    settings.service = 'deepseek';
    assert.equal(m.configuredApiAddress(settings), 'https://gateway.test/deepseek/chat/completions');
    settings.service = 'azureOpenai';
    // Provider-specific settings do not inherit another service's address.
    assert.equal(m.defaultApiAddress(settings), '');
    settings.service = m.services.azureOpenai;
    m.setApiAddress(settings, 'https://resource.test/openai/deployments/demo/chat/completions?api-version=test');
    assert.equal(m.configuredApiAddress(settings), settings.azureOpenaiEndpoint);
    assert.equal(m.defaultApiAddress(settings), '');
  });
  test('划词端通过扩展端口握手发送文本并接收完整译文', async () => {
    Object.assign(m.config, m.normalizeConfig({ service: 'custom', customModel: { custom: 'test-model' }, useCache: false, to: 'zh-Hans' }));
    let onMessage;
    let onDisconnect;
    let request;
    let disconnected = false;
    m.testBrowser.runtime.connect = options => {
      assert.equal(options.name, 'translate-stream');
      queueMicrotask(() => onMessage({ ready: true }));
      return {
        onMessage: { addListener(fn) { onMessage = fn; } },
        onDisconnect: { addListener(fn) { onDisconnect = fn; } },
        postMessage(message) {
          request = message;
          queueMicrotask(() => {
            onMessage({ chunk: '翻译' }); onMessage({ chunk: '结果' });
            onMessage({ result: '翻译结果', done: true });
          });
        },
        disconnect() { disconnected = true; onDisconnect?.(); },
      };
    };
    const chunks = [];
    assert.equal(await m.translateTextStream('This is a selected sentence.', 'Test page', chunk => chunks.push(chunk)), '翻译结果');
    assert.deepEqual(request, { origin: 'This is a selected sentence.', context: 'Test page' });
    assert.deepEqual(chunks, ['翻译', '结果']); assert.equal(disconnected, true);
  });
  test('扩展接口缺失和失效时给出刷新提示，取消的翻译不发起连接', async () => {
    const runtime = m.testBrowser.runtime;
    try {
      m.testBrowser.runtime = undefined;
      await assert.rejects(m.translateTextStream('This is a sentence.', 'Test', () => {}), /刷新页面/);
      m.testBrowser.runtime = runtime;
      runtime.connect = () => { throw new Error('Extension context invalidated.'); };
      await assert.rejects(m.translateTextStream('This is a sentence.', 'Test', () => {}), /刷新页面/);
      const controller = new AbortController(); controller.abort();
      await assert.rejects(m.translateTextStream('This is a sentence.', 'Test', () => {}, undefined, controller.signal), { name: 'AbortError' });
    } finally { m.testBrowser.runtime = runtime; }
  });
  test('服务端的 sendMessage 错误带来源标记，区别于扩展通信失效', async () => {
    m.testBrowser.runtime.connect = () => {
      let onMessage;
      queueMicrotask(() => onMessage({ ready: true }));
      return {
        onMessage: { addListener(fn) { onMessage = fn; } }, onDisconnect: { addListener() {} }, disconnect() {},
        postMessage() { queueMicrotask(() => onMessage({ error: "Cannot read properties of undefined (reading 'sendMessage')", source: 'service', done: true })); },
      };
    };
    await assert.rejects(m.translateTextStream('This is a sentence.', 'Test', () => {}), /翻译服务返回错误：.*sendMessage/);
  });
  test('剪贴板 API 可用时写入完整多行译文', async () => {
    let copied;
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { clipboard: { async writeText(text) { copied = text; } } } });
    await m.writeClipboardText('第一行\n第二行'); assert.equal(copied, '第一行\n第二行');
  });
  test('HTTP 页面和 Clipboard API 拒绝时回退复制，恢复选区且清理临时元素', async () => {
    let copied;
    let focused = false;
    let removed = false;
    let restoredRange;
    const range = { cloneRange() { return this; } };
    globalThis.HTMLElement = class {};
    const activeElement = new globalThis.HTMLElement(); activeElement.focus = () => { focused = true; };
    globalThis.window = { getSelection: () => ({ rangeCount: 1, getRangeAt: () => range, removeAllRanges() {}, addRange(value) { restoredRange = value; } }) };
    const textarea = { style: {}, setAttribute() {}, focus() {}, select() {}, remove() { removed = true; } };
    globalThis.document = { activeElement, createElement: () => textarea, body: { appendChild() {} }, execCommand(command) { assert.equal(command, 'copy'); copied = textarea.value; return true; } };
    for (const clipboard of [undefined, { async writeText() { throw new Error('NotAllowedError'); } }]) {
      focused = false; removed = false; restoredRange = undefined;
      globalThis.navigator.clipboard = clipboard;
      await m.writeClipboardText('回退复制\n完整译文');
      assert.equal(copied, '回退复制\n完整译文'); assert.equal(focused, true); assert.equal(removed, true); assert.equal(restoredRange, range);
    }
    globalThis.document.execCommand = () => false;
    removed = false;
    await assert.rejects(m.writeClipboardText('复制失败'), /手动复制/);
    assert.equal(removed, true);
  });
  test('译文复制通过扩展发送，失效和写入失败不会显示复制成功', async () => {
    let request;
    m.testBrowser.runtime.sendMessage = async message => { request = message; return { success: true }; };
    await m.copyText('扩展复制\n第二行');
    assert.deepEqual(request, { type: 'copy-translation', text: '扩展复制\n第二行' });
    m.testBrowser.runtime.sendMessage = async () => ({ success: false, error: '无法写入剪贴板' });
    await assert.rejects(m.copyText('译文'), /无法写入剪贴板/);
    const runtime = m.testBrowser.runtime;
    try { m.testBrowser.runtime = undefined; await assert.rejects(m.copyText('译文'), /重新加载插件/); }
    finally { m.testBrowser.runtime = runtime; }
  });
  test('并发复制共用 Chrome 离屏页面，创建失败后可重试', async () => {
    const document = globalThis.document; delete globalThis.document;
    let created = false; let creations = 0; const writes = [];
    m.testBrowser.offscreen = {
      async hasDocument() { return created; },
      async createDocument(options) { assert.equal(options.url, 'clipboard.html'); creations++; await new Promise(resolve => setTimeout(resolve, 5)); created = true; },
    };
    m.testBrowser.runtime.sendMessage = async message => { writes.push(message.text); return { success: true }; };
    try {
      await Promise.all([m.copyInBackground('第一份译文'), m.copyInBackground('第二份译文')]);
      assert.equal(creations, 1); assert.deepEqual(writes, ['第一份译文', '第二份译文']);
      await m.copyInBackground('第三份译文'); assert.equal(creations, 1);
      created = false;
      m.testBrowser.offscreen.createDocument = async () => { throw new Error('创建失败'); };
      await assert.rejects(m.copyInBackground('译文'), /创建失败/);
      m.testBrowser.offscreen.createDocument = async () => { created = true; creations++; };
      await m.copyInBackground('重试成功'); assert.equal(creations, 2);
    } finally { globalThis.document = document; }
  });
  test('移除插件开关后，旧版暂停配置自动恢复可用状态', () => {
    assert.equal(m.normalizeConfig({ on: false, service: 'custom', customModel: { custom: 'test' } }).on, true);
  });
  m.background.main();
  async function translateWith(service, response) {
    Object.assign(m.config, m.normalizeConfig({ service, token: { [service]: 'test-key' }, model: { [service]: 'test-model' }, custom: 'http://localhost:11434/v1/chat/completions', newApiUrl: 'https://example.com/v1', azureOpenaiEndpoint: 'https://test.openai.azure.com/openai/deployments/test/chat/completions?api-version=test' }));
    const messages = []; let listener;
    const port = { name: 'translate-stream', postMessage: data => messages.push(data), onMessage: { addListener: fn => { listener = fn; } }, onDisconnect: { addListener() {}, removeListener() {} } };
    let request;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, options) => { request = { url, options }; return response; };
    try { globalThis.testOnConnect(port); await listener({ origin: 'A test sentence.' }); }
    finally { globalThis.fetch = originalFetch; }
    return { request, messages };
  }
  test('自定义接口流式请求使用配置地址和模型，推理内容不混入译文', async () => {
    const { request, messages } = await translateWith('custom', new Response('data: {"choices":[{"delta":{"reasoning_content":"reasoning"}}]}\ndata: {"choices":[{"delta":{"content":"译文"}}]}\ndata: [DONE]\n', { headers: { 'content-type': 'text/event-stream' } }));
    assert.equal(request.url, 'http://localhost:11434/v1/chat/completions');
    assert.equal(JSON.parse(request.options.body).model, 'test-model');
    assert.equal(messages.at(-1).result, '译文'); assert.ok(messages.some(msg => msg.reasoning));
  });
  test('Azure 流式请求使用部署地址及 api-key 鉴权', async () => {
    const { request, messages } = await translateWith('azureOpenai', new Response('data: {"choices":[{"delta":{"content":"译文"}}]}\ndata: [DONE]\n', { headers: { 'content-type': 'text/event-stream' } }));
    assert.match(request.url, /deployments\/test\/chat\/completions/);
    assert.equal(request.options.headers.get('api-key'), 'test-key'); assert.equal(request.options.headers.has('Authorization'), false);
    assert.equal(messages.at(-1).done, true);
  });
  test('New API 接口支持非流式 JSON 返回', async () => {
    const { request, messages } = await translateWith('newapi', new Response(JSON.stringify({ choices: [{ message: { content: '<think>hidden</think>译文' } }] }), { headers: { 'content-type': 'application/json' } }));
    assert.equal(request.url, 'https://example.com/v1/chat/completions'); assert.equal(messages.at(-1).chunk, '译文');
  });
  test('模型提示词使用手动配置的 Claude / MiniMax 模型', () => {
    Object.assign(m.config, m.normalizeConfig({ service: 'claude', customModel: { claude: 'claude-test' } }));
    assert.equal(JSON.parse(m.claudeMsgTemplate('test')).model, 'claude-test');
    Object.assign(m.config, m.normalizeConfig({ service: 'minimax', customModel: { minimax: 'minimax-test' } }));
    assert.equal(JSON.parse(m.minimaxTemplate('test')).model, 'minimax-test');
  });
  for (const { name, run } of tests) { await run(); console.log(`✓ ${name}`); }
  console.log(`${tests.length} regression checks passed.`);
} finally { await rm(temp, { recursive: true, force: true }); }

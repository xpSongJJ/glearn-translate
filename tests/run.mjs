import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const require = createRequire(import.meta.url);
const { build } = createRequire(require.resolve('vite'))('esbuild');
const root = resolve('.');
const temp = await mkdtemp(join(tmpdir(), 'glearn-tests-'));
const bundle = join(temp, 'modules.mjs');
try {
  await build({
    stdin: { contents: `export * from './entrypoints/utils/config'; export * from './entrypoints/utils/option'; export * from './entrypoints/utils/check'; export * from './entrypoints/utils/endpoint'; export * from './entrypoints/utils/sse'; export * from './entrypoints/utils/template'; export { default as background } from './entrypoints/background';`, resolveDir: root },
    outfile: bundle, bundle: true, platform: 'node', format: 'esm', alias: { '@': root },
    plugins: [{ name: 'extension-mocks', setup(build) {
      build.onResolve({ filter: /^(@wxt-dev\/storage|webextension-polyfill|wxt\/utils\/define-background)$/ }, args => ({ path: args.path, namespace: 'mock' }));
      build.onLoad({ filter: /.*/, namespace: 'mock' }, args => ({ contents: args.path === '@wxt-dev/storage'
        ? 'export const storage = { getItem: async () => null, setItem: async () => {}, watch: () => () => {} };'
        : args.path === 'webextension-polyfill'
        ? 'export default { runtime: { onMessage: { addListener() {} }, onConnect: { addListener(fn) { globalThis.testOnConnect = fn; } } } };'
        : 'export const defineBackground = value => value;' }));
    } }],
  });
  const m = await import(bundle);
  await m.configReady;
  const tests = [];
  const test = (name, run) => tests.push({ name, run });
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
  test('配置导入补全默认值，校正不合法值，保留关闭的划词模式', () => {
    const config = m.normalizeConfig({ service: 'openai', token: null, theme: 'invalid', disableSelectionTranslator: true, maxConcurrentTranslations: 999 });
    assert.deepEqual(config.token, {}); assert.equal(config.theme, 'auto'); assert.equal(config.selectionTranslatorMode, 'disabled'); assert.equal('maxConcurrentTranslations' in config, false);
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

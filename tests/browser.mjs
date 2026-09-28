import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const expected = '这是一段译文。\n第二行';
const requests = [];
let failNext = false;
let httpFailure;
let nextResult;
const executable = process.env.GLEARN_TEST_BROWSER || [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/chromium', '/usr/bin/chromium-browser',
].find(existsSync);
assert.ok(executable, 'Install Edge or Chromium, or set GLEARN_TEST_BROWSER to its executable path.');
const profile = await mkdtemp(join(tmpdir(), 'glearn-browser-'));
const server = createServer(async (req, res) => {
  if (req.url === '/v1/chat/completions') {
    let body = ''; for await (const chunk of req) body += chunk;
    requests.push(JSON.parse(body));
    if (httpFailure) {
      const failure = httpFailure; httpFailure = undefined;
      res.writeHead(failure.status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { message: failure.message } })); return;
    }
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    if (failNext) { failNext = false; res.end(`data: ${JSON.stringify({ error: { message: "Cannot read properties of undefined (reading 'sendMessage')" } })}\n\n`); return; }
    const output = nextResult ?? expected; nextResult = undefined;
    res.end(`data: ${JSON.stringify({ choices: [{ delta: { content: output } }] })}\n\ndata: [DONE]\n\n`);
  } else if (req.url === '/v1/models') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ data: [{ id: 'test-model' }, { id: 'other-model' }] }));
  } else {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<!doctype html><html><head><title>Selection test</title></head><body><p id="sample">This is a sentence selected for translation.</p><button id="focus">Focus page</button><script>document.addEventListener("copy", event => { event.clipboardData.setData("text/plain", "Wrong text from webpage"); event.preventDefault(); });</script></body></html>');
  }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
const browser = spawn(executable, [
  '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
  `--load-extension=${resolve('.output/chrome-mv3')}`, '--no-first-run', '--no-default-browser-check',
  '--enable-unsafe-extension-debugging',
  '--no-proxy-server', '--host-resolver-rules=MAP glearn.test 127.0.0.1', '--window-size=900,900', 'about:blank',
], { windowsHide: true, stdio: 'ignore' });
let ws;
try {
  let activePort;
  for (let i = 0; i < 100; i++) {
    try { activePort = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).trim().split(/\r?\n/); break; } catch { await pause(100); }
  }
  assert.ok(activePort, 'Browser exposes a debugging endpoint');
  ws = new WebSocket(`ws://127.0.0.1:${activePort[0]}${activePort[1]}`);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let id = 0;
  const pending = new Map();
  const errors = [];
  ws.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const call = pending.get(message.id); pending.delete(message.id);
      if (message.error) call.reject(new Error(JSON.stringify(message.error))); else call.resolve(message.result);
    } else if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text + ': ' + (message.params.exceptionDetails.exception?.description || ''));
  };
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const callId = ++id; pending.set(callId, { resolve, reject }); ws.send(JSON.stringify({ id: callId, method, params, sessionId }));
  });
  const attach = async targetId => (await send('Target.attachToTarget', { targetId, flatten: true })).sessionId;
  const evaluate = async (sessionId, expression, userGesture = false) => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, userGesture }, sessionId);
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  };
  const until = async (sessionId, expression) => {
    for (let i = 0; i < 80; i++) { if (await evaluate(sessionId, expression)) return; await pause(100); }
    throw new Error('Timed out waiting for ' + expression + '\n' + await evaluate(sessionId, 'typeof document === "undefined" ? "worker" : document.body.innerText') + '\nrequests: ' + JSON.stringify(requests) + '\nerrors: ' + JSON.stringify(errors));
  };
  if (/[/\\]chrome(?:\.exe)?$/i.test(executable)) await send('Extensions.loadUnpacked', { path: resolve('.output/chrome-mv3') });
  let targets;
  let worker;
  for (let i = 0; i < 50; i++) {
    targets = (await send('Target.getTargets')).targetInfos;
    worker = targets.find(target => target.type === 'service_worker' && target.url.startsWith('chrome-extension://') && target.url.endsWith('/background.js'));
    if (worker) break; await pause(100);
  }
  assert.ok(worker, JSON.stringify(targets));
  const extensionId = new URL(worker.url).host;
  await send('Browser.grantPermissions', { permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'], origin: `chrome-extension://${extensionId}` });
  const workerSession = await attach(worker.targetId);
  await send('Runtime.enable', {}, workerSession);
  await until(workerSession, 'typeof chrome !== "undefined" && !!chrome.storage');
  assert.equal(await evaluate(workerSession, 'chrome.runtime.getManifest().name'), '拾译');
  await until(workerSession, '(async () => !!(await chrome.storage.local.get("config")).config)()');
  await evaluate(workerSession, `chrome.storage.local.set({ config: JSON.stringify({ on: true, service: 'custom', custom: 'http://127.0.0.1:${port}/v1/chat/completions', customModel: { custom: 'test-model' }, model: { custom: '自定义模型' }, useCache: false, to: 'zh-Hans' }) })`);
  const { targetId: popupId } = await send('Target.createTarget', { url: `chrome-extension://${extensionId}/popup.html` });
  const popup = await attach(popupId);
  await send('Runtime.enable', {}, popup);
  await until(popup, '!!document.querySelector("#translation-text")');
  await until(popup, 'document.activeElement?.id === "translation-text"');
  await until(popup, '!!document.querySelector(".input-shortcuts")');
  assert.deepEqual(await evaluate(popup, '[...document.querySelectorAll(".theme-segment span")].map(el => el.textContent)'), ['系统', '浅色', '深色']);
  await evaluate(popup, 'document.querySelector("input[name=theme][value=dark]").click()');
  await until(popup, 'document.documentElement.classList.contains("dark")');
  await evaluate(popup, 'document.querySelector("input[name=theme][value=light]").click()');
  await until(popup, '!document.documentElement.classList.contains("dark")');
  await evaluate(popup, 'document.querySelector("input[name=theme][value=auto]").click()');
  assert.ok(await evaluate(popup, 'document.body.textContent.includes("0.0.2")'));
  assert.equal(await evaluate(popup, 'document.body.textContent.includes("AI 文本翻译")'), false);
  assert.equal(await evaluate(popup, '!!document.querySelector(".model-summary")'), false);
  assert.equal(await evaluate(popup, '[...document.querySelectorAll("button")].some(button => button.textContent.trim() === "翻译")'), false);
  assert.equal(await evaluate(popup, '!!document.querySelector(".settings-fields")'), false);
  assert.equal(await evaluate(popup, '!!document.querySelector("[aria-label=启用插件]")'), false);
  assert.equal(await evaluate(popup, '!!document.querySelector("[aria-label=划词显示方式]")'), false);
  assert.equal(await evaluate(popup, '!!document.querySelector("details")'), false);
  assert.ok(await evaluate(popup, 'document.body.innerText.includes("主题") && document.body.innerText.includes("缓存译文")'));
  assert.equal(await evaluate(popup, '!!document.querySelector("[aria-label=动画效果]")'), false);
  assert.equal(await evaluate(popup, 'document.querySelector(".clear-cache").getAttribute("aria-label")'), '清除翻译缓存');
  assert.equal(await evaluate(popup, 'document.querySelector(".clear-cache").textContent.trim()'), '');
  assert.ok(await evaluate(popup, 'document.querySelector("#translation-text").getBoundingClientRect().height < 40 && document.querySelector("#translation-text").getBoundingClientRect().top < 20'));
  const fill = async text => evaluate(popup, `(() => { const input = document.querySelector('#translation-text'); input.focus(); input.value = ${JSON.stringify(text)}; input.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  const key = async (type, modifiers = 0) => send('Input.dispatchKeyEvent', { type, key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13, modifiers }, popup);
  await fill('first line');
  await key('keyDown', 2); await key('keyUp', 2);
  assert.equal(await evaluate(popup, 'document.querySelector("#translation-text").value'), 'first line\n');
  assert.equal(requests.length, 0);
  assert.ok(await evaluate(popup, 'document.querySelector("#translation-text").getBoundingClientRect().height > 40'));
  await evaluate(popup, `document.querySelector('#translation-text').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true, cancelable: true }))`);
  await pause(150); assert.equal(requests.length, 0);
  assert.ok(await evaluate(popup, '!!document.querySelector(".input-shortcuts")'));
  await fill('This is a popup sentence to translate.');
  await key('keyDown'); await key('keyUp');
  await until(popup, '!!document.querySelector(".popup-translation-card .fr-translation-result pre")?.textContent');
  assert.equal(await evaluate(popup, 'document.querySelector(".popup-translation-card .fr-translation-result pre").textContent'), expected);
  assert.equal(await evaluate(popup, '!!document.querySelector(".popup-translation-card .fr-original-text")'), false);
  assert.equal(requests.length, 1);
  await until(popup, '!document.querySelector(".input-shortcuts")');
  const cardHeight = await evaluate(popup, 'document.querySelector(".popup-translation-card").getBoundingClientRect().height');
  await evaluate(popup, 'document.querySelector(".fr-action-btn").click()', true);
  await until(popup, 'document.body.textContent.includes("译文已复制")');
  assert.equal(await evaluate(popup, 'document.querySelector(".popup-translation-card").getBoundingClientRect().height'), cardHeight);
  assert.ok(await evaluate(popup, '!!document.querySelector(".fr-copy-success svg polyline")'));
  await until(workerSession, '(async () => (await chrome.storage.local.get("textTranslationShortcutsLearned")).textTranslationShortcutsLearned === true)()');
  const { targetId: reopenedId } = await send('Target.createTarget', { url: `chrome-extension://${extensionId}/popup.html` });
  const reopened = await attach(reopenedId);
  await until(reopened, 'document.activeElement?.id === "translation-text"');
  assert.equal(await evaluate(reopened, '!!document.querySelector(".input-shortcuts")'), false);
  await send('Target.closeTarget', { targetId: reopenedId });
  assert.equal((await evaluate(popup, 'navigator.clipboard.readText()', true)).replaceAll('\r\n', '\n'), expected);
  console.log('✓ Popup: Enter translates, Ctrl+Enter inserts newline, IME does not translate, copy writes multiline text');
  await evaluate(popup, 'document.querySelector(".fr-close-btn").click()');
  assert.equal(await evaluate(popup, '!!document.querySelector(".popup-translation-card")'), false);
  assert.ok(await evaluate(popup, 'document.querySelector("#translation-text").value.includes("popup sentence")'));
  await evaluate(popup, 'document.querySelector("#translation-text").focus()');
  await key('keyDown'); await key('keyUp');
  await until(popup, '!!document.querySelector(".fr-translation-result pre")?.textContent');
  assert.equal(requests.length, 2);
  await evaluate(popup, 'document.querySelector(".status-right").click()');
  await until(popup, '!!document.querySelector(".settings-fields")');
  assert.ok(await evaluate(popup, 'document.body.textContent.includes("模型 API")'));
  assert.equal(await evaluate(popup, '!!document.querySelector(".toolbar")'), false);
  assert.equal(await evaluate(popup, '[...document.querySelectorAll("button")].filter(button => button.textContent.trim() === "返回").length'), 1);
  assert.equal(await evaluate(popup, 'document.querySelector(".fetch-models").textContent.trim()'), '');
  assert.ok(await evaluate(popup, '!!document.querySelector(".fetch-models svg")'));
  assert.equal(await evaluate(popup, 'document.querySelector(".fetch-models").getAttribute("aria-label")'), '获取模型列表');
  assert.ok(await evaluate(popup, 'document.querySelector(".model-controls").textContent.includes("test-model")'));
  assert.equal(await evaluate(popup, 'document.querySelectorAll(".settings-fields label").length > 0 && [...document.querySelectorAll(".settings-fields label")].some(el => el.textContent.trim().startsWith("模型名称"))'), false);
  await evaluate(popup, 'document.querySelector(".fetch-models").click()');
  await until(workerSession, '(async () => JSON.parse((await chrome.storage.local.get("config")).config).cachedModels.custom?.includes("other-model"))()');
  await evaluate(popup, '(() => { const input = document.querySelector(".model-controls input"); input.focus(); input.value = "manual-model"; input.dispatchEvent(new Event("input", { bubbles: true })); })()');
  await until(popup, 'document.body.textContent.includes("manual-model")');
  await key('keyDown'); await key('keyUp');
  await until(workerSession, '(async () => JSON.parse((await chrome.storage.local.get("config")).config).model.custom === "manual-model")()');
  await evaluate(popup, '(() => { const input = document.querySelector(".model-controls input"); input.focus(); input.value = "test-model"; input.dispatchEvent(new Event("input", { bubbles: true })); })()');
  await pause(200);
  await key('keyDown'); await key('keyUp');
  await until(workerSession, '(async () => JSON.parse((await chrome.storage.local.get("config")).config).model.custom === "test-model")()');
  assert.equal(await evaluate(popup, 'document.body.innerText.includes("设置已自动保存")'), false);
  await mkdir('temp', { recursive: true });
  await send('Emulation.setDeviceMetricsOverride', { width: 380, height: 650, deviceScaleFactor: 1, mobile: false }, popup);
  await pause(300);
  await writeFile('temp/settings-overview.png', Buffer.from((await send('Page.captureScreenshot', {}, popup)).data, 'base64'));
  assert.equal(await evaluate(popup, '!!document.querySelector("details")'), false);
  assert.ok(await evaluate(popup, 'document.body.innerText.includes("System Prompt") && document.body.innerText.includes("User Prompt")'));
  assert.equal(await evaluate(popup, '/配置备份|导入配置|导出配置|User 提示词支持/.test(document.body.innerText)'), false);
  assert.equal(await evaluate(popup, 'document.body.innerText.includes("支持 {{to}}")'), false);
  assert.equal(await evaluate(popup, 'document.querySelectorAll(".preferences textarea").length'), 1);
  assert.ok(await evaluate(popup, 'document.querySelector("#system-prompt").getBoundingClientRect().height > 150'));
  const initialSystemPrompt = await evaluate(popup, 'document.querySelector("#system-prompt").value');
  await evaluate(popup, '(() => { const input = document.querySelector("#system-prompt"); input.value = "Custom system prompt"; input.dispatchEvent(new Event("input", { bubbles: true })); document.querySelector("#user-prompt-tab").click(); })()');
  await until(popup, '!!document.querySelector("#user-prompt")');
  assert.equal(await evaluate(popup, 'document.querySelectorAll(".preferences textarea").length'), 1);
  const initialUserPrompt = await evaluate(popup, 'document.querySelector("#user-prompt").value');
  await evaluate(popup, '(() => { const input = document.querySelector("#user-prompt"); input.value = "Custom user prompt"; input.dispatchEvent(new Event("input", { bubbles: true })); document.querySelector("#system-prompt-tab").click(); })()');
  await until(popup, 'document.querySelector("#system-prompt")?.value === "Custom system prompt"');
  await evaluate(popup, 'document.querySelector(".reset-prompts").click()');
  await until(popup, 'document.querySelector("#system-prompt")?.value === ' + JSON.stringify(initialSystemPrompt));
  await evaluate(popup, 'document.querySelector("#user-prompt-tab").click()');
  await until(popup, 'document.querySelector("#user-prompt")?.value === "Custom user prompt"');
  await evaluate(popup, 'document.querySelector(".reset-prompts").click()');
  await until(popup, 'document.querySelector("#user-prompt")?.value === ' + JSON.stringify(initialUserPrompt));
  await until(workerSession, '(async () => { const c = JSON.parse((await chrome.storage.local.get("config")).config); return c.system_role.custom === ' + JSON.stringify(initialSystemPrompt) + ' && c.user_role.custom === ' + JSON.stringify(initialUserPrompt) + '; })()');
  await evaluate(popup, 'document.querySelector(".prompt-tip").scrollIntoView({ block: "center" })');
  const promptTip = await evaluate(popup, '(() => { const r = document.querySelector(".prompt-tip").getBoundingClientRect(); return { x: r.x + r.width/2, y: r.y + r.height/2 }; })()');
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...promptTip }, popup);
  await until(popup, 'document.body.innerText.includes("支持 {{to}}（目标语言）与 {{origin}}（原文）占位符。")');
  console.log('✓ Input receives focus automatically; backup controls are removed; User Prompt hint appears on hover');
  assert.equal(await evaluate(popup, '!!document.querySelector("[aria-label=主题]")'), false);
  await mkdir('temp', { recursive: true });
  await send('Emulation.setDeviceMetricsOverride', { width: 380, height: 650, deviceScaleFactor: 1, mobile: false }, popup);
  await pause(300);
  await writeFile('temp/settings.png', Buffer.from((await send('Page.captureScreenshot', {}, popup)).data, 'base64'));
  await evaluate(popup, 'document.querySelector(".status-right").click()');
  await until(popup, '!!document.querySelector("#translation-text")');
  await until(popup, 'document.activeElement?.id === "translation-text"');
  await mkdir('temp', { recursive: true });
  await send('Emulation.setDeviceMetricsOverride', { width: 380, height: 650, deviceScaleFactor: 1, mobile: false }, popup);
  await writeFile('temp/popup.png', Buffer.from((await send('Page.captureScreenshot', {}, popup)).data, 'base64'));

  const { targetId: pageId } = await send('Target.createTarget', { url: `http://glearn.test:${port}/` });
  const page = await attach(pageId);
  await send('Runtime.enable', {}, page);
  await until(page, '!!document.querySelector("#glearn-selection-translator-container")');
  assert.equal(await evaluate(page, 'window.isSecureContext'), false);
  await evaluate(page, `(() => { const selection = getSelection(); const range = document.createRange(); range.selectNodeContents(document.querySelector('#sample')); selection.removeAllRanges(); selection.addRange(range); document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })); })()`);
  await until(page, '!!document.querySelector(".fr-selection-indicator")');
  await evaluate(page, 'document.querySelector(".fr-selection-indicator").click()');
  await until(page, '!!document.querySelector(".fr-translation-result pre")?.textContent');
  assert.equal(await evaluate(page, 'document.querySelector(".fr-translation-result pre").textContent'), expected);
  assert.equal(requests.length, 3);
  assert.equal(await evaluate(page, '!!document.querySelector(".fr-original-text")'), false);
  assert.equal(requests.at(-1).messages[1].content.includes('bilingual display requested'), false);
  const button = await evaluate(page, `(() => { const r = document.querySelector('[aria-label="复制译文"]').getBoundingClientRect(); return { x: r.x + r.width/2, y: r.y + r.height/2 }; })()`);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...button }, page);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...button }, page);
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...button }, page);
  await until(page, 'document.querySelector(".fr-copy-status")?.textContent === "译文已复制"');
  await send('Page.bringToFront', {}, popup);
  assert.equal((await evaluate(popup, 'navigator.clipboard.readText()', true)).replaceAll('\r\n', '\n'), expected);
  assert.equal(await evaluate(page, 'getSelection().toString()'), 'This is a sentence selected for translation.');
  assert.equal(await evaluate(page, '!!document.querySelector(".fr-translation-tooltip")'), true);
  assert.equal(requests.length, 3);
  await send('Page.bringToFront', {}, page);
  await writeFile('temp/selection.png', Buffer.from((await send('Page.captureScreenshot', {}, page)).data, 'base64'));
  console.log('✓ HTTP page: selection translation reaches background API, extension copy bypasses webpage copy interception and preserves selected text');
  // Compare with the former in-page fallback: the page replaces the copied text.
  await evaluate(page, `(() => { const input = document.createElement('textarea'); input.value = 'Previous copy implementation'; document.body.appendChild(input); input.select(); document.execCommand('copy'); input.remove(); })()`, true);
  await send('Page.bringToFront', {}, popup);
  assert.equal(await evaluate(popup, 'navigator.clipboard.readText()', true), 'Wrong text from webpage');
  console.log('✓ Reproduced the former copy failure when the host page intercepts copy events');
  await evaluate(page, 'document.querySelector("[aria-label=固定卡片]").click()');
  await until(page, 'document.querySelector("[aria-label=取消固定]")?.getAttribute("aria-pressed") === "true"');
  const pinnedPosition = await evaluate(page, '(() => { const r = document.querySelector(".fr-translation-tooltip").getBoundingClientRect(); return [r.x, r.y]; })()');
  await evaluate(page, 'document.querySelector("#focus").click(); getSelection().removeAllRanges(); document.querySelector(".fr-translation-tooltip").dispatchEvent(new MouseEvent("mouseleave")); document.body.style.height="2000px"; window.scrollTo(0, 500)');
  await pause(450);
  assert.equal(await evaluate(page, 'document.querySelector(".fr-translation-result pre")?.textContent'), expected);
  assert.deepEqual(await evaluate(page, '(() => { const r = document.querySelector(".fr-translation-tooltip").getBoundingClientRect(); return [r.x, r.y]; })()'), pinnedPosition);
  assert.equal(requests.length, 3);
  await evaluate(page, 'document.querySelector("[aria-label=取消固定]").click(); document.querySelector(".fr-translation-tooltip").dispatchEvent(new MouseEvent("mouseleave"))');
  await until(page, '!document.querySelector(".fr-translation-tooltip")');
  console.log('✓ Pinned card survives outside clicks, selection changes and scrolling; unpin restores dismissal');
  await evaluate(popup, 'document.querySelector(".fr-action-btn").click()', true);
  await until(popup, 'document.querySelector(".fr-copy-status")?.textContent === "译文已复制"');
  assert.equal((await evaluate(popup, 'navigator.clipboard.readText()', true)).replaceAll('\r\n', '\n'), expected);
  await evaluate(popup, 'document.querySelector(".clear-cache").click()');
  await until(popup, 'document.body.textContent.includes("翻译缓存已清除")');
  failNext = true;
  await evaluate(popup, 'document.querySelector("#translation-text").focus()');
  await key('keyDown'); await key('keyUp');
  await until(popup, 'document.querySelector(".fr-error-message")?.textContent.includes("sendMessage")');
  assert.ok(await evaluate(popup, 'document.querySelector(".fr-error-message").textContent.startsWith("翻译服务返回错误：")'));
  await evaluate(popup, 'document.querySelector(".fr-retry-btn").click()');
  await until(popup, 'document.querySelector(".fr-translation-result pre")?.textContent === ' + JSON.stringify(expected));
  console.log('✓ API error source is identified in the shared card, and retry succeeds');
  await evaluate(workerSession, '(async () => { const stored = await chrome.storage.local.get("config"); const config = JSON.parse(stored.config); config.theme = "dark"; await chrome.storage.local.set({ config: JSON.stringify(config) }); })()');
  await until(popup, 'document.documentElement.classList.contains("dark")');
  await pause(300);
  await writeFile('temp/popup-dark.png', Buffer.from((await send('Page.captureScreenshot', {}, popup)).data, 'base64'));
  await evaluate(popup, 'document.querySelector(".status-right").click()');
  await until(popup, '!!document.querySelector(".fetch-models")');
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 0, y: 0 }, popup);
  assert.equal(await evaluate(popup, 'getComputedStyle(document.querySelector(".fetch-models")).backgroundColor'), 'rgba(0, 0, 0, 0)');
  await pause(300);
  await writeFile('temp/settings-dark.png', Buffer.from((await send('Page.captureScreenshot', {}, popup)).data, 'base64'));
  console.log('✓ Dark theme keeps icon actions visually quiet');
  await evaluate(popup, 'document.querySelector(".status-right").click()');
  await until(popup, '!!document.querySelector("#translation-text")');
  await evaluate(workerSession, '(async () => { const stored = await chrome.storage.local.get("config"); const config = JSON.parse(stored.config); config.to = ""; await chrome.storage.local.set({ config: JSON.stringify(config) }); })()');
  await until(popup, 'document.body.innerText.includes("智能")');
  for (const source of ['这是一个中文句子。', 'This is an English sentence.', 'こんにちは、世界。']) {
    await fill(source); await key('keyDown'); await key('keyUp');
    await until(popup, 'document.querySelector(".fr-translation-result pre")?.textContent === ' + JSON.stringify(expected));
    assert.ok(requests.at(-1).messages[1].content.includes('Target language is empty.'));
    assert.ok(requests.at(-1).messages[1].content.includes(source));
  }
  for (const failure of [{ status: 401, message: 'Invalid API key', label: '检查密钥', selector: '.settings-fields input[type=password]' }, { status: 400, message: 'The model test-model does not exist', label: '更换模型', selector: '.model-controls input' }]) {
    httpFailure = failure;
    await fill('Error action test'); await key('keyDown'); await key('keyUp');
    await until(popup, 'document.querySelector(".fr-retry-btn")?.textContent === ' + JSON.stringify(failure.label));
    await evaluate(popup, 'document.querySelector(".fr-retry-btn").click()');
    await until(popup, 'document.activeElement === document.querySelector(' + JSON.stringify(failure.selector) + ')');
    await evaluate(popup, 'document.querySelector(".status-right").click()');
    await until(popup, '!!document.querySelector("#translation-text")');
  }
  console.log('✓ Intelligent mode sends empty target instructions; credential and model errors focus the relevant configuration');
  httpFailure = { status: 401, message: 'Invalid API key' };
  await evaluate(page, `(() => { window.scrollTo(0, 0); document.querySelector('#sample').textContent = 'A different sentence to test opening settings.'; const selection = getSelection(); const range = document.createRange(); range.selectNodeContents(document.querySelector('#sample')); selection.removeAllRanges(); selection.addRange(range); document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })); })()`);
  await until(page, '!!document.querySelector(".fr-selection-indicator")');
  await evaluate(page, 'document.querySelector(".fr-selection-indicator").click()');
  await until(page, 'document.querySelector(".fr-retry-btn")?.textContent === "检查密钥"');
  await evaluate(page, 'document.querySelector(".fr-retry-btn").click()', true);
  let settingsTarget;
  for (let i = 0; i < 80; i++) {
    settingsTarget = (await send('Target.getTargets')).targetInfos.find(target => target.url.endsWith('/popup.html#settings-credentials'));
    if (settingsTarget) break; await pause(100);
  }
  assert.ok(settingsTarget, 'Selection error opens an extension settings tab');
  const settingsSession = await attach(settingsTarget.targetId);
  await send('Runtime.enable', {}, settingsSession);
  await until(settingsSession, 'document.activeElement === document.querySelector(".settings-fields input[type=password]")');
  await send('Target.closeTarget', { targetId: settingsTarget.targetId });
  console.log('✓ Selection error opens settings with the credential input focused');
  nextResult = 'cat /kæt/\nn. 猫';
  await evaluate(page, `(() => { document.querySelector('[aria-label="关闭翻译"]').click(); document.querySelector('#sample').textContent = 'cat'; const selection = getSelection(); const range = document.createRange(); range.selectNodeContents(document.querySelector('#sample')); selection.removeAllRanges(); selection.addRange(range); document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })); })()`);
  await until(page, '!!document.querySelector(".fr-selection-indicator")');
  await evaluate(page, 'document.querySelector(".fr-selection-indicator").click()');
  await until(page, 'document.querySelector(".fr-translation-result pre")?.textContent === "cat /kæt/\\nn. 猫"');
  assert.equal(await evaluate(page, '!!document.querySelector(".fr-original-text")'), false);
  assert.equal(await evaluate(page, 'document.querySelector(".fr-tooltip-content").innerText.trim()'), 'cat /kæt/\nn. 猫');
  await evaluate(page, 'document.querySelector("[aria-label=复制译文]").click()', true);
  await until(page, '!!document.querySelector(".fr-copy-success")');
  await send('Page.bringToFront', {}, popup);
  assert.equal((await evaluate(popup, 'navigator.clipboard.readText()', true)).replaceAll('\r\n', '\n'), 'cat /kæt/\nn. 猫');
  console.log('✓ Word and IPA remain on one line; the card displays and copies the AI response unchanged without a duplicate source');
  await evaluate(popup, 'document.querySelector(".status-right").click()');
  await until(popup, '!!document.querySelector(".address-controls input")');
  assert.equal(await evaluate(popup, '/代理接口|New API 地址|Azure 部署端点/.test(document.body.innerText)'), false);
  assert.equal(await evaluate(popup, 'document.querySelector(".address-controls input").value'), `http://127.0.0.1:${port}/v1/chat/completions`);
  await evaluate(popup, 'document.querySelector(".reset-address").click()');
  await until(popup, 'document.querySelector(".address-controls input")?.value === "http://localhost:11434/v1/chat/completions"');
  await until(workerSession, '(async () => JSON.parse((await chrome.storage.local.get("config")).config).custom === "http://localhost:11434/v1/chat/completions")()');
  await evaluate(workerSession, '(async () => { const stored = await chrome.storage.local.get("config"); const config = JSON.parse(stored.config); config.service = "deepseek"; config.proxy.deepseek = "https://gateway.test/chat/completions"; await chrome.storage.local.set({ config: JSON.stringify(config) }); })()');
  await until(popup, 'document.querySelector(".address-controls input")?.value === "https://gateway.test/chat/completions"');
  await evaluate(popup, 'document.querySelector(".reset-address").click()');
  await until(popup, 'document.querySelector(".address-controls input")?.value === "https://api.deepseek.com/chat/completions"');
  await until(workerSession, '(async () => JSON.parse((await chrome.storage.local.get("config")).config).proxy.deepseek === "")()');
  assert.equal(await evaluate(popup, '!!document.querySelector(".reset-address")'), false);
  console.log('✓ API address displays saved gateways and provider defaults; reset persists without a separate proxy field');
  assert.deepEqual(errors, []);
  console.log('✓ No uncaught browser errors');
} finally {
  ws?.close(); browser.kill(); server.closeAllConnections(); server.close();
  assert.ok(resolve(profile).startsWith(join(tmpdir(), 'glearn-browser-')));
  for (let i = 0; i < 20; i++) { try { await rm(profile, { recursive: true, force: true }); break; } catch { await pause(100); } }
}

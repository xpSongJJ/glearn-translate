import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { assessTranslation, liveCases } from './translation-cases.mjs';

if (existsSync('.env.local')) process.loadEnvFile('.env.local');
const apiKey = process.env.DEEPSEEK_API_KEY;
assert.ok(apiKey, 'Set DEEPSEEK_API_KEY in .env.local or the environment to run real model evaluation.');
const model = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
const rounds = Number(process.env.TRANSLATION_EVAL_ROUNDS || 2);
const concurrency = Number(process.env.TRANSLATION_EVAL_CONCURRENCY || 4);
assert.ok(Number.isInteger(rounds) && rounds > 0 && rounds <= 10, 'Rounds must be 1–10.');
assert.ok(Number.isInteger(concurrency) && concurrency > 0 && concurrency <= 8, 'Concurrency must be 1–8.');
const base = (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, '');
const endpoint = base.endsWith('/chat/completions') ? base : base + '/chat/completions';
const temp = await mkdtemp(join(tmpdir(), 'glearn-live-'));
try {
  const require = createRequire(import.meta.url);
  const { build } = createRequire(require.resolve('vite'))('esbuild');
  const bundle = join(temp, 'prompts.mjs');
  await build({
    stdin: { contents: `export * from './entrypoints/utils/config'; export * from './entrypoints/utils/template'; export * from './entrypoints/utils/common'; export * from './entrypoints/utils/translationQuality';`, resolveDir: resolve('.') },
    outfile: bundle, bundle: true, platform: 'node', format: 'esm', alias: { '@': resolve('.') },
    plugins: [{ name: 'storage-mock', setup(build) {
      build.onResolve({ filter: /^@wxt-dev\/storage$/ }, () => ({ path: 'storage', namespace: 'mock' }));
      build.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({ contents: 'export const storage = { getItem: async () => null, setItem: async () => {}, watch: () => {} };' }));
    } }],
  });
  const m = await import(pathToFileURL(bundle).href);
  await m.configReady;
  Object.assign(m.config, m.normalizeConfig({ service: 'deepseek', customModel: { deepseek: model }, to: '', useCache: false }));
  const items = liveCases();
  const queue = Array.from({ length: rounds }, (_, round) => items.map(item => ({ ...item, round: round + 1 }))).flat();
  const results = [];
  let apiRequests = 0;
  let next = 0;
  console.log(`Evaluating ${queue.length} real requests (${items.length} cases × ${rounds} rounds), model=${model}.`);
  async function worker() {
    while (next < queue.length) {
      const item = queue[next++];
      const started = Date.now();
      const attempts = [];
      try {
        const payload = JSON.parse(m.deepseekMsgTemplate(item.source));
        payload.stream = false;
        payload.max_tokens = 2048;
        const output = await m.translateWithQualityCheck({
          origin: item.source, target: m.resolveTargetLanguage(item.source, ''), enabled: true,
          request: async (correction, previous) => {
            const request = correction ? { ...payload, messages: [...payload.messages, { role: 'assistant', content: previous }, { role: 'user', content: correction }] } : payload;
            apiRequests++;
            const response = await fetch(endpoint, {
              method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
              body: JSON.stringify(request), signal: AbortSignal.timeout(45000),
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            const text = data.choices?.[0]?.message?.content || '';
            attempts.push(text);
            return text;
          },
        });
        results.push({ ...item, output, attempts, failures: assessTranslation(item, output), milliseconds: Date.now() - started });
      } catch (error) {
        results.push({ ...item, output: '', attempts, failures: ['request failed: ' + error.message], milliseconds: Date.now() - started });
      }
      const latest = results.at(-1);
      if (latest.failures.length) console.log(JSON.stringify({ source: latest.source, round: latest.round, failures: latest.failures, output: latest.output }));
      if (results.length % 20 === 0) console.log(`Completed ${results.length}/${queue.length}; failures=${results.filter(row => row.failures.length).length}`);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  const failed = results.filter(row => row.failures.length);
  const report = { timestamp: new Date().toISOString(), model, rounds, total: results.length, apiRequests, retriedCases: results.filter(row => row.attempts.length > 1).length, formatAdjustedCases: results.filter(row => row.output && row.attempts.at(-1) !== row.output).length, passed: results.length - failed.length, failed: failed.length, results };
  await mkdir('temp', { recursive: true });
  await writeFile('temp/translation-live-results.json', JSON.stringify(report, null, 2));
  console.log(`${report.passed}/${report.total} passed. Full outputs: temp/translation-live-results.json`);
  for (const row of failed) console.log(JSON.stringify({ source: row.source, round: row.round, failures: row.failures, output: row.output }));
  if (failed.length) process.exitCode = 1;
} finally {
  await rm(temp, { recursive: true, force: true });
}

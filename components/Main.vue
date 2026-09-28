<template>
  <div class="translator" v-if="ready">
    <template v-if="!showAdvanced">
      <div class="toolbar">
        <span>AI 文本翻译</span>
        <el-switch v-model="config.on" aria-label="启用插件" inline-prompt active-text="开" inactive-text="关" />
      </div>
      <button class="model-summary" @click="showAdvanced = true">
        <span>{{ serviceLabel }} · {{ selectedModel || '未选择模型' }}</span>
        <span class="subtle">配置 ›</span>
      </button>
      <div v-if="configurationError && config.on" class="setup-tip">
        {{ configurationError }}
        <el-button link type="primary" @click="showAdvanced = true">去配置</el-button>
      </div>
      <label class="field-label" for="translation-text">原文</label>
      <el-input id="translation-text" v-model="text" type="textarea" :rows="4" resize="none"
        placeholder="输入或粘贴文本，Ctrl / ⌘ + Enter 翻译" :disabled="loading || !config.on"
        @keydown="handleInputKeydown" />
      <div class="translation-actions">
        <el-select v-model="config.to" aria-label="目标语言" :disabled="loading">
          <el-option v-for="item in options.to" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
        <el-button type="primary" :loading="loading" :disabled="!canTranslate" @click="translate">翻译</el-button>
      </div>
      <section v-if="loading || result || error" class="result-panel" aria-live="polite" aria-label="翻译结果">
        <div class="result-heading">
          <span>{{ loading ? '正在翻译…' : '译文' }}</span>
          <el-button v-if="result" link type="primary" @click="copyResult">复制</el-button>
        </div>
        <p v-if="error" class="error-text">{{ error }}</p>
        <pre v-if="result">{{ result }}</pre>
        <el-button v-if="error && canTranslate" size="small" @click="translate">重试</el-button>
      </section>
      <p v-if="!config.on" class="subtle">插件已暂停，开启后可继续翻译。</p>
      <div class="selection-setting">
        <span>划词翻译</span>
        <el-select v-model="config.selectionTranslatorMode" aria-label="划词显示方式">
          <el-option label="关闭" value="disabled" />
          <el-option label="双语显示" value="bilingual" />
          <el-option label="只显示译文" value="translation-only" />
        </el-select>
      </div>
      <p class="hint">选中文本后，点击或悬停翻译圆点查看译文。</p>
    </template>

    <template v-else>
      <div class="toolbar"><span>更多设置</span><el-button link type="primary" @click="showAdvanced = false">返回翻译</el-button></div>
      <h2>模型 API</h2>
      <p class="hint">设置自动保存，密钥保存在当前浏览器。</p>
      <div class="settings-fields">
        <label>AI 服务
          <el-select v-model="config.service" filterable aria-label="AI 服务">
            <el-option v-for="item in options.services" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </label>
        <label v-if="servicesType.isUseToken(config.service)">API Key {{ config.service === services.custom ? '（本地服务可留空）' : '' }}
          <el-input v-model="config.token[config.service]" type="password" show-password placeholder="填写 API Key" />
        </label>
        <template v-if="servicesType.isUseAkSk(config.service)">
          <label>API Key<el-input v-model="config.ak" type="password" show-password /></label>
          <label>Secret Key<el-input v-model="config.sk" type="password" show-password /></label>
        </template>
        <template v-if="servicesType.isTencent(config.service)">
          <label>Secret ID<el-input v-model="config.tencentSecretId" /></label>
          <label>Secret Key<el-input v-model="config.tencentSecretKey" type="password" show-password /></label>
        </template>
        <label v-if="servicesType.isCoze(config.service)">机器人 ID<el-input v-model="config.robot_id[config.service]" /></label>
        <label v-if="config.service === services.custom">接口地址
          <el-input v-model="config.custom" placeholder="http://localhost:11434/v1/chat/completions" />
        </label>
        <label v-if="config.service === services.newapi">New API 地址
          <el-input v-model="config.newApiUrl" placeholder="https://example.com 或完整接口地址" />
        </label>
        <label v-if="config.service === services.azureOpenai">Azure 部署端点
          <el-input v-model="config.azureOpenaiEndpoint" placeholder="https://…/chat/completions?api-version=…" />
        </label>
        <label v-if="servicesType.isUseProxy(config.service) && config.service !== services.azureOpenai">代理接口（可选）
          <el-input v-model="config.proxy[config.service]" placeholder="填写完整翻译接口地址" />
        </label>
        <template v-if="servicesType.isUseModel(config.service)">
          <label>模型
            <div class="model-controls">
              <el-select v-model="modelChoice" filterable aria-label="模型">
                <el-option v-for="model in modelList" :key="model" :label="model" :value="model" />
              </el-select>
              <el-button :loading="loadingModels" :disabled="!canFetchModels" @click="refreshModels">获取列表</el-button>
            </div>
          </label>
          <label v-if="modelChoice === customModelString">模型名称
            <el-input v-model="config.customModel[config.service]" placeholder="输入服务商提供的模型 ID" />
          </label>
          <p v-if="modelError" class="error-text">{{ modelError }}</p>
          <p class="hint">可手动填写模型 ID；不支持获取列表的服务也可使用。</p>
        </template>
      </div>
      <details class="preferences">
        <summary>显示与翻译偏好</summary>
        <div class="settings-fields">
          <label>主题<el-select v-model="config.theme"><el-option v-for="item in options.theme" :key="item.value" :label="item.label" :value="item.value" /></el-select></label>
          <div class="selection-setting"><span>动画效果</span><el-switch v-model="config.animations" aria-label="动画效果" /></div>
          <div class="selection-setting"><span>缓存译文</span><el-switch v-model="config.useCache" aria-label="缓存译文" /></div>
          <el-button @click="clearCache">清除翻译缓存</el-button>
          <label>System 提示词<el-input v-model="config.system_role[config.service]" type="textarea" :rows="3" /></label>
          <label>User 提示词<el-input v-model="config.user_role[config.service]" type="textarea" :rows="4" /></label>
          <p class="hint">User 提示词支持 <span v-pre>{{to}} 与 {{origin}}</span> 占位符。</p>
          <el-button @click="resetPrompts">恢复默认提示词</el-button>
        </div>
      </details>
      <details class="preferences">
        <summary>配置备份</summary>
        <p class="hint">导出的配置包含 API 密钥，请妥善保管。</p>
        <div class="backup-actions"><el-button @click="exportSettings">导出配置</el-button><el-button @click="showImport = !showImport">导入配置</el-button></div>
        <template v-if="showImport">
          <el-input v-model="importText" type="textarea" :rows="4" placeholder="粘贴 JSON 配置，兼容旧版本配置" />
          <el-button class="import-button" type="primary" @click="importSettings">应用配置</el-button>
        </template>
      </details>
      <p class="save-status" role="status">{{ saveError || '设置已自动保存' }}</p>
    </template>
  </div>
  <p v-else class="hint">正在加载设置…</p>
</template>

<script setup lang="ts">
import { computed, inject, onBeforeUnmount, ref, watch, type Ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import browser from 'webextension-polyfill';
import { config, configReady, normalizeConfig, saveConfig } from '@/entrypoints/utils/config';
import { customModelString, defaultOption, options, services, servicesType } from '@/entrypoints/utils/option';
import { fetchModels } from '@/entrypoints/utils/modelFetcher';
import { getConfigurationError } from '@/entrypoints/utils/check';
import { newApiEndpoint } from '@/entrypoints/utils/endpoint';
import { translateTextStream } from '@/entrypoints/utils/translateApi';
import { cache } from '@/entrypoints/utils/cache';

const showAdvanced = inject<Ref<boolean>>('showAdvanced')!;
const ready = ref(false);
const text = ref('');
const result = ref('');
const error = ref('');
const loading = ref(false);
let translationController: AbortController | undefined;
const loadingModels = ref(false);
const modelError = ref('');
const saveError = ref('');
const showImport = ref(false);
const importText = ref('');
const configurationError = computed(() => getConfigurationError());
const serviceLabel = computed(() => options.services.find(item => item.value === config.service)?.label || config.service);
const selectedModel = computed(() => config.model[config.service] === customModelString ? config.customModel[config.service] : config.model[config.service]);
const canTranslate = computed(() => ready.value && !loading.value && !!text.value.trim() && !configurationError.value);
const modelChoice = computed({
  get: () => config.model[config.service] || customModelString,
  set: value => { config.model[config.service] = value; },
});
const modelList = computed(() => {
  let cached: string[] = [];
  try { cached = JSON.parse(config.cachedModels[config.service] || '[]'); } catch { /* use manual entry */ }
  if (!Array.isArray(cached)) cached = [];
  return [...new Set([...cached.filter(item => typeof item === 'string'), ...(config.model[config.service] ? [config.model[config.service]] : []), customModelString])];
});
const canFetchModels = computed(() => !servicesType.isTencent(config.service) && config.service !== services.azureOpenai);
const media = window.matchMedia('(prefers-color-scheme: dark)');
const applyTheme = () => document.documentElement.classList.toggle('dark', config.theme === 'dark' || (config.theme === 'auto' && media.matches));
media.addEventListener('change', applyTheme);
watch(() => config.theme, applyTheme, { immediate: true });
watch(() => config.service, () => { modelError.value = ''; });

let persisted = '';
let stopSaving: (() => void) | undefined;
configReady.then(() => {
  persisted = JSON.stringify(config);
  ready.value = true;
  stopSaving = watch(config, async () => {
    const serialized = JSON.stringify(config);
    if (serialized === persisted) return;
    persisted = serialized;
    try { await saveConfig(); saveError.value = ''; }
    catch { persisted = ''; saveError.value = '保存失败，请重试'; }
  }, { deep: true });
});
onBeforeUnmount(() => { translationController?.abort(); stopSaving?.(); media.removeEventListener('change', applyTheme); });

function handleInputKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && !event.isComposing) {
    event.preventDefault();
    if (canTranslate.value) void translate();
  }
}
async function translate() {
  if (!canTranslate.value) return;
  translationController = new AbortController();
  loading.value = true; result.value = ''; error.value = '';
  try {
    await saveConfig();
    result.value = await translateTextStream(text.value.trim(), '文本翻译', chunk => { result.value += chunk; }, undefined, translationController.signal);
  } catch (err) { error.value = err instanceof Error ? err.message : '翻译失败，请重试'; }
  finally { loading.value = false; }
}
async function copyResult() {
  try { await navigator.clipboard.writeText(result.value); ElMessage.success('译文已复制'); }
  catch { ElMessage.error('复制失败，请手动选择译文复制'); }
}
async function refreshModels() {
  if (loadingModels.value) return;
  const service = config.service;
  loadingModels.value = true; modelError.value = '';
  try {
    const endpoint = service === services.custom ? config.custom : service === services.newapi ? newApiEndpoint(config.newApiUrl) : config.proxy[service];
    const list = await fetchModels(service, { token: config.token[service] || '', proxy: endpoint, ak: config.ak, sk: config.sk });
    if (!list?.length) throw new Error('无法获取模型列表，请检查密钥和地址，或手动填写模型名称');
    config.cachedModels[service] = JSON.stringify(list);
  } catch (err) {
    if (service === config.service) modelError.value = err instanceof Error ? err.message : '获取失败，请手动填写模型名称';
  } finally { loadingModels.value = false; }
}
function resetPrompts() {
  config.system_role[config.service] = defaultOption.system_role;
  config.user_role[config.service] = defaultOption.user_role;
  ElMessage.success('已恢复默认提示词');
}
async function clearCache() {
  cache.clean();
  const tabs = await browser.tabs.query({});
  await Promise.allSettled(tabs.filter(tab => tab.id).map(tab => browser.tabs.sendMessage(tab.id!, { type: 'clearCache' })));
  ElMessage.success('已清除已打开页面的翻译缓存');
}
function exportSettings() {
  const url = URL.createObjectURL(new Blob([JSON.stringify(normalizeConfig(config), null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = 'glearn-config.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function importSettings() {
  try {
    const value = JSON.parse(importText.value);
    if (!value || typeof value !== 'object' || Array.isArray(value) || typeof value.service !== 'string' || typeof value.on !== 'boolean') throw new Error('配置格式无效');
    await ElMessageBox.confirm('导入将覆盖当前设置，是否继续？', '导入配置', { confirmButtonText: '导入', cancelButtonText: '取消' });
    Object.assign(config, normalizeConfig(value)); await saveConfig();
    showImport.value = false; importText.value = ''; ElMessage.success('配置已导入');
  } catch (err) {
    if (err !== 'cancel' && err !== 'close') ElMessage.error(err instanceof Error ? err.message : '导入失败');
  }
}
</script>

<style scoped>
.translator { text-align: left; font-size: 14px; }
.toolbar, .translation-actions, .selection-setting, .result-heading, .model-summary { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.toolbar { font-weight: 600; margin-bottom: 12px; }
.model-summary { width: 100%; padding: 10px 12px; margin-bottom: 12px; border: 1px solid var(--el-border-color); border-radius: 8px; background: var(--el-fill-color-light); color: var(--el-text-color-primary); cursor: pointer; text-align: left; }
.model-summary > span:first-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.subtle { color: var(--el-text-color-secondary); flex-shrink: 0; font-size: 12px; }
.field-label { display: block; margin-bottom: 6px; }
.translation-actions { margin-top: 10px; }
.translation-actions .el-select { flex: 1; min-width: 0; }
.result-panel { margin-top: 14px; padding: 12px; background: var(--el-fill-color-light); border-radius: 8px; }
.result-heading { font-weight: 500; }
pre { white-space: pre-wrap; overflow-wrap: anywhere; font: inherit; line-height: 1.7; max-height: 180px; overflow-y: auto; margin: 8px 0 0; user-select: text; }
.selection-setting { padding-top: 14px; margin-top: 14px; border-top: 1px solid var(--el-border-color-lighter); }
.selection-setting .el-select { width: 160px; }
.hint, .save-status { font-size: 12px; line-height: 1.6; color: var(--el-text-color-secondary); margin: 8px 0; }
.setup-tip { padding: 10px; margin-bottom: 12px; border-radius: 6px; background: var(--el-color-warning-light-9); color: var(--el-color-warning-dark-2); font-size: 12px; }
h2 { font-size: 15px; margin: 16px 0 4px; }
.settings-fields { display: grid; gap: 12px; margin-top: 14px; }
.settings-fields label { display: grid; gap: 6px; font-size: 13px; }
.model-controls { display: flex; gap: 8px; }
.model-controls .el-select { flex: 1; min-width: 0; }
.error-text { color: var(--el-color-danger); font-size: 12px; overflow-wrap: anywhere; }
.preferences { border-top: 1px solid var(--el-border-color-lighter); margin-top: 18px; padding-top: 14px; }
summary { cursor: pointer; font-size: 13px; font-weight: 500; }
.backup-actions { display: flex; gap: 8px; margin: 12px 0; }
.import-button { margin-top: 8px; }
.save-status { text-align: right; margin-top: 16px; }
</style>

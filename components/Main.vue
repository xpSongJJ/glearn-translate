<template>
  <div class="translator" v-if="ready">
    <template v-if="!showAdvanced">
      <el-input ref="translationInput" id="translation-text" v-model="text" type="textarea" :autosize="{ minRows: 1, maxRows: 6 }" resize="none"
        aria-label="待翻译文本" placeholder="输入或粘贴文本" :disabled="loading"
        @keydown="handleInputKeydown" />
      <p v-if="!shortcutsLearned" class="input-shortcuts">Enter 翻译 · Ctrl+Enter 换行</p>
      <TranslationCard v-if="cardVisible" class="popup-translation-card" :origin="translatedOrigin" :result="result"
        :loading="loading" :error="error"
        @close="closeTranslation" @retry="translate" @configure="openSettings" @refresh="reloadPanel" />
      <div class="primary-settings">
        <label class="setting-row"><span>目标语言</span>
          <el-select v-model="config.to" :empty-values="[null, undefined]" aria-label="目标语言" :disabled="loading">
            <el-option v-for="item in options.to" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </label>
        <div class="setting-row"><span id="theme-label">主题</span>
          <div class="theme-segments" role="radiogroup" aria-labelledby="theme-label">
            <label v-for="item in themeChoices" :key="item.value" class="theme-segment">
              <input v-model="config.theme" type="radio" name="theme" :value="item.value" />
              <span>{{ item.label }}</span>
            </label>
          </div>
        </div>
        <div class="setting-row"><span>缓存译文</span>
          <div class="setting-actions">
            <el-tooltip content="清除翻译缓存" placement="top" :show-after="150">
              <el-button class="icon-action clear-cache" :icon="Delete" :loading="clearingCache" text
                aria-label="清除翻译缓存" @click="clearCache" />
            </el-tooltip>
            <el-switch v-model="config.useCache" aria-label="缓存译文" />
          </div>
        </div>
      </div>
      <div v-if="configurationError" class="setup-tip">
        {{ configurationError }} <el-button link type="primary" @click="showAdvanced = true">去配置</el-button>
      </div>
    </template>

    <template v-else>
      <h2>模型 API</h2>
      <div class="settings-fields">
        <label>AI 服务
          <el-select v-model="config.service" filterable aria-label="AI 服务">
            <el-option v-for="item in options.services" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </label>
        <label v-if="hasApiAddress">API 地址
          <div class="address-controls">
            <el-input v-model="apiAddress" aria-label="API 地址" :placeholder="apiAddressPlaceholder" />
            <el-tooltip v-if="apiAddressModified" content="恢复默认 API 地址" placement="top" :show-after="150">
              <el-button class="icon-action reset-address" :icon="RefreshLeft" text aria-label="恢复默认 API 地址" @click="resetApiAddress" />
            </el-tooltip>
          </div>
        </label>
        <label v-if="servicesType.isUseToken(config.service)">API Key
          <el-input v-model="config.token[config.service]" type="password" show-password
            :placeholder="config.service === services.custom ? '本地服务可留空' : '填写 API Key'" />
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
        <template v-if="servicesType.isUseModel(config.service)">
          <label>模型
            <div class="model-controls">
              <el-select v-model="modelChoice" filterable allow-create default-first-option aria-label="模型" placeholder="选择或输入模型 ID">
                <el-option v-for="model in modelList" :key="model" :label="model" :value="model" />
              </el-select>
              <el-tooltip v-if="canFetchModels" content="获取模型列表" placement="top" :show-after="150">
                <el-button class="icon-action fetch-models" :icon="Refresh" :loading="loadingModels"
                  text aria-label="获取模型列表" @click="refreshModels" />
              </el-tooltip>
            </div>
          </label>
          <p v-if="modelError" class="error-text">{{ modelError }}</p>
        </template>
      </div>
      <section class="preferences">
        <div class="section-heading">
          <div class="prompt-tabs" role="tablist" aria-label="提示词" @keydown="handlePromptTabKeydown">
            <button id="system-prompt-tab" class="prompt-tab" role="tab" :aria-selected="activePrompt === 'system'"
              :tabindex="activePrompt === 'system' ? 0 : -1" aria-controls="prompt-editor-panel" @click="activePrompt = 'system'">System Prompt</button>
            <button id="user-prompt-tab" class="prompt-tab" role="tab" :aria-selected="activePrompt === 'user'"
              :tabindex="activePrompt === 'user' ? 0 : -1" aria-controls="prompt-editor-panel" @click="activePrompt = 'user'">User Prompt</button>
            <el-tooltip v-if="activePrompt === 'user'" :content="userPromptHint" placement="top" :show-after="150">
              <button type="button" class="prompt-tip" aria-label="User Prompt 占位符说明"><QuestionFilled /></button>
            </el-tooltip>
          </div>
          <el-tooltip content="恢复当前 Prompt 的默认内容" placement="top" :show-after="150">
            <el-button class="icon-action reset-prompts" :icon="RefreshLeft" text aria-label="恢复默认 Prompt" @click="resetPrompts" />
          </el-tooltip>
        </div>
        <div id="prompt-editor-panel" role="tabpanel" :aria-labelledby="`${activePrompt}-prompt-tab`">
          <el-input :key="activePrompt" :id="`${activePrompt}-prompt`" v-model="promptValue" type="textarea"
            :aria-label="activePrompt === 'system' ? 'System Prompt' : 'User Prompt'" :autosize="{ minRows: 8, maxRows: 12 }" resize="none" />
        </div>
      </section>
      <p v-if="saveError" class="save-status error-text" role="status">{{ saveError }}</p>
    </template>
  </div>
  <p v-else class="hint">正在加载设置…</p>
</template>

<script setup lang="ts">
import { computed, inject, nextTick, onBeforeUnmount, ref, watch, type Ref } from 'vue';
import { ElMessage, ElTooltip, type InputInstance } from 'element-plus';
import { Delete, QuestionFilled, Refresh, RefreshLeft } from '@element-plus/icons-vue';
import { browser } from 'wxt/browser';
import TranslationCard from './TranslationCard.vue';
import { config, configReady, saveConfig } from '@/entrypoints/utils/config';
import { customModelString, defaultOption, options, services, servicesType } from '@/entrypoints/utils/option';
import { fetchModels } from '@/entrypoints/utils/modelFetcher';
import { getConfigurationError } from '@/entrypoints/utils/check';
import { newApiEndpoint, configuredApiAddress, defaultApiAddress, setApiAddress } from '@/entrypoints/utils/endpoint';
import { translateTextStream } from '@/entrypoints/utils/translateApi';
import { cache } from '@/entrypoints/utils/cache';

const showAdvanced = inject<Ref<boolean>>('showAdvanced')!;
const ready = ref(false);
const translationInput = ref<InputInstance>();
const text = ref('');
const result = ref('');
const error = ref('');
const loading = ref(false);
const cardVisible = ref(false);
const translatedOrigin = ref('');
const clearingCache = ref(false);
let translationId = 0;
let translationController: AbortController | undefined;
const loadingModels = ref(false);
const modelError = ref('');
const saveError = ref('');
const activePrompt = ref<'system' | 'user'>('system');
const promptValue = computed({
  get: () => (activePrompt.value === 'system' ? config.system_role : config.user_role)[config.service],
  set: (value: string) => { (activePrompt.value === 'system' ? config.system_role : config.user_role)[config.service] = value; },
});
const shortcutsLearned = ref(true);
const shortcutStorageKey = 'textTranslationShortcutsLearned';
void browser.storage.local.get(shortcutStorageKey).then(stored => {
  shortcutsLearned.value = stored[shortcutStorageKey] === true;
}).catch(() => { shortcutsLearned.value = false; });
const themeChoices = [{ value: 'auto', label: '系统' }, { value: 'light', label: '浅色' }, { value: 'dark', label: '深色' }];
const userPromptHint = '支持 {{to}}（目标语言）与 {{origin}}（原文）占位符。';
const configurationError = computed(() => getConfigurationError());
const canTranslate = computed(() => ready.value && !loading.value && !!text.value.trim());
const hasApiAddress = computed(() => servicesType.isUseProxy(config.service) || servicesType.isUseCustomUrl(config.service));
const apiAddress = computed({ get: () => configuredApiAddress(config), set: value => setApiAddress(config, value) });
const apiAddressModified = computed(() => !!defaultApiAddress(config) && apiAddress.value !== defaultApiAddress(config));
const apiAddressPlaceholder = computed(() => config.service === services.azureOpenai
  ? 'https://…/chat/completions?api-version=…' : config.service === services.newapi
    ? 'https://example.com 或完整接口地址' : '填写完整 API 地址');
function resetApiAddress() { setApiAddress(config, defaultApiAddress(config)); }
const modelChoice = computed({
  get: () => config.model[config.service] === customModelString
    ? config.customModel[config.service] || '' : config.model[config.service] || '',
  set: (value: string) => { config.model[config.service] = value.trim(); },
});
const modelList = computed(() => {
  let cached: string[] = [];
  try { cached = JSON.parse(config.cachedModels[config.service] || '[]'); } catch { /* use manual entry */ }
  if (!Array.isArray(cached)) cached = [];
  return [...new Set([...cached.filter(item => typeof item === 'string' && item.trim() && item !== customModelString), ...(modelChoice.value ? [modelChoice.value] : [])])];
});
const canFetchModels = computed(() => !servicesType.isTencent(config.service) && config.service !== services.azureOpenai);
const media = window.matchMedia('(prefers-color-scheme: dark)');
const applyTheme = () => document.documentElement.classList.toggle('dark', config.theme === 'dark' || (config.theme === 'auto' && media.matches));
media.addEventListener('change', applyTheme);
watch(() => config.theme, applyTheme, { immediate: true });
watch(() => config.service, () => { modelError.value = ''; });
watch([ready, showAdvanced], ([loaded, advanced]) => {
  if (loaded && !advanced) void nextTick(() => translationInput.value?.focus());
}, { flush: 'post' });

let persisted = '';
let stopSaving: (() => void) | undefined;
configReady.then(() => {
  persisted = JSON.stringify(config);
  ready.value = true;
  if (window.location.hash.startsWith('#settings-')) void openSettings(window.location.hash.slice('#settings-'.length));
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
  if (event.key !== 'Enter' || event.isComposing || event.keyCode === 229) return;
  event.preventDefault();
  if (event.ctrlKey || event.metaKey) {
    const input = event.target as HTMLTextAreaElement;
    const start = input.selectionStart;
    const end = input.selectionEnd;
    text.value = text.value.slice(0, start) + '\n' + text.value.slice(end);
    void nextTick(() => input.setSelectionRange(start + 1, start + 1));
  } else if (!event.repeat && canTranslate.value) {
    void translate();
  }
}
async function translate() {
  if (!canTranslate.value) return;
  const controller = new AbortController(); translationController = controller;
  const id = ++translationId;
  translatedOrigin.value = text.value.trim(); cardVisible.value = true;
  loading.value = true; result.value = ''; error.value = '';
  try {
    await saveConfig();
    const translated = await translateTextStream(translatedOrigin.value, '文本翻译', chunk => {
      if (id === translationId) result.value += chunk;
    }, undefined, controller.signal);
    if (id === translationId) {
      result.value = translated;
      shortcutsLearned.value = true;
      void browser.storage.local.set({ [shortcutStorageKey]: true }).catch(() => {});
    }
  } catch (err) {
    if (id === translationId && !controller.signal.aborted) error.value = err instanceof Error ? err.message : '翻译失败，请重试';
  } finally { if (id === translationId) loading.value = false; }
}
function closeTranslation() {
  translationController?.abort(); translationId++;
  loading.value = false; cardVisible.value = false;
}
async function openSettings(field: string) {
  showAdvanced.value = true;
  await nextTick();
  const selector = field === 'model' ? '.model-controls input' : field === 'credentials'
    ? '.settings-fields input[type="password"]' : '.settings-fields .el-input input';
  const input = document.querySelector<HTMLInputElement>(selector) ?? document.querySelector<HTMLInputElement>('.settings-fields .el-input input');
  input?.scrollIntoView({ block: 'nearest' });
  input?.focus();
}
function reloadPanel() { window.location.reload(); }
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
  if (activePrompt.value === 'system') config.system_role[config.service] = defaultOption.system_role;
  else config.user_role[config.service] = defaultOption.user_role;
  ElMessage.success('已恢复默认提示词');
}
function handlePromptTabKeydown(event: KeyboardEvent) {
  if (!(event.target instanceof HTMLElement) || event.target.getAttribute('role') !== 'tab') return;
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  activePrompt.value = event.key === 'Home' ? 'system' : event.key === 'End' ? 'user'
    : activePrompt.value === 'system' ? 'user' : 'system';
  void nextTick(() => document.getElementById(`${activePrompt.value}-prompt-tab`)?.focus());
}
async function clearCache() {
  if (clearingCache.value) return;
  clearingCache.value = true;
  try {
    cache.clean();
    const tabs = await browser.tabs.query({});
    await Promise.allSettled(tabs.filter(tab => tab.id).map(tab => browser.tabs.sendMessage(tab.id!, { type: 'clearCache' })));
    ElMessage.success('翻译缓存已清除');
  } catch { ElMessage.error('清除缓存失败，请重试'); }
  finally { clearingCache.value = false; }
}
</script>

<style scoped>
.translator { text-align: left; font-size: 14px; }
.setting-row, .section-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.input-shortcuts { margin: 6px 0 0; text-align: right; color: var(--el-text-color-secondary); font-size: 11px; }
.popup-translation-card { margin-top: 12px; }
.primary-settings { display: grid; gap: 10px; margin-top: 16px; padding-top: 14px; border-top: 1px solid var(--el-border-color-lighter); }
.setting-row { min-height: 30px; }
.setting-row .el-select { width: 190px; }
.theme-segments { display: flex; width: 190px; padding: 3px; box-sizing: border-box; border-radius: 8px; background: var(--el-fill-color-light); }
.theme-segment { position: relative; flex: 1; cursor: pointer; }
.theme-segment input { position: absolute; width: 1px; height: 1px; opacity: 0; }
.theme-segment span { display: block; padding: 5px 0; border-radius: 6px; text-align: center; font-size: 12px; color: var(--el-text-color-secondary); }
.theme-segment input:checked + span { background: var(--el-bg-color); color: var(--el-text-color-primary); box-shadow: 0 1px 4px rgb(0 0 0 / 8%); }
.theme-segment input:focus-visible + span { outline: 2px solid var(--el-color-primary); outline-offset: 1px; }
.setting-actions { display: flex; align-items: center; justify-content: flex-end; gap: 12px; }
.icon-action { flex: 0 0 32px; width: 32px; height: 32px; padding: 6px; border-radius: 8px; color: var(--el-text-color-secondary); }
.icon-action:hover { color: var(--el-color-primary); }
.icon-action:focus-visible { outline: 2px solid var(--el-color-primary); outline-offset: 2px; }
.icon-action :deep(.el-icon) { font-size: 16px; }
.hint, .save-status { font-size: 12px; line-height: 1.6; color: var(--el-text-color-secondary); margin: 8px 0; }
.setup-tip { padding: 10px; margin-top: 12px; border-radius: 6px; background: var(--el-color-warning-light-9); color: var(--el-color-warning-dark-2); font-size: 12px; }
h2 { font-size: 12px; font-weight: 600; color: var(--el-text-color-secondary); margin: 0 0 12px; }
.settings-fields { display: grid; gap: 12px; }
.section-heading { margin-bottom: 12px; }
.section-heading h2 { margin: 0; }
.settings-fields label { display: grid; gap: 6px; font-size: 13px; }
.prompt-tabs { display: flex; align-items: center; gap: 4px; min-width: 0; }
.prompt-tab { padding: 7px 8px; border: 0; border-radius: 6px; background: transparent; color: var(--el-text-color-secondary); font: inherit; font-size: 12px; cursor: pointer; white-space: nowrap; }
.prompt-tab[aria-selected="true"] { background: var(--el-fill-color-light); color: var(--el-text-color-primary); font-weight: 600; }
.prompt-tab:hover { color: var(--el-color-primary); }
.prompt-tab:focus-visible { outline: 2px solid var(--el-color-primary); outline-offset: 1px; }
.prompt-tip { display: inline-flex; padding: 0; border: 0; background: transparent; color: var(--el-text-color-secondary); cursor: help; }
.prompt-tip svg { width: 14px; height: 14px; }
.prompt-tip:focus-visible { outline: 2px solid var(--el-color-primary); outline-offset: 3px; border-radius: 50%; }
.model-controls, .address-controls { display: flex; gap: 8px; }
.address-controls .el-input { flex: 1; min-width: 0; }
.model-controls .el-select { flex: 1; min-width: 0; }
.translator :deep(.el-input__wrapper), .translator :deep(.el-select__wrapper), .translator :deep(.el-textarea__inner) { border-radius: 8px; }
.error-text { color: var(--el-color-danger); font-size: 12px; overflow-wrap: anywhere; }
.preferences { border-top: 1px solid var(--el-border-color-lighter); margin-top: 18px; padding-top: 14px; }
.save-status { text-align: right; margin-top: 16px; }
</style>

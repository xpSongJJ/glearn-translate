<template>
  <section class="fr-translation-tooltip" :class="{ 'fr-dark-theme': dark }" aria-label="翻译结果" aria-live="polite">
    <div class="fr-tooltip-header">
      <span class="fr-service-label">{{ serviceLabel }}</span>
      <div class="fr-tooltip-actions">
        <button v-if="pinnable" class="fr-action-btn" :class="{ 'fr-pinned': pinned }" :aria-pressed="pinned"
          :aria-label="pinned ? '取消固定' : '固定卡片'" :title="pinned ? '取消固定' : '固定卡片'" @mousedown.prevent @click="$emit('toggle-pin')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m16 3 5 5-4 1-4 4v4l-2 2-6-6 2-2h4l4-4zM8 16l-5 5" /></svg>
        </button>
        <button class="fr-action-btn" :disabled="!result || copying" @mousedown.prevent @click="copy"
          :class="{ 'fr-copy-success': copyStatus === '译文已复制' }"
          :aria-label="copyStatus === '译文已复制' ? copyStatus : '复制译文'" :title="copyStatus === '译文已复制' ? copyStatus : '复制译文'">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline v-if="copyStatus === '译文已复制'" points="5 12 9 16 19 6" />
            <g v-else><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></g>
          </svg>
        </button>
        <button class="fr-close-btn" @click="$emit('close')" aria-label="关闭翻译" title="关闭">×</button>
      </div>
    </div>
    <div class="fr-tooltip-content">
      <div v-if="loading && !result" class="fr-loading-spinner" role="status" aria-label="正在翻译" />
      <div v-if="error" class="fr-error-message">{{ error }}
        <span v-if="errorAction.hint" class="fr-error-hint">{{ errorAction.hint }}</span>
        <button class="fr-retry-btn" @click="handleErrorAction">{{ errorAction.label }}</button>
      </div>
      <div v-if="result" class="fr-translation-result"><pre>{{ result }}</pre></div>
      <p v-if="copyStatus" class="fr-copy-status" :class="copyStatus === '译文已复制' ? 'fr-sr-only' : 'fr-copy-error'" role="status">{{ copyStatus }}</p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { config } from '@/entrypoints/utils/config';
import { options } from '@/entrypoints/utils/option';
import { copyText } from '@/entrypoints/utils/clipboard';
import { translationErrorAction } from '@/entrypoints/utils/translationError';

const props = withDefaults(defineProps<{
  origin: string;
  result: string;
  loading: boolean;
  error: string;
  pinnable?: boolean;
  pinned?: boolean;
}>(), {});
const emit = defineEmits<{ close: []; retry: []; 'toggle-pin': []; configure: [field: string]; refresh: [] }>();
const errorAction = computed(() => translationErrorAction(props.error));
function handleErrorAction() {
  const action = errorAction.value.action;
  if (action === 'retry') emit('retry');
  else if (action === 'refresh') emit('refresh');
  else emit('configure', action);
}
const media = window.matchMedia('(prefers-color-scheme: dark)');
const systemDark = ref(media.matches);
const updateSystemTheme = () => { systemDark.value = media.matches; };
media.addEventListener('change', updateSystemTheme);
const dark = computed(() => config.theme === 'dark' || (config.theme === 'auto' && systemDark.value));
const serviceLabel = computed(() => options.services.find(item => item.value === config.service)?.label || config.service);
const copying = ref(false);
const copyStatus = ref('');
let statusTimer: ReturnType<typeof setTimeout> | undefined;
watch(() => [props.origin, props.result], () => { copyStatus.value = ''; });
async function copy() {
  if (!props.result || copying.value) return;
  copying.value = true; copyStatus.value = '';
  clearTimeout(statusTimer);
  try {
    await copyText(props.result);
    copyStatus.value = '译文已复制';
    statusTimer = setTimeout(() => { copyStatus.value = ''; }, 1800);
  } catch (error) {
    copyStatus.value = error instanceof Error ? error.message : '复制失败，请选择译文手动复制';
  } finally { copying.value = false; }
}
onBeforeUnmount(() => { clearTimeout(statusTimer); media.removeEventListener('change', updateSystemTheme); });
</script>

<style scoped>
.fr-translation-tooltip {
  --card-bg: #fff; --card-header: #f7f8fa; --card-text: #303133; --card-muted: #727782; --card-border: #e9ecf1;
  color: var(--card-text); background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 10px;
  box-shadow: 0 4px 16px rgb(0 0 0 / 9%); overflow: hidden; text-align: left;
  font: 14px/1.6 system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
.fr-dark-theme { --card-bg: #242424; --card-header: #2b2b2b; --card-text: #e5eaf3; --card-muted: #a5aab4; --card-border: #414243; }
.fr-tooltip-header { display: flex; align-items: center; justify-content: space-between; padding: 7px 10px; background: var(--card-header); border-bottom: 1px solid var(--card-border); }
.fr-service-label { color: var(--card-muted); font-size: 12px; }
.fr-tooltip-actions { display: flex; align-items: center; gap: 4px; }
button { font: inherit; }
.fr-action-btn, .fr-close-btn { display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; padding: 4px; background: transparent; border: 0; border-radius: 5px; color: var(--card-muted); cursor: pointer; }
.fr-close-btn { font-size: 22px; line-height: 1; }
.fr-action-btn:hover, .fr-close-btn:hover { background: rgb(127 127 127 / 12%); color: var(--card-text); }
.fr-action-btn:disabled { opacity: .35; cursor: default; }
button:focus-visible { outline: 2px solid #409eff; outline-offset: 1px; }
.fr-tooltip-content { padding: 12px; max-height: 320px; overflow-y: auto; }
pre { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; font: inherit; user-select: text; cursor: text; }
.fr-error-message, .fr-copy-error { color: #f56c6c; overflow-wrap: anywhere; }
.fr-retry-btn { border: 0; background: transparent; color: #409eff; cursor: pointer; padding: 0 4px; }
.fr-error-hint { display: block; color: var(--card-muted); font-size: 12px; margin-top: 4px; }
.fr-action-btn.fr-pinned { color: #409eff; background: rgb(64 158 255 / 12%); }
.fr-copy-status { margin: 8px 0 0; font-size: 12px; color: #67a94b; }
.fr-copy-status.fr-copy-error { color: #f56c6c; }
.fr-action-btn.fr-copy-success { color: #67a94b; }
.fr-sr-only { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; border: 0; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.fr-loading-spinner { width: 18px; height: 18px; margin: 8px auto; border: 2px solid var(--card-border); border-top-color: #409eff; border-radius: 50%; animation: spin .8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>

<template>
  <teleport to="body">
    <div ref="selection-ref" class="fr-selection-translator-wrapper">
      <button v-if="showIndicator && !showTooltip" class="fr-selection-indicator"
        aria-label="翻译选中文本" @mousedown.prevent @click="openTooltip"
        @mouseenter="openTooltip" @mouseleave="scheduleHide" />
      <TranslationCard v-if="showTooltip" :origin="selectedText" :result="translationResult" :loading="isLoading"
        :error="error" @close="closeTooltip" @retry="getTranslation"
        pinnable :pinned="pinned" @toggle-pin="togglePin" @configure="openSettings" @refresh="refreshPage"
        @mouseenter="clearHideTimer" @mouseleave="scheduleHide" />
    </div>
  </teleport>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, useTemplateRef, watch, watchEffect } from 'vue';
import { autoUpdate, computePosition, flip, hide, inline, offset, shift } from '@floating-ui/dom';
import TranslationCard from './TranslationCard.vue';
import { config } from '@/entrypoints/utils/config';
import { translateTextStream } from '@/entrypoints/utils/translateApi';
import { extensionRuntime } from '@/entrypoints/utils/runtime';

const container = useTemplateRef('selection-ref');
const selectedText = ref('');
const translationResult = ref('');
const error = ref('');
const isLoading = ref(false);
const showIndicator = ref(false);
const showTooltip = ref(false);
const pinned = ref(false);
const range = ref<Range | null>(null);
let isSelecting = false;
let selectionTimer: ReturnType<typeof setTimeout> | undefined;
let hideTimer: ReturnType<typeof setTimeout> | undefined;
let controller: AbortController | undefined;
let requestId = 0;

watchEffect(onCleanup => {
  const reference = range.value;
  const element = container.value;
  if ((!showIndicator.value && !showTooltip.value) || !reference || !element) return;
  if (pinned.value) { element.style.visibility = 'visible'; return; }
  const update = () => {
    void computePosition(reference, element, {
      placement: 'right', strategy: 'fixed',
      middleware: [offset(2), flip({ fallbackPlacements: ['left', 'top-start', 'bottom-start'], padding: 12 }), shift({ padding: 8 }), hide(), inline()],
    }).then(({ x, y, placement, middlewareData }) => {
      if (pinned.value) return;
      Object.assign(element.style, { left: `${x}px`, top: `${y}px`, visibility: middlewareData.hide?.referenceHidden ? 'hidden' : 'visible' });
      element.setAttribute('data-placement', placement);
    });
  };
  onCleanup(autoUpdate(reference, element, update, { animationFrame: true }));
});

watch([selectedText, () => config.to, () => config.service], () => {
  controller?.abort(); requestId++;
  translationResult.value = ''; error.value = ''; isLoading.value = false;
  if (showTooltip.value) void getTranslation();
});

function clearHideTimer() { clearTimeout(hideTimer); }
function scheduleHide() {
  clearHideTimer();
  if (pinned.value) return;
  hideTimer = setTimeout(() => { showTooltip.value = false; }, 350);
}
function openTooltip() {
  clearHideTimer();
  if (showTooltip.value) return;
  showTooltip.value = true;
  if (!translationResult.value && !isLoading.value) void getTranslation();
}
function closeTooltip() {
  if (isLoading.value) translationResult.value = '';
  clearHideTimer(); controller?.abort(); requestId++; isLoading.value = false;
  pinned.value = false; showTooltip.value = false; showIndicator.value = false; range.value = null;
}
function togglePin() { pinned.value = !pinned.value; clearHideTimer(); }
function refreshPage() { window.location.reload(); }
async function openSettings(field: string) {
  try {
    const response = await extensionRuntime().sendMessage({ type: 'open-settings', field });
    if (!response?.success) throw new Error(response?.error || '无法打开配置，请点击插件图标进入“更多”');
  } catch (cause) { error.value = cause instanceof Error ? cause.message : '无法打开配置，请点击插件图标进入“更多”'; }
}
async function getTranslation() {
  if (!selectedText.value) return;
  controller?.abort();
  const currentController = new AbortController(); controller = currentController;
  const currentId = ++requestId;
  isLoading.value = true; error.value = ''; translationResult.value = '';
  try {
    const result = await translateTextStream(selectedText.value, document.title, chunk => {
      if (currentId === requestId) translationResult.value += chunk;
    }, undefined, currentController.signal);
    if (currentId === requestId) translationResult.value = result;
  } catch (cause) {
    if (currentId === requestId && !currentController.signal.aborted) error.value = cause instanceof Error ? cause.message : '翻译失败，请重试';
  } finally { if (currentId === requestId) isLoading.value = false; }
}
function insideCard(target: EventTarget | null) { return target instanceof Node && !!container.value?.contains(target); }
function handleSelection() {
  if (isSelecting || pinned.value) return;
  clearTimeout(selectionTimer);
  selectionTimer = setTimeout(() => {
    if (pinned.value) return;
    const selection = window.getSelection();
    if (!selection?.rangeCount || insideCard(selection.anchorNode)) return;
    const text = selection.toString().trim();
    if (text.length < 2 || text.length > 4096) return;
    selectedText.value = text;
    range.value = selection.getRangeAt(0).cloneRange();
    showIndicator.value = true;
  }, 150);
}
function handleMouseDown(event: MouseEvent) { if (!insideCard(event.target)) isSelecting = true; }
function handleMouseUp(event: MouseEvent) { isSelecting = false; if (!insideCard(event.target)) handleSelection(); }
function handleClick(event: MouseEvent) { if (!pinned.value && !insideCard(event.target) && (showIndicator.value || showTooltip.value)) closeTooltip(); }
onMounted(() => {
  document.addEventListener('mousedown', handleMouseDown);
  document.addEventListener('mouseup', handleMouseUp);
  document.addEventListener('selectionchange', handleSelection);
  document.addEventListener('click', handleClick);
});
onBeforeUnmount(() => {
  controller?.abort(); requestId++; clearHideTimer(); clearTimeout(selectionTimer);
  document.removeEventListener('mousedown', handleMouseDown);
  document.removeEventListener('mouseup', handleMouseUp);
  document.removeEventListener('selectionchange', handleSelection);
  document.removeEventListener('click', handleClick);
});
</script>

<style scoped>
.fr-selection-translator-wrapper { position: fixed; top: 0; left: 0; width: min(350px, calc(100vw - 16px)); z-index: 2147483647; }
.fr-selection-indicator { position: absolute; width: 12px; height: 12px; padding: 0; border: 0; background: #ff4d4f; border-radius: 50%; cursor: pointer; box-shadow: 0 0 5px rgb(0 0 0 / 20%); animation: pulse 1.5s infinite; }
.fr-selection-indicator:focus-visible { outline: 2px solid #409eff; outline-offset: 3px; }
.fr-translation-tooltip { width: 100%; }
[data-placement="left"] .fr-selection-indicator { right: 4px; }
[data-placement="right"] .fr-selection-indicator { left: 4px; }
[data-placement^="top"] .fr-selection-indicator { bottom: 4px; }
[data-placement^="bottom"] .fr-selection-indicator { top: 4px; }
@keyframes pulse { 70% { box-shadow: 0 0 0 8px rgb(255 77 79 / 0%); } }
</style>

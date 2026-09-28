<template>
  <div class="status-row">
    <span class="status-left">v{{ version }}</span>
    <span class="status-center">{{ computedCount }} 次翻译</span>
    <button class="status-right" :aria-expanded="showAdvanced" @click="showAdvanced = !showAdvanced">{{ showAdvanced ? '返回' : '更多' }}</button>
  </div>
</template>

<script lang="ts" setup>
import { inject, computed } from 'vue';
import { config } from '@/entrypoints/utils/config';
import type { Ref } from 'vue';
const version = process.env.VUE_APP_VERSION;
const showAdvanced = inject<Ref<boolean>>('showAdvanced')!;
const computedCount = computed(() => config.count);
</script>

<style scoped>
.status-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 4px 4px 8px;
  font-size: 11px;
  color: var(--el-text-color-secondary);
  background: var(--fr-bg-color);
  border-top: 1px solid var(--fr-border-color-lighter, #eee);
}

.status-left {
  opacity: 0.7;
}

.status-center {
  flex: 1;
  text-align: center;
}

/* 更多按钮 */
.status-right {
  border: 0;
  background: transparent;
  font-family: inherit;
  padding: 6px 10px;
  font-size: 1em;
  color: var(--el-text-color-regular);
  cursor: pointer;
  user-select: none;
}

.status-right:hover {
  color: var(--el-color-primary);
  background: var(--el-fill-color-light);
  border-radius: 6px;
}

.status-right:active {
  transform: scale(0.98);
}
</style>

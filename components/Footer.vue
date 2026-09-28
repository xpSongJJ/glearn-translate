<template>
  <div class="status-row">
    <span class="status-left">版本 {{ version }}</span>
    <span class="status-center">你已经翻译 <b>{{ computedCount }}</b> 次</span>
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
  font-size: 0.7em;
  color: var(--fr-text-color-regular);
  background: var(--el-fill-color-light);
  border-top: 1px solid var(--fr-border-color-lighter, #eee);
}

.status-left {
  opacity: 0.6;
}

.status-center {
  flex: 1;
  text-align: center;
}

.status-center b {
  color: var(--el-color-success);
}

/* 更多按钮 */
.status-right {
  border: 0;
  background: transparent;
  font-family: inherit;
  padding: 6px 10px;
  font-size: 1em;
  color: var(--el-color-primary);
  cursor: pointer;
  user-select: none;
}

.status-right:hover {
  opacity: 0.8;
}

.status-right:active {
  transform: scale(0.98);
}
</style>

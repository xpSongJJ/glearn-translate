<template>
  <div class="status-row">
    <span class="status-left">版本 {{ version }}</span>
    <span class="status-center">你已经翻译 <b>{{ computedCount }}</b> 次</span>
    <span class="status-right" @click="showAdvanced = !showAdvanced">更多</span>
  </div>
</template>

<script lang="ts" setup>
import { inject, computed, reactive } from 'vue';
import { Config } from "../entrypoints/utils/model";
import { storage } from '@wxt-dev/storage';
import type { Ref } from 'vue';

const version = process.env.VUE_APP_VERSION;
const showAdvanced = inject<Ref<boolean>>('showAdvanced')!;

// 获取翻译次数
let localConfig = reactive(new Config());
storage.getItem('local:config').then((value) => {
  if (typeof value === 'string' && value) Object.assign(localConfig, JSON.parse(value));
});
storage.watch('local:config', (newValue) => {
  if (typeof newValue === 'string' && newValue) Object.assign(localConfig, JSON.parse(newValue));
});
const computedCount = computed(() => localConfig.count);
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

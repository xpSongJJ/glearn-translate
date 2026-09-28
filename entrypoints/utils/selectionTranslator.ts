import { createApp } from 'vue';
import SelectionTranslator from '@/components/SelectionTranslator.vue';

let selectionTranslatorInstance: any = null;
let app: any = null;

/**
 * 挂载选词翻译组件
 */
export function mountSelectionTranslator() {
  // Avoid mounting a duplicate instance.
  if (selectionTranslatorInstance) {
    return;
  }

  // 创建容器元素
  const container = document.createElement('div');
  container.id = 'glearn-selection-translator-container';
  document.body.appendChild(container);

  // 创建Vue应用实例
  app = createApp(SelectionTranslator);

  // 挂载应用
  selectionTranslatorInstance = app.mount(container);

  return selectionTranslatorInstance;
}

/**
 * 卸载选词翻译组件
 */
export function unmountSelectionTranslator() {
  if (selectionTranslatorInstance && app) {
    // 获取容器
    const container = document.getElementById('glearn-selection-translator-container');
    
    // 卸载Vue应用
    app.unmount();
    selectionTranslatorInstance = null;
    app = null;
    
    // 移除容器
    if (container) {
      container.remove();
    }
  }
}

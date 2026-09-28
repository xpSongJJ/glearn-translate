import { browser } from 'wxt/browser';

export function extensionRuntime() {
  const runtime = browser?.runtime;
  if (!runtime?.id) throw new Error('插件连接已失效，请重新加载插件并刷新页面');
  return runtime;
}

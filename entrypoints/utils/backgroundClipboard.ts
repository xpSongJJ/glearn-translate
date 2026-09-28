import { browser } from 'wxt/browser';
import { writeClipboardText } from './clipboard';

let creating: Promise<void> | undefined;

export async function copyInBackground(text: string): Promise<void> {
  if (typeof document !== 'undefined') {
    await writeClipboardText(text);
    return;
  }
  if (!browser.offscreen) throw new Error('当前浏览器不支持后台复制，请更新浏览器');
  creating ??= (async () => {
    if (!await browser.offscreen.hasDocument()) {
      await browser.offscreen.createDocument({
        url: 'clipboard.html',
        reasons: ['CLIPBOARD'],
        justification: 'Copy translated text without relying on webpage clipboard access.',
      });
    }
  })().finally(() => { creating = undefined; });
  await creating;
  const result = await browser.runtime.sendMessage({ target: 'clipboard', type: 'write-clipboard', text });
  if (!result?.success) throw new Error(result?.error || '复制失败，请重试');
}

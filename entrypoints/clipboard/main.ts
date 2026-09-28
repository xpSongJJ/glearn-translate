import { browser } from 'wxt/browser';
import { writeClipboardText } from '../utils/clipboard';

browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.target !== 'clipboard' || message.type !== 'write-clipboard' || typeof message.text !== 'string') return;
  void writeClipboardText(message.text).then(
    () => sendResponse({ success: true }),
    error => sendResponse({ success: false, error: error instanceof Error ? error.message : '复制失败' }),
  );
  return true;
});

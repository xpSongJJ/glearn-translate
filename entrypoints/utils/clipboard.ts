import { extensionRuntime } from './runtime';

/** Keep clipboard writes in the extension, outside the host page's permissions and copy handlers. */
export async function copyText(text: string): Promise<void> {
  const result = await extensionRuntime().sendMessage({ type: 'copy-translation', text });
  if (!result?.success) throw new Error(result?.error || '复制失败，请选择译文手动复制');
}

/** Runs in the offscreen page (Chrome) or the background page (Firefox). */
export async function writeClipboardText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // The page may block the Clipboard API; try the extension's copy permission.
    }
  }

  const activeElement = document.activeElement;
  const selection = window.getSelection();
  const ranges = selection
    ? Array.from({ length: selection.rangeCount }, (_, index) => selection.getRangeAt(index).cloneRange())
    : [];
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.readOnly = true;
  textarea.tabIndex = -1;
  textarea.setAttribute('aria-hidden', 'true');
  Object.assign(textarea.style, { position: 'fixed', left: '-9999px', top: '0' });
  document.body.appendChild(textarea);
  try {
    textarea.focus({ preventScroll: true });
    textarea.select();
    if (!document.execCommand('copy')) throw new Error('复制失败，请选择译文手动复制');
  } finally {
    textarea.remove();
    if (activeElement instanceof HTMLElement) activeElement.focus({ preventScroll: true });
    if (selection) {
      selection.removeAllRanges();
      ranges.forEach(range => selection.addRange(range));
    }
  }
}
